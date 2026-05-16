// Tool 8: get_cafeteria_benchmark
// EXT-3 — benchmark del colegio vs. otros + insight cruzado (EXT-5) básico. ADMIN-only.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const ADMIN_CHECK_SQL = `
SELECT nit_colegio FROM bioalert.cafeteria_admins WHERE phone_e164 = $1 LIMIT 1
`

const BENCHMARK_SQL = `
WITH ventana AS (
  SELECT (MAX(fecha) - INTERVAL '7 days')::date AS desde
  FROM reto.ventas
),
mio AS (
  SELECT pn.category, COUNT(*) AS ventas
  FROM reto.ventas v, ventana w
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1 AND v.fecha >= w.desde
  GROUP BY 1
),
otros AS (
  SELECT pn.category,
         COUNT(*)::numeric / NULLIF(COUNT(DISTINCT v.nit_colegio), 0) AS avg_ventas_por_colegio
  FROM reto.ventas v, ventana w
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio <> $1 AND v.fecha >= w.desde
  GROUP BY 1
)
SELECT
  COALESCE(mio.category, otros.category) AS category,
  mio.ventas                             AS ventas_mias,
  ROUND(otros.avg_ventas_por_colegio)    AS avg_otros_colegios
FROM mio FULL OUTER JOIN otros USING (category)
ORDER BY ventas_mias DESC NULLS LAST
`

const FALTANTES_SQL = `
WITH ventana AS (SELECT (MAX(fecha) - INTERVAL '7 days')::date AS desde FROM reto.ventas)
SELECT v2.nombre_producto, COUNT(*) AS veces_en_otros
FROM reto.ventas v2, ventana w
LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v2.nombre_producto
WHERE v2.nit_colegio <> $1
  AND v2.fecha >= w.desde
  AND pn.category IN ('fruta','lacteo')
  AND NOT EXISTS (
    SELECT 1 FROM reto.ventas v3
    WHERE v3.nit_colegio = $1 AND v3.nombre_producto = v2.nombre_producto
  )
GROUP BY 1
ORDER BY 2 DESC
LIMIT 5
`

export const def: Anthropic.Tool = {
  name: 'get_cafeteria_benchmark',
  description: 'Devuelve benchmark del colegio del admin vs el promedio de otros colegios (ventas por categoría) y top productos saludables que tienen colegios similares pero faltan en el menú actual. SOLO disponible para admins.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const admin = await query<{ nit_colegio: string }>(ADMIN_CHECK_SQL, [phone])
  if (admin.length === 0) {
    return { error: 'not_admin' }
  }
  const nit = admin[0]!.nit_colegio
  const [benchmark, faltantes] = await Promise.all([
    query<{
      category: string | null
      ventas_mias: number | null
      avg_otros_colegios: number | null
    }>(BENCHMARK_SQL, [nit]),
    query<{ nombre_producto: string, veces_en_otros: number }>(FALTANTES_SQL, [nit]),
  ])
  return {
    nit_colegio: nit,
    ventana_dias: 7,
    benchmark_por_categoria: benchmark,
    productos_faltantes_saludables: faltantes,
  }
}
