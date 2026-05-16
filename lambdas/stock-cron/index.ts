import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'

const SQL = `
SELECT
  i.nombre_producto,
  i.current_stock,
  i.minimum_stock,
  ca.phone_e164,
  ca.display_name
FROM bioalert.inventory i
JOIN bioalert.cafeteria_admins ca ON ca.nit_colegio = i.nit_colegio
WHERE i.current_stock <= i.minimum_stock
ORDER BY ca.phone_e164, i.current_stock ASC;
`

export const handler: ScheduledHandler = async () => {
  const rows = await query<{
    nombre_producto: string
    current_stock: number
    minimum_stock: number
    phone_e164: string
    display_name: string | null
  }>(SQL)

  logger.info('stock check', { rows: rows.length })

  const byAdmin = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!byAdmin.has(r.phone_e164)) byAdmin.set(r.phone_e164, [])
    byAdmin.get(r.phone_e164)!.push(r)
  }

  for (const [phone, items] of byAdmin) {
    const lines = items.map(i =>
      `• *${i.nombre_producto}* — stock ${i.current_stock} (mínimo ${i.minimum_stock})`
    )
    const body =
      `🚨 Productos en stock crítico esta mañana:\n\n` +
      lines.join('\n') +
      `\n\nTe aviso esto porque su nivel está por debajo del mínimo configurado.`
    try {
      await sendText(phone, body)
    } catch (e: any) {
      logger.error('send failed', { phone, error: e.message })
    }
    await new Promise(r => setTimeout(r, 250))  // throttle 4/s
  }
}
