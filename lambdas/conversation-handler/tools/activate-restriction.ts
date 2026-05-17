import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SUGGESTIONS: Record<string, string> = {
  bebida: 'Si pide gaseosa, recomienda agua fría o jugo natural como mejor opción del día. Sin mencionar restricción.',
  dulce:  'Sugiere fruta fresca (banano, manzana) o yogurt como postre. Sin mencionar restricción.',
  snack:  'Recomienda barra de cereal, fruta o lácteo como snack. Sin mencionar restricción.',
  comida: 'Sugiere opción ligera (ensalada, fruta, yogurt). Sin mencionar restricción.',
  lacteo: 'Sugiere lácteo bajo en azúcar o fruta como alternativa.',
}

const STUDENT_SQL = `
SELECT v.usuario_identificacion, MAX(v.nombre_estudiante) AS nombre_estudiante
FROM reto.ventas v
JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = v.identificacion_padre
WHERE ppm.phone_e164 = $1
GROUP BY 1
ORDER BY COUNT(*) DESC, MAX(v.fecha) DESC, v.usuario_identificacion ASC
LIMIT 1
`

const DEACTIVATE_PREVIOUS_SQL = `
UPDATE bioalert.restrictions
SET active = false
WHERE usuario_identificacion = $1
  AND category = $2
  AND active = true
`

const INSERT_SQL = `
INSERT INTO bioalert.restrictions
  (usuario_identificacion, nombre_estudiante, category, type, cafeteria_message, expires_at)
VALUES ($1, $2, $3, 'limit', $4,
  CASE WHEN $5::int IS NULL THEN NULL ELSE now() + ($5::int * INTERVAL '1 day') END)
RETURNING id, expires_at
`

const ACK_SQL = `
UPDATE bioalert.streaks
SET parent_action = 'restricted'
WHERE usuario_identificacion = $1
  AND category = $2
  AND parent_action IS NULL
`

export const def: Anthropic.Tool = {
  name: 'activate_restriction',
  description: 'Crea una restricción "sutil" para una categoría: la cafetería verá una sugerencia para ofrecer alternativas sin mencionar restricción. Usar SOLO cuando el padre confirme categoría + duración explícita. Duración en días (7=1 semana, 30=1 mes, null=indefinida).',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['bebida', 'dulce', 'snack', 'comida', 'lacteo'],
        description: 'Categoría a restringir (bebida, dulce, snack, comida, lacteo).',
      },
      duration_days: {
        type: ['integer', 'null'],
        description: 'Días de vigencia. 7 = 1 semana, 30 = 1 mes, null = indefinida hasta que el padre la quite.',
      },
    },
    required: ['category', 'duration_days'],
  },
}

interface Input { category: string; duration_days: number | null }

export async function handler(input: unknown, phone: string): Promise<unknown> {
  const { category, duration_days } = input as Input
  if (!category) return { error: 'missing_category' }

  const studentRows = await query<{ usuario_identificacion: string; nombre_estudiante: string | null }>(STUDENT_SQL, [phone])
  const student = studentRows[0]
  if (!student) return { error: 'no_student_for_parent' }

  const message = SUGGESTIONS[category] ?? `Sugerencia: ofrece una alternativa saludable en ${category}.`

  // Idempotencia: desactiva cualquier restricción activa previa de la misma categoría.
  await query(DEACTIVATE_PREVIOUS_SQL, [student.usuario_identificacion, category])

  const inserted = await query<{ id: number; expires_at: string | null }>(INSERT_SQL, [
    student.usuario_identificacion,
    student.nombre_estudiante,
    category,
    message,
    duration_days,
  ])

  // Marcar streak relacionada como 'restricted' si existe.
  await query(ACK_SQL, [student.usuario_identificacion, category])

  return {
    restriccion_id: inserted[0]?.id,
    categoria: category,
    duracion_dias: duration_days,
    expira_el: inserted[0]?.expires_at,
    mensaje_para_cafeteria: message,
    estudiante: student.nombre_estudiante,
  }
}
