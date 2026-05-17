/** Normaliza teléfonos de Kapso/Meta a E.164 (+57...) como en parent_phone_map. */
export function toE164(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  return digits ? `+${digits}` : trimmed
}

type KapsoMessage = {
  from?: string
  type?: string
  text?: { body?: string }
  interactive?: {
    type?: string
    button_reply?: { id?: string, title?: string }
    list_reply?: { id?: string, title?: string }
  }
  kapso?: {
    direction?: string
    content?: string
    phone_number?: string
  }
}

type KapsoEnvelope = {
  message?: KapsoMessage
  conversation?: { phone_number?: string }
}

export type InboundMessage = { from: string, text: string }

function extractMessageText(msg: KapsoMessage): string {
  if (msg.type === 'text') {
    return (msg.text?.body ?? msg.kapso?.content ?? '').trim()
  }
  if (msg.type === 'interactive') {
    const br = msg.interactive?.button_reply
    if (br) return (br.title ?? br.id ?? '').trim()
    const lr = msg.interactive?.list_reply
    if (lr) return (lr.title ?? lr.id ?? '').trim()
  }
  return (msg.kapso?.content ?? '').trim()
}

function extractFromEnvelope(item: KapsoEnvelope): InboundMessage | null {
  const msg = item.message
  if (!msg) return null
  if (msg.kapso?.direction === 'outbound') return null

  const rawFrom =
    msg.from ??
    item.conversation?.phone_number ??
    msg.kapso?.phone_number
  if (!rawFrom) return null

  const text = extractMessageText(msg)
  if (!text) return null

  return { from: toE164(rawFrom), text }
}

/** Evento Kapso: header v2, o campos legacy en el body. */
export function resolveWebhookEvent(
  headers: Record<string, string | undefined>,
  body: Record<string, unknown>,
): string | undefined {
  const h =
    headers['x-webhook-event'] ??
    headers['X-Webhook-Event']
  if (h) return h
  if (typeof body.event === 'string') return body.event
  if (typeof body.type === 'string') return body.type
  return undefined
}

/**
 * Kapso v2 (single + batch), formato batched con debounce, y legacy del smoke test.
 */
export function parseInboundMessages(
  eventType: string,
  body: Record<string, unknown>,
): InboundMessage[] {
  if (eventType !== 'whatsapp.message.received') return []

  const data = body.data

  // Legacy smoke test / plan Track A: { data: { messages: [{ from, text }] } }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const legacy = (data as { messages?: Array<{ from: string, text: string }> }).messages
    if (legacy?.length) {
      return legacy
        .map((m) => {
          const text = (m.text ?? '').trim()
          if (!text || !m.from) return null
          return { from: toE164(m.from), text }
        })
        .filter((m): m is InboundMessage => m !== null)
    }
  }

  // v2 batch (debouncing): { type, batch: true, data: [ { message, conversation }, ... ] }
  if (Array.isArray(data)) {
    return data
      .map((item) => extractFromEnvelope(item as KapsoEnvelope))
      .filter((m): m is InboundMessage => m !== null)
  }

  // v2 single: { message, conversation, phone_number_id }
  const single = extractFromEnvelope(body as KapsoEnvelope)
  return single ? [single] : []
}
