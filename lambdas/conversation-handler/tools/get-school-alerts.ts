// Tool 7: get_school_alerts
// US-05 — alertas de stock crítico. ADMIN-only.

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const ADMIN_CHECK_SQL = `
SELECT nit_colegio FROM bioalert.cafeteria_admins WHERE phone_e164 = $1 LIMIT 1
`

const ALERTS_SQL = `
SELECT
  i.nombre_producto,
  i.current_stock,
  i.minimum_stock,
  ROUND(100.0 * i.current_stock / NULLIF(i.minimum_stock, 0))::int AS pct_del_minimo
FROM bioalert.inventory i
WHERE i.nit_colegio = $1
  AND i.current_stock <= i.minimum_stock
ORDER BY pct_del_minimo ASC NULLS LAST, i.current_stock ASC
LIMIT 50
`

export const def: Anthropic.Tool = {
  name: 'get_school_alerts',
  description: 'Devuelve productos en stock crítico (por debajo del mínimo configurado) del colegio del admin de cafetería. SOLO disponible si el teléfono es de un admin de cafetería; devuelve error si lo invoca un padre.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const admin = await query<{ nit_colegio: string }>(ADMIN_CHECK_SQL, [phone])
  if (admin.length === 0) {
    return { error: 'not_admin', mensaje: 'Esta tool solo está disponible para admins de cafetería.' }
  }
  const rows = await query<{
    nombre_producto: string
    current_stock: number
    minimum_stock: number
    pct_del_minimo: number | null
  }>(ALERTS_SQL, [admin[0]!.nit_colegio])
  return {
    nit_colegio: admin[0]!.nit_colegio,
    num_productos_criticos: rows.length,
    productos: rows,
  }
}
