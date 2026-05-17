import { execSync } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import pg from 'pg'

const STAGE = process.env.STAGE ?? 'hackathon'
const NIT_COLEGIO = process.env.NIT_COLEGIO ?? '900000680'
const TOP_N = parseInt(process.env.TOP_N ?? '150', 10)
const PROFILE = process.env.AWS_PROFILE ?? 'biofood-hackathon'
const REGION = process.env.AWS_REGION ?? 'us-east-1'

function ssm(name: string): string {
  return execSync(
    `aws ssm get-parameter --name /bioalert/${STAGE}/${name} --with-decryption ` +
      `--query Parameter.Value --output text --profile ${PROFILE} --region ${REGION}`,
    { encoding: 'utf8' },
  ).trim()
}

const pool = new pg.Pool({
  host: ssm('db/host'),
  port: parseInt(ssm('db/port'), 10),
  database: 'bioalert',
  user: 'bioalert_app',
  password: ssm('db/password'),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const apiKey = ssm('anthropic/api-key')
  if (apiKey === 'REPLACE_ME') {
    throw new Error(
      'anthropic/api-key en SSM sigue en REPLACE_ME — pedí la key real a Miguel y actualizá SSM',
    )
  }
  const claude = new Anthropic({ apiKey })

  console.log(`→ Top ${TOP_N} productos del colegio ${NIT_COLEGIO}`)
  const { rows: productos } = await pool.query<{
    nombre_producto: string
    veces: number
  }>(
    `
    SELECT nombre_producto, COUNT(*)::int AS veces
    FROM reto.ventas
    WHERE nit_colegio = $1
      AND fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '90 days'
    GROUP BY nombre_producto
    ORDER BY veces DESC
    LIMIT $2
  `,
    [NIT_COLEGIO, TOP_N],
  )

  console.log('→ Pidiendo a Claude estimación nutricional (~30s)...')
  const list = productos
    .map((p, i) => `${i + 1}. ${p.nombre_producto}`)
    .join('\n')
  const prompt = `Te paso una lista de productos vendidos en cafeterías escolares de Colombia.
Para cada producto, devuélveme JSON con estos campos:
- "nombre_producto": EXACTAMENTE como te lo pasé (sin modificar)
- "canonical_name": nombre normalizado (sin tildes, lowercase)
- "category": una de: "snack", "bebida", "dulce", "fruta", "comida", "lacteo", "otro"
- "calories_100g", "sugar_g", "fat_g", "protein_g", "sodium_mg": valores estimados por 100g
- "gramos_por_unidad": peso o volumen típico de UNA unidad (entero o decimal). Crítico para cálculos.
  Ejemplos: una galleta Chokis = 30, jugo Hit caja 200ml = 200, paleta Jet = 20, gaseosa 350ml = 350,
  empanada = 80, agua 600ml = 600, bombón = 10, dedito de queso = 25. Si no estás seguro, da una
  estimación razonable de cuánto pesa o contiene una unidad típica vendida en cafetería escolar.

Productos:
${list}

Responde SOLO con un JSON array.`

  const res = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = res.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('no text in Claude response')
  }
  const text = textBlock.text.trim()
  const jsonStart = text.indexOf('[')
  const jsonEnd = text.lastIndexOf(']') + 1
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd)) as Array<{
    nombre_producto: string
    canonical_name: string
    category: string
    calories_100g: number
    sugar_g: number
    fat_g: number
    protein_g: number
    sodium_mg: number
    gramos_por_unidad: number
  }>

  console.log(`→ Insertando ${parsed.length} filas en bioalert.product_nutrition...`)
  for (const p of parsed) {
    await pool.query(
      `
      INSERT INTO bioalert.product_nutrition
        (nombre_producto, canonical_name, category,
         calories_100g, sugar_g, fat_g, protein_g, sodium_mg, gramos_por_unidad)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (nombre_producto) DO UPDATE SET
        canonical_name    = EXCLUDED.canonical_name,
        category          = EXCLUDED.category,
        calories_100g     = EXCLUDED.calories_100g,
        sugar_g           = EXCLUDED.sugar_g,
        fat_g             = EXCLUDED.fat_g,
        protein_g         = EXCLUDED.protein_g,
        sodium_mg         = EXCLUDED.sodium_mg,
        gramos_por_unidad = EXCLUDED.gramos_por_unidad,
        estimated_at      = now()
    `,
      [
        p.nombre_producto,
        p.canonical_name,
        p.category,
        p.calories_100g,
        p.sugar_g,
        p.fat_g,
        p.protein_g,
        p.sodium_mg,
        p.gramos_por_unidad,
      ],
    )
  }
  console.log('✅ done')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
