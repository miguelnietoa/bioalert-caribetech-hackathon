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
  r.category,
  r.type,
  r.expires_at,
  r.created_at,
  CASE
    WHEN r.expires_at IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (r.expires_at - now()))::int
  END AS days_left
FROM bioalert.restrictions r
WHERE r.usuario_identificacion = (SELECT usuario_identificacion FROM yo)
  AND r.active = true
  AND (r.expires_at IS NULL OR r.expires_at > now())
ORDER BY r.created_at DESC
`

export const def: Anthropic.Tool = {
  name: 'list_my_restrictions',
  description: 'Lista las restricciones activas del hijo del padre. Usar cuando el padre pregunta "¿qué tengo restringido?", "¿qué le restringí?", o "muéstrame mis restricciones".',
  input_schema: { type: 'object', properties: {}, required: [] },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<{
    category: string
    type: string
    expires_at: string | null
    created_at: string
    days_left: number | null
  }>(SQL, [phone])
  if (rows.length === 0) return { mensaje: 'no_active_restrictions' }
  return {
    restricciones: rows.map(r => ({
      categoria: r.category,
      tipo: r.type,
      dias_restantes: r.days_left,
      indefinida: r.expires_at === null,
      activa_desde: r.created_at,
    })),
  }
}
