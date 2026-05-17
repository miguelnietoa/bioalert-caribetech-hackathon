import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

const SQL = `
SELECT substitute_product, substitute_category, pitch
FROM bioalert.category_substitutes
WHERE category_restricted = $1
ORDER BY substitute_product
`

export const def: Anthropic.Tool = {
  name: 'get_substitutes',
  description: 'Devuelve los productos sustitutos saludables sugeridos para una categoría restringida. Usar cuando el padre pregunta "¿qué alternativas hay para X?", "¿qué le puedo dar en vez de gaseosa?", o tras activate_restriction para mostrar opciones.',
  input_schema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Categoría restringida (bebida, dulce, snack, comida, lacteo).' },
    },
    required: ['category'],
  },
}

interface Input { category: string }

export async function handler(input: unknown, phone: string): Promise<unknown> {
  void phone
  const { category } = input as Input
  if (!category) return { error: 'missing_category' }
  const rows = await query<{ substitute_product: string; substitute_category: string; pitch: string }>(SQL, [category])
  if (rows.length === 0) return { mensaje: 'no_substitutes_for_category', categoria: category }
  return {
    categoria: category,
    sustitutos: rows.map(r => ({ producto: r.substitute_product, categoria: r.substitute_category, pitch: r.pitch })),
  }
}
