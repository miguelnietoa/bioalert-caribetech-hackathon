// Handler del webhook entrante de Kapso. Es el corazón conversacional de BioAlert+.
//
// Flujo:
//   1. Validar HMAC del webhook
//   2. Resolver identidad (padre / admin / desconocido) por el teléfono
//   3. Cargar sesión de DynamoDB (TTL 1h)
//   4. Loop de tool calling con Claude Sonnet 4.6
//   5. Emitir respuesta + quick replies cuando aplica (EXT-6)
//   6. Guardar sesión

import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import type Anthropic from '@anthropic-ai/sdk'

import { chatWithTools, MODEL_CONVERSATIONAL } from '../shared/claude.js'
import { sendText, verifyWebhookSignature } from '../shared/whatsapp.js'
import { getSession, putSession } from '../shared/dynamo-conversations.js'
import { query } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import type { ConversationSession } from '../shared/types.js'

import { SYSTEM_PROMPT } from './prompts/system.js'
import { toolsFor, executeToolCall } from './tools/index.js'
import { parseInboundMessages, resolveWebhookEvent } from './kapso-payload.js'

const IDENTITY_SQL = `
SELECT 'parent' AS kind, identificacion_padre AS id, nombre_padre AS display_name
FROM bioalert.parent_phone_map
WHERE phone_e164 = $1
UNION ALL
SELECT 'admin' AS kind, nit_colegio AS id, display_name
FROM bioalert.cafeteria_admins
WHERE phone_e164 = $1
LIMIT 1
`

type Identity =
  | { kind: 'parent', identificacion_padre: string, display_name: string | null }
  | { kind: 'admin',  nit_colegio: string,         display_name: string | null }
  | { kind: 'unknown' }

async function resolveIdentity(phone: string): Promise<Identity> {
  const rows = await query<{ kind: 'parent' | 'admin', id: string, display_name: string | null }>(
    IDENTITY_SQL, [phone],
  )
  const r = rows[0]
  if (!r) return { kind: 'unknown' }
  if (r.kind === 'parent') {
    return { kind: 'parent', identificacion_padre: r.id, display_name: r.display_name }
  }
  return { kind: 'admin', nit_colegio: r.id, display_name: r.display_name }
}

function extractText(content: Anthropic.Message['content']): string {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n\n')
  return text.trim() || '(sin respuesta)'
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const raw = event.body ?? ''
  const sig = event.headers['x-webhook-signature'] ?? event.headers['X-Webhook-Signature']

  if (!(await verifyWebhookSignature(raw, sig))) {
    logger.warn('webhook_signature_invalid')
    return { statusCode: 401, body: 'invalid_signature' }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { statusCode: 400, body: 'invalid_json' }
  }

  const eventType = resolveWebhookEvent(event.headers, payload)
  if (eventType !== 'whatsapp.message.received') {
    logger.info('webhook_ignored', { event: eventType ?? 'missing' })
    return { statusCode: 200, body: 'ignored_event' }
  }

  const msgs = parseInboundMessages(eventType, payload)
  if (msgs.length === 0) {
    logger.info('webhook_no_inbound', {
      batch: payload.batch === true,
      has_message: Boolean(payload.message),
    })
    return { statusCode: 200, body: 'no_messages' }
  }

  const from = msgs[0]!.from
  // Kapso debouncing concatena varios mensajes en un batch — los unimos en un solo turno.
  const text = msgs.map(m => m.text).join('\n').trim()
  if (!text) return { statusCode: 200, body: 'empty_text' }

  const t0 = Date.now()
  logger.info('inbound', { from, batch_size: msgs.length, text_len: text.length })

  const identity = await resolveIdentity(from)
  if (identity.kind === 'unknown') {
    await sendText(from,
      'Hola 👋 Soy el agente de Biofood, pero tu número no está vinculado a un estudiante todavía. ' +
      'Si crees que es un error, comunícate con la cafetería de tu colegio para vincular tu WhatsApp.'
    )
    return { statusCode: 200, body: 'unknown_identity' }
  }

  // Sesión: contexto conversacional con TTL 1h.
  const existing = await getSession(from)
  const session: ConversationSession = existing ?? {
    phone_e164: from,
    history: [],
    expires_at: 0,
    identity: identity.kind === 'parent'
      ? { kind: 'parent', usuario_identificacion: identity.identificacion_padre }
      : { kind: 'admin', nit_colegio: identity.nit_colegio },
  }

  session.history.push({ role: 'user', content: text })

  const tools = toolsFor(identity.kind)

  // Bucle de tool calling — Claude puede llamar tools, recibir resultado, llamar otra,
  // hasta producir un mensaje final sin tool_use.
  const MAX_TURNS = 5
  let lastResponse: Anthropic.Message | null = null

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await chatWithTools({
      systemPrompt: SYSTEM_PROMPT,
      messages: session.history,
      tools,
      model: MODEL_CONVERSATIONAL,
    })
    lastResponse = res

    const toolUses = res.content.filter(b => b.type === 'tool_use')

    if (toolUses.length === 0) {
      // Respuesta final — sale del bucle.
      break
    }

    // Acumulamos el mensaje del asistente con tool_use blocks
    session.history.push({ role: 'assistant', content: res.content })

    // Ejecutamos las tools en paralelo y empujamos los resultados como un solo turno user.
    const toolResults = await Promise.all(toolUses.map(async (tu) => {
      if (tu.type !== 'tool_use') return null
      const result = await executeToolCall(tu.name, tu.input, from)
      return {
        type: 'tool_result' as const,
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      }
    }))

    session.history.push({
      role: 'user',
      content: toolResults.filter((r): r is NonNullable<typeof r> => r !== null),
    })
  }

  if (!lastResponse) {
    logger.error('no_response_after_max_turns', { from })
    await sendText(from, 'Disculpa, tuve un problema procesando tu mensaje. Intentá de nuevo en un momento.')
    return { statusCode: 500, body: 'no_response' }
  }

  const reply = extractText(lastResponse.content)
  session.history.push({ role: 'assistant', content: reply })

  // Enviar respuesta principal por WhatsApp.
  // El link de pago Wompi (cuando aplica) viene embebido en `reply` porque
  // Claude lo obtiene desde la tool generate_payment_link y lo incluye en
  // su mensaje natural (WhatsApp lo renderiza como preview clicable).
  await sendText(from, reply)

  await putSession(session)

  logger.info('inbound_done', {
    from,
    duration_ms: Date.now() - t0,
    turns: session.history.length,
  })

  return { statusCode: 200, body: 'ok' }
}
