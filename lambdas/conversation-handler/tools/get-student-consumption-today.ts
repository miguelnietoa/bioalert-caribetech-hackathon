// Tool 1: get_student_consumption_today
// US-01 — ¿qué comió mi hijo hoy?

import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
SELECT
  v.fecha,
  v.nombre_producto,
  v.cantidad,
  v.importe
FROM reto.ventas v
JOIN bioalert.parent_phone_map ppm
  ON ppm.identificacion_padre = v.identificacion_padre
WHERE ppm.phone_e164 = $1
  AND v.fecha = ((now() AT TIME ZONE 'America/Bogota')::date)
ORDER BY v.fecha DESC
LIMIT 20
`

export const def: Anthropic.Tool = {
  name: 'get_student_consumption_today',
  description: 'Devuelve la lista de compras del estudiante vinculado al teléfono del padre durante el día de hoy (timezone America/Bogota). Si no hay compras hoy, devuelve mensaje no_purchases_today. Incluye nombre del producto, cantidad y monto.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

interface Row {
  fecha: Date
  nombre_producto: string
  cantidad: number
  importe: number
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<Row>(SQL, [phone])
  if (rows.length === 0) {
    return { compras: [], total: 0, mensaje: 'no_purchases_today' }
  }
  const total = rows.reduce((sum, r) => sum + Number(r.importe), 0)
  return {
    fecha: rows[0]!.fecha,
    compras: rows.map(r => ({
      hora: new Date(r.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      producto: r.nombre_producto,
      cantidad: r.cantidad,
      importe: Number(r.importe),
    })),
    total,
    num_transacciones: rows.length,
  }
}
