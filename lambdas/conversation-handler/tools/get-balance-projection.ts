// Tool 4: get_balance_projection
// US-04 — proyección de agotamiento de saldo.
// Balance se computa on-the-fly como SUM(recargas) - SUM(ventas) por usuario_identificacion.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
WITH yo AS (
  -- Estudiante "principal" del padre = el con más compras totales.
  SELECT v.usuario_identificacion
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm
    ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
  GROUP BY 1
  ORDER BY COUNT(*) DESC, MAX(v.fecha) DESC, v.usuario_identificacion ASC
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
  -- Solo días hábiles (lun-vie). El estudiante no come en la cafetería sáb/dom.
  SELECT
    ROUND(SUM(v.importe) / NULLIF(COUNT(DISTINCT v.fecha), 0))::int AS gasto_diario_avg,
    COUNT(DISTINCT v.fecha)::int                                    AS dias_con_compra,
    MAX(v.fecha)                                                    AS ultima_compra
  FROM reto.ventas v, yo
  WHERE v.usuario_identificacion = yo.usuario_identificacion
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '30 days'
    AND EXTRACT(DOW FROM v.fecha) BETWEEN 1 AND 5
)
SELECT
  yo.usuario_identificacion,
  (recargas.total - gastos.total)::numeric          AS balance_actual,
  patron.gasto_diario_avg                           AS gasto_diario_avg_habil,
  patron.dias_con_compra                            AS dias_habiles_con_compra_30d,
  patron.ultima_compra                              AS ultima_compra,
  CASE
    WHEN patron.gasto_diario_avg IS NULL OR patron.gasto_diario_avg = 0 THEN NULL
    ELSE ROUND((recargas.total - gastos.total) / patron.gasto_diario_avg)::int
  END                                               AS dias_habiles_restantes
FROM yo, recargas, gastos, patron
`

export const def: Anthropic.Tool = {
  name: 'get_balance_projection',
  description: 'Calcula el saldo actual del estudiante (recargas totales menos consumos totales) y proyecta en cuántos DÍAS HÁBILES de cafetería se agota según su patrón de gasto. Los niños comen en la cafetería de lunes a viernes — todos los promedios y proyecciones están en días hábiles, no calendario. Útil cuando el padre pregunta por saldo o cuándo se acaba.',
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
    gasto_diario_avg_habil: number | null
    dias_habiles_con_compra_30d: number
    ultima_compra: Date
    dias_habiles_restantes: number | null
  }>(SQL, [phone])
  const r = rows[0]
  if (!r) return { mensaje: 'student_not_found' }
  return {
    balance_actual: Math.round(Number(r.balance_actual)),
    gasto_diario_promedio_habil: r.gasto_diario_avg_habil,
    dias_habiles_con_compra_ultimos_30: r.dias_habiles_con_compra_30d,
    ultima_compra: r.ultima_compra,
    dias_habiles_restantes: r.dias_habiles_restantes,
    nota_metodologica:
      'Todos los valores se miden en días hábiles (lun-vie). El estudiante no come en cafetería sáb/dom.',
  }
}
