import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'
import { chatWithTools, MODEL_BATCH } from '../shared/claude.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Devuelve usuario_identificacion + nombre + colegio del hijo MÁS ACTIVO del padre
// (multi-hijo determinístico), junto con top_products [{name, count}] y los
// 4 macros agregados de los últimos 7 días. Shape diseñado para alinear
// directamente con lo que consume web/nutrition-report/index.html.
const STUDENT_SQL = `
WITH yo AS (
  SELECT
    v.usuario_identificacion,
    MAX(v.nombre_estudiante)  AS nombre_estudiante,
    MAX(v.nit_colegio)        AS nit_colegio,
    MAX(v.colegio)            AS nombre_colegio
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
  GROUP BY 1
  ORDER BY COUNT(*) DESC, MAX(v.fecha) DESC, v.usuario_identificacion ASC
  LIMIT 1
),
last7 AS (
  SELECT
    v.cantidad, v.fecha, v.nombre_producto,
    pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg,
    pn.category,
    COALESCE(pn.gramos_por_unidad, 50) AS gramos
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.usuario_identificacion = (SELECT usuario_identificacion FROM yo)
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
),
top AS (
  SELECT COALESCE(json_agg(t), '[]'::json) AS items FROM (
    SELECT nombre_producto AS name, COUNT(*)::int AS count
    FROM last7 GROUP BY 1 ORDER BY 2 DESC LIMIT 5
  ) t
),
macros AS (
  SELECT
    COALESCE(ROUND(SUM(calories_100g * cantidad * gramos / 100.0))::int, 0) AS total_calories,
    COALESCE(ROUND(SUM(sugar_g * cantidad * gramos / 100.0))::int, 0)       AS total_sugar,
    COALESCE(ROUND(SUM(fat_g * cantidad * gramos / 100.0))::int, 0)         AS total_fat,
    COALESCE(ROUND(SUM(sodium_mg * cantidad * gramos / 100.0))::int, 0)     AS total_sodium,
    COALESCE(
      ROUND(COUNT(*) FILTER (WHERE category IN ('dulce','snack')) * 100.0 / NULLIF(COUNT(*),0))::int,
      0
    ) AS pct_snack,
    COUNT(*)::int AS purchases
  FROM last7
)
SELECT
  yo.usuario_identificacion,
  yo.nombre_estudiante,
  yo.nit_colegio,
  yo.nombre_colegio,
  top.items                   AS top_products,
  macros.total_calories,
  macros.total_sugar,
  macros.total_fat,
  macros.total_sodium,
  macros.pct_snack,
  macros.purchases
FROM yo, top, macros
`

const PEER_SQL = `
-- Promedio del colegio (excluyendo al estudiante) en últimos 7 días.
WITH last7 AS (
  SELECT v.usuario_identificacion, v.cantidad,
         pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg,
         COALESCE(pn.gramos_por_unidad, 50) AS gramos
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1
    AND v.usuario_identificacion <> $2
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
)
SELECT
  COALESCE(ROUND(SUM(calories_100g * cantidad * gramos / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))::int, 0) AS avg_calories,
  COALESCE(ROUND(SUM(sugar_g * cantidad * gramos / 100.0)       / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))::int, 0) AS avg_sugar,
  COALESCE(ROUND(SUM(fat_g * cantidad * gramos / 100.0)         / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))::int, 0) AS avg_fat,
  COALESCE(ROUND(SUM(sodium_mg * cantidad * gramos / 100.0)     / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))::int, 0) AS avg_sodium
FROM last7
`

const BUCKET = process.env.WEB_BUCKET ?? 'bioalert-web-hackathon-642722971137'
const REGION = process.env.AWS_REGION ?? 'us-east-1'
const s3 = new S3Client({})

interface StudentStats {
  usuario_identificacion: string
  nombre_estudiante: string | null
  nit_colegio: string | null
  nombre_colegio: string | null
  top_products: Array<{ name: string; count: number }> | null
  total_calories: number
  total_sugar: number
  total_fat: number
  total_sodium: number
  pct_snack: number
  purchases: number
}

interface PeerStats {
  avg_calories: number
  avg_sugar: number
  avg_fat: number
  avg_sodium: number
}

function getISOWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function buildFlags(s: StudentStats, peer: PeerStats): string[] {
  const flags: string[] = []
  if (s.pct_snack >= 40) {
    flags.push(`${s.pct_snack}% del consumo de la semana fue dulce o snack`)
  }
  if (peer.avg_sugar > 0 && s.total_sugar > peer.avg_sugar * 1.4) {
    const ratio = Math.round((s.total_sugar / peer.avg_sugar - 1) * 100)
    flags.push(`Consumo de azúcar ${ratio}% por encima del promedio del colegio`)
  }
  if (peer.avg_calories > 0 && s.total_calories > peer.avg_calories * 1.5) {
    flags.push(`Calorías 50% por encima del promedio del colegio`)
  }
  if (s.purchases < 3) {
    flags.push(`Solo ${s.purchases} compras esta semana — baja participación`)
  }
  return flags
}

interface InvokeEvent {
  dryRun?: boolean        // true: genera JSONs pero NO manda WhatsApp
  onlyPhone?: string      // si se pasa, solo procesa ese padre
}

// Acepta tanto ScheduledEvent (de EventBridge) como InvokeEvent (manual).
export const handler: ScheduledHandler = async (event: any) => {
  const dryRun = !!event?.dryRun
  const onlyPhone: string | undefined = event?.onlyPhone

  let parents = await query<{
    identificacion_padre: string
    phone_e164: string
    nombre_padre: string | null
  }>('SELECT identificacion_padre, phone_e164, nombre_padre FROM bioalert.parent_phone_map')

  if (onlyPhone) {
    parents = parents.filter(p => p.phone_e164 === onlyPhone)
  }

  logger.info('nutrition weekly start', { parents: parents.length, dryRun, onlyPhone })

  for (const p of parents) {
    try {
      const studentStats = await query<StudentStats>(STUDENT_SQL, [p.phone_e164])
      const stats = studentStats[0]
      if (!stats || !stats.total_calories) {
        logger.info('no stats for parent', { phone: p.phone_e164 })
        continue
      }

      let peerStats: PeerStats = { avg_calories: 0, avg_sugar: 0, avg_fat: 0, avg_sodium: 0 }
      if (stats.nit_colegio) {
        const peerResult = await query<PeerStats>(PEER_SQL, [stats.nit_colegio, stats.usuario_identificacion])
        if (peerResult[0]) peerStats = peerResult[0]
      }

      const flags = buildFlags(stats, peerStats)

      const narrativePrompt =
        `Datos del estudiante ${stats.nombre_estudiante ?? ''} esta semana:\n` +
        `- Calorías: ${stats.total_calories} kcal\n` +
        `- Azúcar: ${stats.total_sugar} g\n` +
        `- % snacks/dulces: ${stats.pct_snack}%\n` +
        `- Compras: ${stats.purchases}\n\n` +
        `Promedio del colegio (mismo periodo):\n` +
        `- Calorías: ${peerStats.avg_calories} kcal\n` +
        `- Azúcar: ${peerStats.avg_sugar} g\n\n` +
        (flags.length ? `Banderas detectadas: ${flags.join('. ')}` : 'Sin banderas críticas.')

      const narrative = await chatWithTools({
        systemPrompt:
          'Eres un asistente nutricional escolar. Devuelve SOLO el cuerpo del mensaje ' +
          'al padre (sin título, sin saludo, sin headings de markdown como "# ..."). ' +
          'Máximo 3 oraciones. Español neutro (usa "tienes" no "tenés"). Tono cálido pero ' +
          'directo, orientado a acción. Si hay banderas, mencionalas brevemente. ' +
          'Puedes usar **negrita** para resaltar UN dato clave si ayuda — nada más.',
        messages: [{ role: 'user', content: narrativePrompt }],
        tools: [],
        model: MODEL_BATCH,
      })

      const narrText = (narrative.content[0] as any).text as string

      // ── Shape exacto que consume web/nutrition-report/index.html ──
      const reportData = {
        student_name: stats.nombre_estudiante ?? 'Estudiante',
        student_id: stats.usuario_identificacion,
        school: stats.nombre_colegio ?? '',
        school_nit: stats.nit_colegio,
        week: getISOWeek(),
        top_products: stats.top_products ?? [],
        student_macros: [
          stats.total_calories,
          stats.total_sugar,
          stats.total_fat,
          stats.total_sodium,
        ],
        school_avg_macros: [
          peerStats.avg_calories,
          peerStats.avg_sugar,
          peerStats.avg_fat,
          peerStats.avg_sodium,
        ],
        pct_snack: stats.pct_snack,
        purchases: stats.purchases,
        flags,
        narrative: narrText,
        generated_at: new Date().toISOString(),
      }

      // Path relativo al HTML: web sirve nutrition-report/index.html y hace
      // fetch a ./data/{student_id}.json — eso resuelve a esta key:
      const key = `nutrition-report/data/${stats.usuario_identificacion}.json`
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(reportData),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'no-cache, max-age=0',
      }))
      logger.info('json written', { key })

      if (dryRun) {
        logger.info('dry run — skip whatsapp', { phone: p.phone_e164 })
      } else {
        const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/nutrition-report/index.html?student=${stats.usuario_identificacion}`
        const body =
          `🍎 *Reporte nutricional semanal*\n\n` +
          `${narrText}\n\n` +
          `Ver detalle: ${url}\n\n` +
          `¿Quieres ver opciones de recarga que prioricen lo saludable? Responde *opciones*.`

        await sendText(p.phone_e164, body)
        logger.info('report sent', { phone: p.phone_e164 })
      }
    } catch (e: any) {
      logger.error('failed to process report', { phone: p.phone_e164, error: e.message })
    }

    await new Promise(r => setTimeout(r, 250))
  }
}
