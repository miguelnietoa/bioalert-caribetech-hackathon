// Tool 9: generate_payment_link
// EXT-1 cont. — emite link MOCK de Wompi cuando el padre confirma una opción de recarga.
//
// En producción, Biofood ya integra Wompi para pagos. Este link va a una página simulada
// en S3 que reproduce el flujo visual de Wompi. Es para demo del hackathon, NO procesa
// pagos reales.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const STAGE = process.env.STAGE ?? 'hackathon'
const AWS_ACCOUNT_ID = '642722971137'
const BUCKET = `bioalert-web-${STAGE}-${AWS_ACCOUNT_ID}`
const REGION = 'us-east-1'
const WOMPI_MOCK_BASE =
  `http://${BUCKET}.s3-website-${REGION}.amazonaws.com/wompi-mock/`

const COBERTURA_POR_PLAN: Record<string, string> = {
  esencial: '2 semanas',
  equilibrada: 'mes completo',
  bienestar: 'mes completo + margen saludable',
}

export const def: Anthropic.Tool = {
  name: 'generate_payment_link',
  description:
    'Genera un link de pago de Wompi (pasarela de pago colombiana) para que el padre complete la recarga. ' +
    'USAR esta tool cuando el padre confirme cuál de las 3 opciones quiere ' +
    '("la equilibrada", "sí, esa", "elijo bienestar", "esencial está bien", o un monto específico). ' +
    'NO usar antes de mostrar las 3 opciones. NO usar si el padre solo está preguntando.',
  input_schema: {
    type: 'object',
    properties: {
      plan: {
        type: 'string',
        enum: ['esencial', 'equilibrada', 'bienestar'],
        description: 'Cuál de las 3 opciones eligió el padre (en minúsculas).',
      },
      monto: {
        type: 'integer',
        description: 'Monto exacto en pesos colombianos a recargar (sin centavos).',
      },
    },
    required: ['plan', 'monto'],
  },
}

interface Input {
  plan: 'esencial' | 'equilibrada' | 'bienestar'
  monto: number
}

const NOMBRE_SQL = `
SELECT MAX(v.nombre_estudiante) AS nombre
FROM reto.ventas v
JOIN bioalert.parent_phone_map ppm
  ON ppm.identificacion_padre = v.identificacion_padre
WHERE ppm.phone_e164 = $1
GROUP BY v.usuario_identificacion
ORDER BY COUNT(*) DESC, MAX(v.fecha) DESC, v.usuario_identificacion ASC
LIMIT 1
`

export async function handler(input: unknown, phone: string): Promise<unknown> {
  const { plan, monto } = input as Input
  if (!plan || !monto || monto <= 0) {
    return { error: 'invalid_input', mensaje: 'plan y monto son requeridos' }
  }

  // Tomamos el primer nombre del estudiante (Mateo, Antonella, etc.)
  let estudianteNombre = 'el estudiante'
  try {
    const rows = await query<{ nombre: string | null }>(NOMBRE_SQL, [phone])
    const full = rows[0]?.nombre
    if (full) estudianteNombre = full.split(' ')[0] ?? full
  } catch {
    // sin nombre — seguimos con default
  }

  const ref = `BIOALERT-${Date.now()}-${plan}`
  const params = new URLSearchParams({
    plan,
    monto: String(monto),
    estudiante: estudianteNombre,
    cobertura: COBERTURA_POR_PLAN[plan] ?? '',
    ref,
  })
  const checkout_url = `${WOMPI_MOCK_BASE}?${params.toString()}`

  return {
    checkout_url,
    plan,
    monto,
    estudiante: estudianteNombre,
    referencia: ref,
    instrucciones:
      'Devuelve el checkout_url al padre exactamente como está, junto con un mensaje breve ' +
      'confirmando el plan y el monto. WhatsApp va a renderizar el link como preview clicable.',
  }
}
