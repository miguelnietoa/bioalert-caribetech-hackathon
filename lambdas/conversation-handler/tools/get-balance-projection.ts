// Tool 4: get_balance_projection
// US-04 — proyección de agotamiento de saldo.
// Balance se computa on-the-fly como SUM(recargas) - SUM(ventas) por usuario_identificacion.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
WITH yo AS (
  SELECT v.usuario_identificacion
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm
    ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
  GROUP BY 1
  ORDER BY MAX(v.fecha) DESC
  LIMIT 1
),
recargas AS (
  SELECT COALESCE(SUM(r.valor), 0) AS total
  FROM reto.recargas r, yo
  WHERE r.usuario_identificacion = yo.usuario_identificacion
),
gastos AS (
  SELECT COALESCE(SUM(v.importe), 0) AS total
  FROM reto.ventas v, yo
  WHERE v.usuario_identificacion = yo.usuario_identificacion
),
patron AS (
  SELECT
    ROUND(SUM(v.importe) / NULLIF(COUNT(DISTINCT v.fecha), 0))::int AS gasto_diario_avg,
    COUNT(DISTINCT v.fecha)::int                                    AS dias_con_compra,
    MAX(v.fecha)                                                    AS ultima_compra
  FROM reto.ventas v, yo
  WHERE v.usuario_identificacion = yo.usuario_identificacion
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '30 days'
)
SELECT
  yo.usuario_identificacion,
  (recargas.total - gastos.total)::numeric          AS balance_actual,
  patron.gasto_diario_avg                           AS gasto_diario_avg,
  patron.dias_con_compra                            AS dias_con_compra_30d,
  patron.ultima_compra                              AS ultima_compra,
  CASE
    WHEN patron.gasto_diario_avg IS NULL OR patron.gasto_diario_avg = 0 THEN NULL
    ELSE ROUND((recargas.total - gastos.total) / patron.gasto_diario_avg)::int
  END                                               AS dias_estimados_restantes
FROM yo, recargas, gastos, patron
`

export const def: Anthropic.Tool = {
  name: 'get_balance_projection',
  description: 'Calcula el saldo actual del estudiante (recargas totales menos consumos totales) y proyecta en cuántos días se agota según el patrón de gasto de los últimos 30 días. Útil cuando el padre pregunta por saldo o cuándo se acaba.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<{
    usuario_identificacion: string
    balance_actual: number
    gasto_diario_avg: number | null
    dias_con_compra_30d: number
    ultima_compra: Date
    dias_estimados_restantes: number | null
  }>(SQL, [phone])
  const r = rows[0]
  if (!r) return { mensaje: 'student_not_found' }
  return {
    balance_actual: Math.round(Number(r.balance_actual)),
    gasto_diario_promedio: r.gasto_diario_avg,
    dias_con_compra_ultimos_30: r.dias_con_compra_30d,
    ultima_compra: r.ultima_compra,
    dias_estimados_restantes: r.dias_estimados_restantes,
  }
}
