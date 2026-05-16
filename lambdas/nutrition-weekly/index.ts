import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'
import { chatWithTools, MODEL_BATCH } from '../shared/claude.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const STUDENT_SQL = `
-- top 3 productos + macros últimos 7 días
WITH last7 AS (
  SELECT v.*, pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg, pn.canonical_name, pn.category
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.identificacion_padre = (
    SELECT identificacion_padre FROM bioalert.parent_phone_map WHERE phone_e164 = $1
  )
  AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
)
SELECT
  (SELECT json_agg(t) FROM (
    SELECT nombre_producto, COUNT(*) AS veces
    FROM last7 GROUP BY 1 ORDER BY 2 DESC LIMIT 3
  ) t) AS top_products,
  ROUND(SUM(calories_100g * cantidad / 100.0)) AS total_calories,
  ROUND(SUM(sugar_g * cantidad / 100.0))       AS total_sugar,
  ROUND(SUM(fat_g * cantidad / 100.0))         AS total_fat,
  ROUND(SUM(sodium_mg * cantidad / 100.0))     AS total_sodium,
  COUNT(*) FILTER (WHERE category IN ('dulce','snack')) * 100.0 / NULLIF(COUNT(*),0) AS pct_snack
FROM last7;
`

const PEER_SQL = `
-- Promedio de consumo del colegio en los últimos 7 días
WITH last7 AS (
  SELECT v.*, pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1
    AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
)
SELECT
  ROUND(SUM(calories_100g * cantidad / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0)) AS avg_calories,
  ROUND(SUM(sugar_g * cantidad / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))       AS avg_sugar,
  ROUND(SUM(fat_g * cantidad / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))         AS avg_fat,
  ROUND(SUM(sodium_mg * cantidad / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))     AS avg_sodium
FROM last7;
`

const BUCKET = process.env.WEB_BUCKET ?? 'bioalert-web-hackathon'
const s3 = new S3Client({})

export const handler: ScheduledHandler = async () => {
  // 1. Obtener todos los padres
  const parents = await query<{
    identificacion_padre: string
    phone_e164: string
    nombre_padre: string | null
  }>('SELECT identificacion_padre, phone_e164, nombre_padre FROM bioalert.parent_phone_map')

  logger.info('nutrition weekly start', { parents: parents.length })

  for (const p of parents) {
    try {
      // 2. Query nutrición del hijo
      const studentStats = await query<{
        top_products: Array<{ nombre_producto: string, veces: number }> | null
        total_calories: number | null
        total_sugar: number | null
        total_fat: number | null
        total_sodium: number | null
        pct_snack: number | null
      }>(STUDENT_SQL, [p.phone_e164])

      const stats = studentStats[0]
      if (!stats || !stats.total_calories) {
        logger.info('no stats for parent', { phone: p.phone_e164 })
        continue
      }

      // 3. Obtener nit_colegio del estudiante
      const colegioResult = await query<{ nit_colegio: string }>(
        'SELECT nit_colegio FROM reto.ventas WHERE identificacion_padre = $1 LIMIT 1',
        [p.identificacion_padre]
      )
      const nitColegio = colegioResult[0]?.nit_colegio

      // 4. Query promedio del colegio
      let peerStats = { avg_calories: 0, avg_sugar: 0, avg_fat: 0, avg_sodium: 0 }
      if (nitColegio) {
        const peerResult = await query<{
          avg_calories: number | null
          avg_sugar: number | null
          avg_fat: number | null
          avg_sodium: number | null
        }>(PEER_SQL, [nitColegio])
        
        if (peerResult[0]) {
          peerStats = {
            avg_calories: peerResult[0].avg_calories ?? 0,
            avg_sugar: peerResult[0].avg_sugar ?? 0,
            avg_fat: peerResult[0].avg_fat ?? 0,
            avg_sodium: peerResult[0].avg_sodium ?? 0,
          }
        }
      }

      // 5. Llamar Claude Haiku para narrativa
      const narrative = await chatWithTools({
        systemPrompt: 'Eres asistente nutricional. Escribe en español 3 líneas concisas con banderas rojas si las hay. Tono cálido pero directo.',
        messages: [{
          role: 'user',
          content: `Datos semanales del estudiante:\nCalorías: ${stats.total_calories}\nAzúcar: ${stats.total_sugar}g\n% snacks: ${stats.pct_snack}%\n\nPromedio del colegio:\nCalorías: ${peerStats.avg_calories}\nAzúcar: ${peerStats.avg_sugar}g`
        }],
        tools: [],
        model: MODEL_BATCH,
      })

      const narrText = (narrative.content[0] as any).text

      // 6. Guardar JSON en S3
      const reportData = {
        student: stats,
        peer: peerStats,
        parent: p,
        narrative: narrText,
        generated_at: new Date().toISOString()
      }

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: `data/${p.identificacion_padre}.json`,
        Body: JSON.stringify(reportData),
        ContentType: 'application/json',
      }))

      // 7. Enviar WhatsApp
      const url = `https://${BUCKET}.s3.amazonaws.com/nutrition-report/index.html?parent=${p.identificacion_padre}`
      const body =
        `🍎 *Reporte nutricional semanal*\n\n` +
        `${narrText}\n\n` +
        `Ver detalle completo: ${url}\n\n` +
        `¿Querés ver opciones de recarga que prioricen lo saludable? Respondé *Recargar*.`

      await sendText(p.phone_e164, body)
      logger.info('report sent', { phone: p.phone_e164 })

    } catch (e: any) {
      logger.error('failed to process report', { phone: p.phone_e164, error: e.message })
    }
    
    await new Promise(r => setTimeout(r, 250))  // throttle
  }
}
