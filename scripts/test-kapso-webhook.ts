/**
 * Smoke test del webhook conversation-handler (firma HMAC como Kapso).
 * Uso: npx tsx scripts/test-kapso-webhook.ts [mensaje]
 */
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import pg from 'pg'
import { rdsConfig } from './lib/rds-from-ssm.js'

const WEBHOOK_URL =
  process.env.KAPSO_WEBHOOK_URL ??
  'https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/webhook/kapso'
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

async function main() {
  const text = process.argv[2] ?? '¿qué comió Mateo hoy?'
  const secret = ssm('kapso/webhook-secret')
  if (secret === 'REPLACE_ME') {
    throw new Error('kapso/webhook-secret en SSM sigue en REPLACE_ME — corré npm run ssm:sync')
  }

  const client = new pg.Client(rdsConfig())
  await client.connect()
  const { rows } = await client.query<{ phone_e164: string; nombre_padre: string | null }>(
    `SELECT phone_e164, nombre_padre FROM bioalert.parent_phone_map LIMIT 1`,
  )
  await client.end()

  const from = rows[0]?.phone_e164
  if (!from) {
    throw new Error('parent_phone_map vacío — corré npm run fixtures:apply')
  }

  const body = JSON.stringify({
    event: 'whatsapp.message.received',
    data: {
      messages: [{ from, text, timestamp: new Date().toISOString() }],
    },
  })

  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

  console.log(`→ POST ${WEBHOOK_URL}`)
  console.log(`→ from: ${from} (${rows[0]?.nombre_padre ?? 'padre demo'})`)
  console.log(`→ text: ${text}`)

  const started = Date.now()
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': signature,
    },
    body,
  })
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)
  const responseBody = await res.text()

  console.log(`→ HTTP ${res.status} (${elapsed}s)`)
  console.log(`→ body: ${responseBody}`)

  if (res.status === 200 && responseBody === 'ok') {
    console.log('✅ Webhook OK — revisá WhatsApp en ese número (respuesta vía Kapso).')
  } else if (res.status === 200) {
    console.log(`⚠️  200 pero body=${responseBody} (puede ser identidad desconocida u otro caso)`)
  } else {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
