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
UPDATE bioalert.restrictions
SET active = false
WHERE usuario_identificacion = (SELECT usuario_identificacion FROM yo)
  AND category = $2
  AND active = true
RETURNING id, category
`

export const def: Anthropic.Tool = {
  name: 'remove_restriction',
  description: 'Desactiva una restricción activa del hijo del padre. Usar cuando el padre dice "quita la restricción de X", "ya no quiero limitar X", o "puedes desactivar X".',
  input_schema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Categoría de la restricción a quitar.' },
    },
    required: ['category'],
  },
}

interface Input { category: string }

export async function handler(input: unknown, phone: string): Promise<unknown> {
  const { category } = input as Input
  if (!category) return { error: 'missing_category' }
  const rows = await query<{ id: number; category: string }>(SQL, [phone, category])
  if (rows.length === 0) return { mensaje: 'no_active_restriction_for_category', categoria: category }
  return { quitadas: rows.length, categoria: category }
}
