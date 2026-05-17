// Tool 2: get_student_consumption_week
// Agregado últimos 7 días + top productos.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
WITH last7 AS (
  SELECT v.*
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm
    ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
)
SELECT
  (SELECT json_agg(t) FROM (
    SELECT nombre_producto, COUNT(*) AS veces, SUM(importe)::int AS gasto
    FROM last7
    GROUP BY 1
    ORDER BY veces DESC, gasto DESC
    LIMIT 5
  ) t) AS top_productos,
  COUNT(*)::int                              AS num_compras,
  COUNT(DISTINCT fecha)::int                 AS dias_con_compra,
  ROUND(SUM(importe))::int                   AS gasto_total,
  ROUND(AVG(importe))::int                   AS ticket_promedio
FROM last7
`

export const def: Anthropic.Tool = {
  name: 'get_student_consumption_week',
  description: 'Devuelve un agregado de las compras del estudiante en los últimos 7 días: top 5 productos, número de compras, días con compra, gasto total y ticket promedio.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<{
    top_productos: Array<{ nombre_producto: string, veces: number, gasto: number }> | null
    num_compras: number
    dias_con_compra: number
    gasto_total: number
    ticket_promedio: number
  }>(SQL, [phone])
  const r = rows[0]
  if (!r || r.num_compras === 0) {
    return { num_compras: 0, mensaje: 'no_purchases_this_week' }
  }
  return r
}
