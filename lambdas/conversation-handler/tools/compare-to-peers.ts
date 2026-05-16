// Tool 6: compare_to_peers
// EXT-2 — comparación del estudiante contra promedio del colegio (no grado — no existe).

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
WITH yo AS (
  SELECT
    v.usuario_identificacion,
    v.nit_colegio,
    MAX(v.nombre_estudiante) AS nombre
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm
    ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
  GROUP BY 1, 2
  ORDER BY MAX(v.fecha) DESC
  LIMIT 1
),
mis_stats AS (
  SELECT
    COUNT(*)::int                                                     AS compras,
    ROUND(SUM(v.importe))::int                                        AS gasto_total,
    ROUND(AVG(v.importe))::int                                        AS ticket_avg,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE pn.category IN ('dulce','snack'))
      / NULLIF(COUNT(*), 0)::numeric, 1
    )                                                                 AS pct_dulce
  FROM reto.ventas v, yo
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.usuario_identificacion = yo.usuario_identificacion
    AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '30 days'
),
peers_stats AS (
  SELECT
    ROUND(AVG(s.compras))::int                                        AS compras,
    ROUND(AVG(s.gasto))::int                                          AS gasto_total,
    ROUND(AVG(s.ticket))::int                                         AS ticket_avg,
    ROUND(AVG(s.pct_dulce)::numeric, 1)                               AS pct_dulce
  FROM (
    SELECT
      v.usuario_identificacion,
      COUNT(*)::numeric                                               AS compras,
      SUM(v.importe)                                                  AS gasto,
      AVG(v.importe)                                                  AS ticket,
      100.0 * COUNT(*) FILTER (WHERE pn.category IN ('dulce','snack'))
        / NULLIF(COUNT(*), 0)                                         AS pct_dulce
    FROM reto.ventas v, yo
    LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
    WHERE v.nit_colegio = yo.nit_colegio
      AND v.usuario_identificacion <> yo.usuario_identificacion
      AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '30 days'
    GROUP BY 1
  ) s
)
SELECT
  yo.nombre        AS nombre_estudiante,
  mis_stats.compras       AS mi_compras,        peers_stats.compras       AS peer_avg_compras,
  mis_stats.gasto_total   AS mi_gasto_total,    peers_stats.gasto_total   AS peer_avg_gasto_total,
  mis_stats.ticket_avg    AS mi_ticket_avg,     peers_stats.ticket_avg    AS peer_avg_ticket,
  mis_stats.pct_dulce     AS mi_pct_dulce,      peers_stats.pct_dulce     AS peer_avg_pct_dulce
FROM yo, mis_stats, peers_stats
`

export const def: Anthropic.Tool = {
  name: 'compare_to_peers',
  description: 'Compara las métricas del estudiante (compras, gasto, ticket, % dulce) contra el promedio de compañeros del mismo colegio en los últimos 30 días. Útil para responder "está comiendo mucho azúcar?" o "está gastando mucho?".',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<Record<string, unknown>>(SQL, [phone])
  const r = rows[0]
  if (!r) return { mensaje: 'student_not_found' }
  return r
}
