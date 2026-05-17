import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
WITH yo AS (
  SELECT v.usuario_identificacion FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
  GROUP BY 1
  ORDER BY COUNT(*) DESC, MAX(v.fecha) DESC, v.usuario_identificacion ASC
  LIMIT 1
)
UPDATE bioalert.streaks
SET parent_action = $3
WHERE usuario_identificacion = (SELECT usuario_identificacion FROM yo)
  AND category = $2
  AND parent_action IS NULL
RETURNING id, category
`

export const def: Anthropic.Tool = {
  name: 'acknowledge_streak',
  description: 'Marca una racha activa con la acción que el padre eligió (sin crear restricción). Usar cuando el padre dice "solo alertarme", "ignorar", "déjalo pasar". Action: alert_only=quiere seguir recibiendo info pero sin restringir; dismissed=no quiere oír más sobre esto.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['bebida', 'dulce', 'snack', 'comida', 'lacteo'],
        description: 'Categoría de la racha (bebida, dulce, snack, comida, lacteo).',
      },
      action: {
        type: 'string',
        enum: ['alert_only', 'dismissed'],
        description: 'Acción que tomó el padre.',
      },
    },
    required: ['category', 'action'],
  },
}

interface Input { category: string; action: 'alert_only' | 'dismissed' }

export async function handler(input: unknown, phone: string): Promise<unknown> {
  const { category, action } = input as Input
  if (!category || !action) return { error: 'missing_input' }
  const rows = await query<{ id: number; category: string }>(SQL, [phone, category, action])
  if (rows.length === 0) {
    return { mensaje: 'no_pending_streak_for_category', categoria: category }
  }
  return { actualizadas: rows.length, categoria: category, accion: action }
}
