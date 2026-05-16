import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SQL = readFileSync(resolve(__dirname, 'queries/find-new-allergen-hits.sql'), 'utf8')

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
