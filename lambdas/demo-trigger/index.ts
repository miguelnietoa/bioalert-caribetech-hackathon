// Bridge para el feature catalog: recibe {feature, as_phone?} del browser
// y dispara la acción real:
//   - features conversacionales: firma webhook fake de Kapso y POST al conversation-handler
//   - features cron: invoca async la Lambda correspondiente
//
// Protección: token simple en header X-Demo-Token (SSM secret /bioalert/<stage>/demo/trigger-token).
// CORS abierto a * — para demo OK; producción debería restringir al dominio del bucket.

import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import crypto from 'node:crypto'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { getSecret } from '../shared/ssm.js'
import { logger } from '../shared/logger.js'
import {
  findFeature,
  DEFAULT_PARENT_PHONE,
  type FeatureSpec,
} from '../shared/feature-manifest.js'

const CONVERSATION_WEBHOOK_URL =
  process.env.CONVERSATION_WEBHOOK_URL ??
  'https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/webhook/kapso'

const lambdaClient = new LambdaClient({})

function cors(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Token',
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function dispatchConversational(
  feature: FeatureSpec,
  asPhone: string,
): Promise<{ status: number; details: unknown }> {
  if (!feature.whatsapp_text) {
    return { status: 400, details: { error: 'feature has no whatsapp_text' } }
  }

  // Para features admin con Diana (que está en ambas tablas y se resuelve como parent),
  // agregamos prefix contextual para guiar al LLM al rol correcto.
  const text =
    feature.kind === 'conversational_admin'
      ? `Como admin de cafetería del colegio piloto: ${feature.whatsapp_text}`
      : feature.whatsapp_text

  const body = JSON.stringify({
    event: 'whatsapp.message.received',
    data: {
      messages: [
        {
          from: asPhone,
          text,
          timestamp: new Date().toISOString(),
        },
      ],
    },
  })
  const secret = await getSecret('kapso/webhook-secret')
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

  const res = await fetch(CONVERSATION_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body,
  })
  const responseText = await res.text()
  return {
    status: res.status,
    details: {
      phone: asPhone,
      message: text,
      response_body: responseText.slice(0, 200),
    },
  }
}

async function dispatchCron(
  feature: FeatureSpec,
): Promise<{ status: number; details: unknown }> {
  if (!feature.lambda_function) {
    return { status: 400, details: { error: 'feature has no lambda_function' } }
  }
  // Si el feature define un lambda_payload (e.g. filtros para demo),
  // se pasa tal cual. Si no, se invoca con payload vacío y la Lambda
  // corre con sus defaults (como lo haría el cron real).
  const payload = feature.lambda_payload ?? {}
  const cmd = new InvokeCommand({
    FunctionName: feature.lambda_function,
    InvocationType: 'Event', // async — no esperamos respuesta
    Payload: Buffer.from(JSON.stringify(payload)),
  })
  await lambdaClient.send(cmd)
  return {
    status: 202,
    details: { lambda: feature.lambda_function, mode: 'async_invoke' },
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // CORS preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' }
  }

  // Token check
  const tokenHeader =
    event.headers['x-demo-token'] ?? event.headers['X-Demo-Token']
  const expectedToken = await getSecret('demo/trigger-token')
  if (tokenHeader !== expectedToken) {
    logger.warn('invalid token', { provided: !!tokenHeader })
    return {
      statusCode: 401,
      headers: cors(),
      body: JSON.stringify({ error: 'invalid_token' }),
    }
  }

  // Body parse
  let payload: { feature?: string; as_phone?: string }
  try {
    payload = JSON.parse(event.body ?? '{}')
  } catch {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'invalid_json' }),
    }
  }

  if (!payload.feature) {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'feature_required' }),
    }
  }

  const feature = findFeature(payload.feature)
  if (!feature) {
    return {
      statusCode: 404,
      headers: cors(),
      body: JSON.stringify({
        error: 'feature_not_found',
        feature: payload.feature,
      }),
    }
  }

  logger.info('demo trigger', { feature: feature.id, kind: feature.kind })

  let result: { status: number; details: unknown }
  if (
    feature.kind === 'conversational_parent' ||
    feature.kind === 'conversational_admin'
  ) {
    const phone =
      payload.as_phone ?? feature.as_phone ?? DEFAULT_PARENT_PHONE
    result = await dispatchConversational(feature, phone)
  } else if (feature.kind === 'cron') {
    result = await dispatchCron(feature)
  } else {
    result = {
      status: 400,
      details: { error: 'feature_not_actionable', kind: feature.kind },
    }
  }

  return {
    statusCode: result.status >= 400 ? result.status : 200,
    headers: cors(),
    body: JSON.stringify({
      feature: feature.id,
      kind: feature.kind,
      status: result.status,
      details: result.details,
    }),
  }
}
