// Tool 3: get_nutrition_summary
// EXT-2 — calorías, azúcar, grasa, sodio del estudiante en una ventana.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
WITH consumo AS (
  SELECT
    v.fecha,
    v.cantidad,
    v.importe,
    pn.calories_100g,
    pn.sugar_g,
    pn.fat_g,
    pn.sodium_mg,
    pn.category
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm
    ON ppm.identificacion_padre = v.identificacion_padre
  LEFT JOIN bioalert.product_nutrition pn
    ON pn.nombre_producto = v.nombre_producto
  WHERE ppm.phone_e164 = $1
    AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - ($2 || ' days')::interval
)
SELECT
  COUNT(*)::int                                                              AS num_compras,
  COUNT(*) FILTER (WHERE calories_100g IS NULL)::int                         AS productos_sin_nutricion,
  ROUND(SUM(COALESCE(calories_100g, 0) * cantidad / 100.0))::int             AS total_calories,
  ROUND(SUM(COALESCE(sugar_g, 0)       * cantidad / 100.0)::numeric, 1)      AS total_sugar_g,
  ROUND(SUM(COALESCE(fat_g, 0)         * cantidad / 100.0)::numeric, 1)      AS total_fat_g,
  ROUND(SUM(COALESCE(sodium_mg, 0)     * cantidad / 100.0))::int             AS total_sodium_mg,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE category IN ('dulce','snack'))
    / NULLIF(COUNT(*), 0)::numeric, 1
  )                                                                          AS pct_dulce_snack
FROM consumo
`

export const def: Anthropic.Tool = {
  name: 'get_nutrition_summary',
  description: 'Devuelve agregado nutricional del estudiante en una ventana de tiempo (calorías, azúcar, grasa, sodio total) más el % de compras en categoría dulce/snack. Útil para responder preguntas sobre nutrición o azúcar.',
  input_schema: {
    type: 'object',
    properties: {
      days: {
        type: 'integer',
        minimum: 1,
        maximum: 30,
        description: 'Cantidad de días hacia atrás para calcular el agregado (default 7).',
      },
    },
    required: [],
  },
}

export async function handler(input: unknown, phone: string): Promise<unknown> {
  const days = Math.min(30, Math.max(1, (input as { days?: number } | undefined)?.days ?? 7))
  const rows = await query<{
    num_compras: number
    productos_sin_nutricion: number
    total_calories: number
    total_sugar_g: number
    total_fat_g: number
    total_sodium_mg: number
    pct_dulce_snack: number
  }>(SQL, [phone, days])
  const r = rows[0]
  if (!r || r.num_compras === 0) {
    return { mensaje: 'no_purchases_in_window', days }
  }
  return { ventana_dias: days, ...r }
}
