import crypto from 'node:crypto'
import { getSecret } from './ssm.js'
import type { WhatsAppButton } from './types.js'
import { formatForWhatsApp } from './whatsapp-format.js'

const KAPSO_META = 'https://api.kapso.ai/meta/whatsapp/v24.0'

let cachedPhoneNumberId: string | null = null

async function authHeaders(): Promise<Record<string, string>> {
  const apiKey = await getSecret('kapso/api-key')
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function phoneNumberId(): Promise<string> {
  if (cachedPhoneNumberId) return cachedPhoneNumberId
  cachedPhoneNumberId = await getSecret('kapso/phone-number-id')
  return cachedPhoneNumberId
}

function normalizeTo(to: string): string {
  return to.replace(/^\+/, '')
}

async function sendMessage(payload: Record<string, unknown>): Promise<void> {
  const headers = await authHeaders()
  const id = await phoneNumberId()
  const res = await fetch(`${KAPSO_META}/${id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      ...payload,
    }),
  })
  if (!res.ok) {
    throw new Error(`Kapso send failed: ${res.status} ${await res.text()}`)
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  await sendMessage({
    to: normalizeTo(to),
    type: 'text',
    text: { body: formatForWhatsApp(body) },
  })
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: WhatsAppButton[],
): Promise<void> {
  await sendMessage({
    to: normalizeTo(to),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: formatForWhatsApp(body) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  })
}

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signatureHeader) return false
  const secret = await getSecret('kapso/webhook-secret')
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  const sigBuf = Buffer.from(signatureHeader)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}
