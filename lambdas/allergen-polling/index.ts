import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm'

const SQL = `
SELECT
  v.id                                  AS venta_id,
  v.fecha                               AS fecha,
  v.nombre_producto,
  v.usuario_identificacion,
  v.nombre_estudiante,
  pa.allergen_name,
  ppm.phone_e164                        AS phone_padre,
  ppm.nombre_padre
FROM reto.ventas v
JOIN bioalert.product_allergens pa ON pa.nombre_producto = v.nombre_producto
JOIN bioalert.student_allergens sa
  ON sa.usuario_identificacion = v.usuario_identificacion
  AND sa.allergen_name = pa.allergen_name
JOIN bioalert.parent_phone_map ppm
  ON ppm.identificacion_padre = v.identificacion_padre
WHERE v.id > $1::bigint
ORDER BY v.id
LIMIT 200;
`

const STAGE = process.env.STAGE ?? 'hackathon'
const CURSOR_NAME = `/bioalert/${STAGE}/cursors/allergen-polling`
const ssm = new SSMClient({})

async function getCursor(): Promise<string> {
  try {
    const r = await ssm.send(new GetParameterCommand({ Name: CURSOR_NAME }))
    return r.Parameter?.Value ?? '0'
  } catch {
    return '0'
  }
}

async function setCursor(value: string): Promise<void> {
  await ssm.send(new PutParameterCommand({
    Name: CURSOR_NAME, Value: value, Type: 'String', Overwrite: true,
  }))
}

export const handler: ScheduledHandler = async () => {
  const cursor = await getCursor()
  const hits = await query<{
    venta_id: string
    fecha: Date
    nombre_producto: string
    nombre_estudiante: string | null
    allergen_name: string
    phone_padre: string
    nombre_padre: string | null
  }>(SQL, [cursor])

  logger.info('allergen poll', { cursor, hits: hits.length })

  for (const h of hits) {
    const hora = new Date(h.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    const body =
      `⚠️ Alerta de alérgeno\n\n` +
      `${h.nombre_estudiante} compró *${h.nombre_producto}* a las ${hora}.\n\n` +
      `Este producto contiene *${h.allergen_name}*. ` +
      `Te aviso esto porque registraste alergia a ${h.allergen_name} para tu hijo.`
    try {
      await sendText(h.phone_padre, body)
    } catch (e: any) {
      logger.error('send failed', { venta_id: h.venta_id, error: e.message })
    }
    await new Promise(r => setTimeout(r, 250))  // throttle 4/s
  }

  if (hits.length > 0) {
    const lastId = hits[hits.length - 1]!.venta_id
    await setCursor(lastId)
  }
}
