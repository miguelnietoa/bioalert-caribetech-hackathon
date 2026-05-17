// Tool 5: get_recharge_recommendations
// EXT-1 — 3 opciones de recarga con narrativa data-driven y anchoring.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
WITH yo AS (
  SELECT
    v.usuario_identificacion,
    MAX(v.nombre_estudiante) AS nombre
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm
    ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
  GROUP BY 1
  ORDER BY MAX(v.fecha) DESC
  LIMIT 1
),
spend AS (
  SELECT
    AVG(v.importe)                                                          AS ticket_avg,
    SUM(v.importe)                                                          AS total_30d,
    SUM(v.importe) / NULLIF(COUNT(DISTINCT v.fecha), 0)                     AS gasto_diario_avg,
    COUNT(*) FILTER (WHERE pn.category IN ('dulce','snack'))::numeric * 100
      / NULLIF(COUNT(*), 0)                                                 AS pct_dulce
  FROM reto.ventas v, yo
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.usuario_identificacion = yo.usuario_identificacion
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '30 days'
),
balance AS (
  SELECT
    (COALESCE((
      SELECT SUM(r.valor) FROM reto.recargas r, yo
      WHERE r.usuario_identificacion = yo.usuario_identificacion
    ), 0) - COALESCE((
      SELECT SUM(v.importe) FROM reto.ventas v, yo
      WHERE v.usuario_identificacion = yo.usuario_identificacion
    ), 0))::numeric AS actual
)
SELECT
  yo.nombre                                  AS nombre_estudiante,
  ROUND(balance.actual)                      AS balance_actual,
  ROUND(spend.gasto_diario_avg)              AS gasto_diario_avg,
  ROUND(spend.total_30d)                     AS gasto_30d,
  ROUND(spend.ticket_avg)                    AS ticket_avg,
  ROUND(spend.pct_dulce, 1)                  AS pct_dulce
FROM yo, spend, balance
`

export const def: Anthropic.Tool = {
  name: 'get_recharge_recommendations',
  description: 'Calcula 3 opciones de recarga (Esencial / Equilibrada / Bienestar) personalizadas con narrativa data-driven basada en el patrón real del estudiante. SIEMPRE usar esta tool cuando el padre pregunte por recargar, montos sugeridos, o cuánto poner — NUNCA dar un solo monto.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<{
    nombre_estudiante: string
    balance_actual: number
    gasto_diario_avg: number | null
    gasto_30d: number | null
    ticket_avg: number | null
    pct_dulce: number | null
  }>(SQL, [phone])
  const r = rows[0]
  if (!r || r.gasto_diario_avg == null) {
    return { mensaje: 'insufficient_data_for_recommendation' }
  }

  const gastoDiario = Number(r.gasto_diario_avg)
  const pctDulce = r.pct_dulce ? Number(r.pct_dulce) : 0

  // Anchoring: tres opciones calibradas a horizonte temporal.
  const esencial = roundToThousand(gastoDiario * 14)             // 2 semanas
  const equilibrada = roundToThousand(gastoDiario * 30)          // 1 mes
  const bienestar = roundToThousand(gastoDiario * 30 * 1.4)      // 1 mes + margen para fruta/proteína

  return {
    nombre_estudiante: r.nombre_estudiante,
    saldo_actual: Math.round(Number(r.balance_actual)),
    patron: {
      gasto_diario_promedio: gastoDiario,
      pct_dulce_snack: pctDulce,
    },
    opciones: [
      {
        id: 'esencial',
        nombre: 'Esencial',
        monto: esencial,
        narrativa: `Cubre 2 semanas según el patrón real (~$${gastoDiario.toLocaleString('es-CO')}/día).`,
      },
      {
        id: 'equilibrada',
        nombre: 'Equilibrada',
        monto: equilibrada,
        narrativa: pctDulce > 30
          ? `Cubre el mes completo. El ${pctDulce.toFixed(0)}% del consumo va a snack/dulce — vale la pena tener visibilidad mensual en vez de recargar semana a semana.`
          : 'Cubre el mes completo. Una sola recarga, sin pensarlo más.',
      },
      {
        id: 'bienestar',
        nombre: 'Bienestar',
        monto: bienestar,
        narrativa: 'Cubre el mes completo + margen para priorizar fruta o proteína cuando la cafetería las tenga.',
      },
    ],
  }
}
