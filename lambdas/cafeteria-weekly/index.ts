import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'
import { chatWithTools, MODEL_BATCH } from '../shared/claude.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const BENCHMARK_SQL = `
-- Compara el colegio piloto vs. el resto de colegios
WITH piloto AS (
  SELECT category, COUNT(*) AS ventas
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
  GROUP BY category
),
resto AS (
  SELECT category, COUNT(*) AS ventas, COUNT(DISTINCT nit_colegio) AS colegios
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio != $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
  GROUP BY category
)
SELECT
  COALESCE(piloto.category, resto.category) AS category,
  piloto.ventas                              AS piloto_ventas,
  ROUND(resto.ventas::numeric / NULLIF(resto.colegios, 0)) AS avg_otros_colegios
FROM piloto FULL OUTER JOIN resto USING (category)
ORDER BY piloto_ventas DESC NULLS LAST;
`

const INSIGHTS_SQL = `
-- Agrega señales de padres del colegio piloto.
SELECT
  COUNT(DISTINCT v.identificacion_padre) FILTER (WHERE pn.category IN ('dulce','snack'))
    AS padres_alto_azucar_proxy,
  (SELECT array_agg(nombre_producto)
   FROM (
     SELECT v2.nombre_producto FROM reto.ventas v2
     LEFT JOIN bioalert.product_nutrition pn2 ON pn2.nombre_producto = v2.nombre_producto
     WHERE v2.nit_colegio != $1
       AND pn2.category IN ('fruta','lacteo')
       AND v2.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
     GROUP BY v2.nombre_producto
     HAVING NOT EXISTS (
       SELECT 1 FROM reto.ventas v3 WHERE v3.nit_colegio = $1 AND v3.nombre_producto = v2.nombre_producto
     )
     ORDER BY COUNT(*) DESC LIMIT 3
   ) t) AS productos_faltantes_saludables
FROM reto.ventas v
LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
WHERE v.nit_colegio = $1
  AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '30 days';
`

const BUCKET = process.env.WEB_BUCKET ?? 'bioalert-web-hackathon'
const s3 = new S3Client({})

export const handler: ScheduledHandler = async () => {
  // 1. Obtener admins de cafetería
  const admins = await query<{
    phone_e164: string
    nit_colegio: string
    display_name: string | null
  }>('SELECT phone_e164, nit_colegio, display_name FROM bioalert.cafeteria_admins')

  logger.info('cafeteria weekly start', { admins: admins.length })

  for (const a of admins) {
    try {
      // 2. Query benchmark
      const benchmark = await query<{
        category: string | null
        piloto_ventas: number | null
        avg_otros_colegios: number | null
      }>(BENCHMARK_SQL, [a.nit_colegio])

      // 3. Query cross-insights
      const crossInsights = await query<{
        padres_alto_azucar_proxy: number | null
        productos_faltantes_saludables: string[] | null
      }>(INSIGHTS_SQL, [a.nit_colegio])

      const insights = crossInsights[0]

      // 4. Claude Haiku para recomendaciones
      const narrative = await chatWithTools({
        systemPrompt: 'Eres un analista de negocio para cafeterías escolares. Escribe en español 3 líneas concisas con recomendaciones basadas en los datos. Tono profesional y accionable.',
        messages: [{
          role: 'user',
          content: `Datos de la cafetería (NIT ${a.nit_colegio}):\n` +
                   `Padres con hijos con alto consumo de azúcar: ${insights?.padres_alto_azucar_proxy}\n` +
                   `Productos que faltan y se venden en otros colegios: ${insights?.productos_faltantes_saludables?.join(', ')}\n` +
                   `Benchmark (primeras 3 categorías): ${JSON.stringify(benchmark.slice(0, 3))}`
        }],
        tools: [],
        model: MODEL_BATCH,
      })

      const narrText = (narrative.content[0] as any).text

      // 5. Guardar JSON en S3
      const reportData = {
        benchmark,
        insights,
        narrative: narrText,
        generated_at: new Date().toISOString()
      }

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: `insights/${a.nit_colegio}.json`,
        Body: JSON.stringify(reportData),
        ContentType: 'application/json',
      }))

      // 6. Enviar WhatsApp
      const url = `https://${BUCKET}.s3.amazonaws.com/cafeteria-insights/index.html?nit=${a.nit_colegio}`
      const body =
        `📊 *Reporte semanal de tu cafetería*\n\n` +
        `Esta semana, *${insights?.padres_alto_azucar_proxy ?? 0} padres* ` +
        `tienen hijos con consumo elevado de azúcar.\n\n` +
        `Productos que tienen colegios similares y faltan acá:\n` +
        (insights?.productos_faltantes_saludables ?? []).map((p: string) => `• ${p}`).join('\n') +
        `\n\n*Recomendación de la IA:*\n${narrText}\n\n` +
        `Ver análisis completo: ${url}`

      await sendText(a.phone_e164, body)
      logger.info('report sent', { phone: a.phone_e164 })

    } catch (e: any) {
      logger.error('failed to process report', { phone: a.phone_e164, error: e.message })
    }

    await new Promise(r => setTimeout(r, 250))  // throttle
  }
}
