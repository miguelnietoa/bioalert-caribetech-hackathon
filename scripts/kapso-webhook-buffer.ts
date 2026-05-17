/**
 * Ajusta el debounce/buffer del webhook Kapso (latencia vs batching).
 *
 * Uso:
 *   npx tsx scripts/kapso-webhook-buffer.ts              # listar webhooks
 *   npx tsx scripts/kapso-webhook-buffer.ts 2            # buffer 2s (recomendado demo)
 *   npx tsx scripts/kapso-webhook-buffer.ts off          # sin buffer (~0s extra Kapso)
 */
import { execSync } from 'node:child_process'

const PLATFORM = 'https://api.kapso.ai/platform/v1'
const STAGE = process.env.STAGE ?? 'hackathon'
const PROFILE = process.env.AWS_PROFILE ?? 'biofood-hackathon'
const REGION = process.env.AWS_REGION ?? 'us-east-1'

function ssm(name: string): string {
  return execSync(
    `aws ssm get-parameter --name /bioalert/${STAGE}/${name} --with-decryption ` +
      `--query Parameter.Value --output text --profile ${PROFILE} --region ${REGION}`,
    { encoding: 'utf8' },
  ).trim()
}

async function api(path: string, init?: RequestInit) {
  const apiKey = ssm('kapso/api-key')
  const res = await fetch(`${PLATFORM}${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`)
  return text ? JSON.parse(text) : {}
}

type Webhook = {
  id: string
  url: string
  buffer_enabled?: boolean
  buffer_window_seconds?: number
  max_buffer_size?: number
}

async function main() {
  const phoneNumberId = ssm('kapso/phone-number-id')
  const arg = process.argv[2]

  const list = await api(`/whatsapp/phone_numbers/${phoneNumberId}/webhooks`)
  const hooks: Webhook[] = list.data ?? []

  if (!hooks.length) {
    console.log('No hay webhooks para', phoneNumberId)
    return
  }

  console.log(`Webhooks (${phoneNumberId}):`)
  for (const h of hooks) {
    console.log(
      `  ${h.id}\n    url: ${h.url}\n    buffer: ${h.buffer_enabled ? `${h.buffer_window_seconds}s (max ${h.max_buffer_size})` : 'off'}`,
    )
  }

  if (!arg) return

  const target = hooks[0]!
  const body =
    arg === 'off'
      ? { whatsapp_webhook: { buffer_enabled: false } }
      : {
          whatsapp_webhook: {
            buffer_enabled: true,
            buffer_window_seconds: Math.min(60, Math.max(1, Number(arg))),
            max_buffer_size: 20,
            buffer_events: ['whatsapp.message.received'],
          },
        }

  const updated = await api(
    `/whatsapp/phone_numbers/${phoneNumberId}/webhooks/${target.id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  const w = updated.data as Webhook
  console.log(
    '\n✅ Actualizado:',
    w.buffer_enabled ? `buffer ${w.buffer_window_seconds}s` : 'buffer desactivado',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
