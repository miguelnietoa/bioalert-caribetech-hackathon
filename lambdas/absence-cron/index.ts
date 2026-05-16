import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SQL = readFileSync(resolve(__dirname, 'queries/find-absent-students.sql'), 'utf8')

const NIT_PILOTO = process.env.NIT_PILOTO ?? '900000680'

export const handler: ScheduledHandler = async () => {
  const hits = await query<{
    usuario_identificacion: string
    nombre_estudiante: string | null
    phone_e164: string
    nombre_padre: string | null
  }>(SQL, [NIT_PILOTO])

  logger.info('absence check', { hits: hits.length })

  for (const h of hits) {
    const body =
      `ℹ️ Notificación de ausencia de consumo\n\n` +
      `Aún no se registran compras hoy para *${h.nombre_estudiante}*.\n\n` +
      `Te aviso esto porque típicamente compra antes de las 11 AM según su patrón habitual.`
    try {
      await sendText(h.phone_e164, body)
    } catch (e: any) {
      logger.error('send failed', { usuario_identificacion: h.usuario_identificacion, error: e.message })
    }
    await new Promise(r => setTimeout(r, 250))  // throttle 4/s
  }
}
