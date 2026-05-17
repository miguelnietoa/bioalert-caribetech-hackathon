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
SELECT
  s.category,
  s.days_in_streak,
  s.last_seen_date,
  s.nombre_estudiante,
  s.detected_at
FROM bioalert.streaks s
WHERE s.usuario_identificacion = (SELECT usuario_identificacion FROM yo)
  AND s.parent_action IS NULL
ORDER BY s.detected_at DESC
LIMIT 10
`

export const def: Anthropic.Tool = {
  name: 'get_active_streaks',
  description: 'Lista las rachas (patrones de consumo repetido) detectadas para el hijo principal del padre que aún no han sido respondidas. Útil cuando el padre responde a una alerta o pregunta "¿qué patrones detectaste?".',
  input_schema: { type: 'object', properties: {}, required: [] },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<{
    category: string
    days_in_streak: number
    last_seen_date: string
    nombre_estudiante: string | null
    detected_at: string
  }>(SQL, [phone])
  const first = rows[0]
  if (!first) return { mensaje: 'no_active_streaks' }
  return {
    nombre_estudiante: first.nombre_estudiante,
    rachas: rows.map(r => ({
      categoria: r.category,
      dias_consecutivos: r.days_in_streak,
      ultima_compra: r.last_seen_date,
    })),
  }
}
