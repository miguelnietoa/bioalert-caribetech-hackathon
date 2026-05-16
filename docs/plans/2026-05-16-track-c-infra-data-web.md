# Track C — Infra + Data + Web — Implementation Plan

> **For Jose Maza:** Seguí este plan task-por-task. Los otros 2 devs (Miguel y Jose Arcila) te necesitan **vivo** hasta H+4 (cuando `lambdas/shared/*` esté commiteado). Después ya corren en paralelo. Si te bloqueás, avisá en el canal del equipo en <15 min.
>
> Referencia transversal: [`../team-plan.md`](../team-plan.md), [`../db-schema.md`](../db-schema.md), [`../../CLAUDE.md`](../../CLAUDE.md).

**Goal:** Aprovisionar toda la infra AWS (RDS, DynamoDB, SSM), poblar la DB con el dataset del reto + fixtures + nutrición vía Claude, escribir las utilidades compartidas que consumen Miguel y Jose Arcila, y publicar 2 vistas web estáticas en S3+CloudFront.

**Architecture:** Stack único en Serverless Framework v4. Postgres en RDS con dos schemas: `reto` (clon tipado del reto) y `bioalert` (fixtures nuestros). DynamoDB para sesiones del bot. Las Lambdas se conectan vía `pg.Pool` cacheado a nivel módulo (sin RDS Proxy en H0 — opcional al final). Vistas web son HTML+Chart.js con data pre-generada en JSON y subida por las Lambdas semanales a S3.

**Tech stack:** Node.js 20, TypeScript, Serverless Framework v4, AWS SDK v3, `pg`, `@anthropic-ai/sdk`, esbuild, Chart.js.

---

## Pre-requisitos antes de arrancar

- AWS profile `biofood-hackathon` configurado (verificable con `aws sts get-caller-identity --profile biofood-hackathon` → devuelve account `642722971137`).
- Node.js 20+ instalado (`node --version`).
- `psql` instalado (`brew install postgresql` si falta).
- Clonaste el repo y estás en `main`, branch limpia.

---

## Task 1: Bootstrap del entorno local

**Files:**
- Read: `package.json`, `serverless.yml`

**Step 1: Instalar dependencias**

```bash
npm install
```

Expected: completa sin errores. `node_modules/` aparece. `package-lock.json` se crea/actualiza.

**Step 2: Verificar Serverless Framework**

```bash
npx serverless --version
```

Expected: imprime `Framework Core: 4.x.x` o similar.

**Step 3: Commit el lockfile**

```bash
git add package-lock.json
git commit -m "chore: lock npm deps"
git push
```

---

## Task 2: Crear SSM parameters

**Files:**
- Run: `scripts/bootstrap-ssm.sh`

**Step 1: Correr el script**

```bash
./scripts/bootstrap-ssm.sh
```

Expected output (líneas):
```
✅ created /bioalert/hackathon/db/password
✅ created /bioalert/hackathon/anthropic/api-key
✅ created /bioalert/hackathon/kapso/api-key
✅ created /bioalert/hackathon/kapso/webhook-secret
✅ created /bioalert/hackathon/kapso/sandbox-number
```

(Si dice `⏭️ already exists` para alguno, OK — significa que se corrió antes.)

**Step 2: Pisar placeholders con valores reales**

Los valores reales de Kapso y Anthropic te los pasa Miguel por canal privado. Una vez los tengas:

```bash
STAGE=hackathon
AP=biofood-hackathon
AR=us-east-1

aws ssm put-parameter --name /bioalert/$STAGE/anthropic/api-key \
  --value 'sk-ant-...REAL...' --type SecureString --overwrite \
  --profile $AP --region $AR

aws ssm put-parameter --name /bioalert/$STAGE/kapso/api-key \
  --value 'kapso_...' --type SecureString --overwrite \
  --profile $AP --region $AR

aws ssm put-parameter --name /bioalert/$STAGE/kapso/webhook-secret \
  --value 'whsec_...' --type SecureString --overwrite \
  --profile $AP --region $AR

aws ssm put-parameter --name /bioalert/$STAGE/kapso/sandbox-number \
  --value '+1XXXXXXXXXX' --type SecureString --overwrite \
  --profile $AP --region $AR
```

**Step 3: Verificar**

```bash
aws ssm get-parameters-by-path --path /bioalert/hackathon/ --recursive \
  --query 'Parameters[].Name' --output table \
  --profile biofood-hackathon --region us-east-1
```

Expected: lista de 5 paths.

---

## Task 3: Desplegar infra

**Files:**
- Run: `serverless deploy`

**Step 1: Deploy**

```bash
npx serverless deploy --stage hackathon
```

Expected: tarda ~10 min (RDS provisioning es lento). Al final imprime "Service Information" con stack name `bioalert-hackathon` y un Outputs section con `DBEndpoint: bioalert-hackathon....rds.amazonaws.com`.

**Step 2: Anunciar en el canal del equipo**

> ✅ Infra deployed. RDS endpoint: `<endpoint>`. Devs 1 y 2 pueden empezar a apuntar a SSM.

**Step 3: Verificar conexión a RDS**

```bash
RDS_HOST=$(aws ssm get-parameter --name /bioalert/hackathon/db/host \
  --query Parameter.Value --output text \
  --profile biofood-hackathon --region us-east-1)

RDS_PASSWORD=$(aws ssm get-parameter --name /bioalert/hackathon/db/password \
  --with-decryption --query Parameter.Value --output text \
  --profile biofood-hackathon --region us-east-1)

PGPASSWORD="$RDS_PASSWORD" psql -h "$RDS_HOST" -U bioalert_app -d bioalert \
  -c "SELECT version();"
```

Expected: `PostgreSQL 15.7 on aarch64-...`.

---

## Task 4: Aplicar schema + ETL del reto

**Files:**
- Run: `scripts/apply-schema.sh`, `scripts/etl-reto-to-rds.sh`

**Step 1: Aplicar schema**

```bash
./scripts/apply-schema.sh
```

Expected: imprime las tablas creadas (`reto.ventas`, `reto.recargas`, 6 tablas `bioalert.*`).

**Step 2: ETL**

```bash
./scripts/etl-reto-to-rds.sh
```

Expected (~2 min):
```
→ ETL hackaton_ventas → reto.ventas (~4.26M filas...
real    ~60-90s
→ ETL hackaton_recargas → reto.recargas...
real    ~10s
 tabla         | filas
---------------+--------
 reto.ventas   | 4257396
 reto.recargas |  305218
```

**Step 3: Commit (nada nuevo en repo, solo anunciar)**

> ✅ ETL done. 4.26M ventas + 305k recargas con tipos limpios e índices.

---

## Task 5: `lambdas/shared/types.ts`

**Files:**
- Create: `lambdas/shared/types.ts`

**Step 1: Escribir tipos compartidos**

```typescript
// lambdas/shared/types.ts
export interface Venta {
  id: number
  usuario_identificacion: string
  nombre_estudiante: string | null
  fecha: Date
  cantidad: number
  precio: number
  importe: number
  nombre_producto: string
  identificacion_padre: string | null
  nombre_padre: string | null
  colegio: string
  nit_colegio: string
}

export interface Recarga {
  id: number
  usuario_identificacion: string
  nombre_estudiante: string | null
  fecha: Date
  valor: number
  identificacion_padre: string | null
  nombre_padre: string | null
  colegio: string
  nit_colegio: string
}

export interface ParentPhone {
  identificacion_padre: string
  phone_e164: string
  nombre_padre: string | null
}

export interface ProductNutrition {
  nombre_producto: string
  canonical_name: string | null
  category: string | null
  calories_100g: number | null
  sugar_g: number | null
  fat_g: number | null
  protein_g: number | null
  sodium_mg: number | null
}

export interface ConversationSession {
  phone_e164: string
  history: Array<{ role: 'user' | 'assistant', content: string }>
  identity?: { kind: 'parent', usuario_identificacion: string }
               | { kind: 'admin',  nit_colegio: string }
  expires_at: number  // unix epoch seconds, DynamoDB TTL
}

export interface WhatsAppInboundMessage {
  from: string         // phone E.164
  text: string         // concat de mensajes debounced
  timestamp: string    // ISO
  raw: unknown         // payload completo para debug
}

export interface WhatsAppButton {
  id: string           // payload value
  title: string        // texto visible (≤20 chars)
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

**Step 3: Commit**

```bash
git add lambdas/shared/types.ts
git commit -m "feat(shared): tipos compartidos para Lambdas"
git push
```

---

## Task 6: `lambdas/shared/ssm.ts` — loader de secrets

**Files:**
- Create: `lambdas/shared/ssm.ts`

**Step 1: Escribir**

```typescript
// lambdas/shared/ssm.ts
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm'

const STAGE = process.env.STAGE ?? 'hackathon'
const REGION = process.env.AWS_REGION ?? 'us-east-1'
const client = new SSMClient({ region: REGION })

let cache: Record<string, string> | null = null

export async function getSecret(name: string): Promise<string> {
  if (!cache) {
    const out = await client.send(new GetParametersByPathCommand({
      Path: `/bioalert/${STAGE}/`,
      Recursive: true,
      WithDecryption: true,
    }))
    cache = {}
    for (const p of out.Parameters ?? []) {
      if (p.Name && p.Value) {
        const key = p.Name.replace(`/bioalert/${STAGE}/`, '')
        cache[key] = p.Value
      }
    }
  }
  const value = cache[name]
  if (!value) throw new Error(`SSM secret missing: ${name}`)
  return value
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

**Step 3: Commit**

```bash
git add lambdas/shared/ssm.ts
git commit -m "feat(shared): SSM secret loader con cache"
git push
```

---

## Task 7: `lambdas/shared/db.ts` — pg pool con cache

**Files:**
- Create: `lambdas/shared/db.ts`

**Step 1: Escribir**

```typescript
// lambdas/shared/db.ts
import pg from 'pg'
import { getSecret } from './ssm.js'

let pool: pg.Pool | null = null

export async function getDbPool(): Promise<pg.Pool> {
  if (pool) return pool
  const host = await getSecret('db/host')
  const port = await getSecret('db/port')
  const password = await getSecret('db/password')
  pool = new pg.Pool({
    host,
    port: parseInt(port, 10),
    database: 'bioalert',
    user: 'bioalert_app',
    password,
    max: 1,             // 1 conexión por Lambda instance — RDS Proxy go to 10 si lo activamos
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
  return pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const p = await getDbPool()
  const { rows } = await p.query<T>(sql, params)
  return rows
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

**Step 3: Commit**

```bash
git add lambdas/shared/db.ts
git commit -m "feat(shared): pg pool con SSM y query<T> helper"
git push
```

---

## Task 8: `lambdas/shared/whatsapp.ts` — Kapso client

**Files:**
- Create: `lambdas/shared/whatsapp.ts`

**Step 1: Escribir**

```typescript
// lambdas/shared/whatsapp.ts
// Abstracción sobre el canal de mensajería. Provider primario: Kapso.
// Si toca migrar a Twilio o Meta Cloud API directa, solo este archivo cambia.

import crypto from 'node:crypto'
import { getSecret } from './ssm.js'
import type { WhatsAppButton } from './types.js'

const KAPSO_BASE = 'https://api.kapso.ai/platform/v1'

async function authHeaders(): Promise<Record<string, string>> {
  const apiKey = await getSecret('kapso/api-key')
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${KAPSO_BASE}/whatsapp/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, type: 'text', text: { body } }),
  })
  if (!res.ok) throw new Error(`Kapso sendText failed: ${res.status} ${await res.text()}`)
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: WhatsAppButton[],
): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${KAPSO_BASE}/whatsapp/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`Kapso sendButtons failed: ${res.status} ${await res.text()}`)
}

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signatureHeader) return false
  const secret = await getSecret('kapso/webhook-secret')
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader),
  )
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

**Step 3: Commit**

```bash
git add lambdas/shared/whatsapp.ts
git commit -m "feat(shared): Kapso WhatsApp client + signature verify"
git push
```

---

## Task 9: `lambdas/shared/claude.ts` — Anthropic client

**Files:**
- Create: `lambdas/shared/claude.ts`

**Step 1: Escribir**

```typescript
// lambdas/shared/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import { getSecret } from './ssm.js'

let client: Anthropic | null = null

export async function getClaude(): Promise<Anthropic> {
  if (client) return client
  const apiKey = await getSecret('anthropic/api-key')
  client = new Anthropic({ apiKey })
  return client
}

export const MODEL_CONVERSATIONAL = 'claude-sonnet-4-6'
export const MODEL_BATCH = 'claude-haiku-4-5-20251001'

export async function chatWithTools(opts: {
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
  model?: string
  maxTokens?: number
}): Promise<Anthropic.Message> {
  const c = await getClaude()
  return c.messages.create({
    model: opts.model ?? MODEL_CONVERSATIONAL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.systemPrompt,
    tools: opts.tools,
    messages: opts.messages,
  })
}
```

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

**Step 3: Commit**

```bash
git add lambdas/shared/claude.ts
git commit -m "feat(shared): Claude client con modelos por uso"
git push
```

---

## Task 10: `lambdas/shared/dynamo-conversations.ts` y `logger.ts`

**Files:**
- Create: `lambdas/shared/dynamo-conversations.ts`
- Create: `lambdas/shared/logger.ts`

**Step 1: Escribir `logger.ts`**

```typescript
// lambdas/shared/logger.ts
type LogLevel = 'info' | 'warn' | 'error'
function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  }))
}
export const logger = {
  info:  (m: string, f?: Record<string, unknown>) => log('info', m, f),
  warn:  (m: string, f?: Record<string, unknown>) => log('warn', m, f),
  error: (m: string, f?: Record<string, unknown>) => log('error', m, f),
}
```

**Step 2: Escribir `dynamo-conversations.ts`**

```typescript
// lambdas/shared/dynamo-conversations.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { ConversationSession } from './types.js'

const STAGE = process.env.STAGE ?? 'hackathon'
const TABLE = `bioalert-conversations-${STAGE}`
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export async function getSession(phone_e164: string): Promise<ConversationSession | null> {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { phone_e164 } }))
  return (out.Item as ConversationSession | undefined) ?? null
}

export async function putSession(s: ConversationSession): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 60 * 60   // 1h TTL
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { ...s, expires_at: ttl },
  }))
}
```

**Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add lambdas/shared/logger.ts lambdas/shared/dynamo-conversations.ts
git commit -m "feat(shared): logger estructurado + dynamo sessions"
git push
```

**Step 4: ANUNCIO AL EQUIPO (CRÍTICO)**

> ✅ `lambdas/shared/*` listo (db, ssm, whatsapp, claude, dynamo, logger, types). Miguel y Jose Arcila pueden arrancar sus Lambdas.

---

## Task 11: `scripts/bootstrap-nutrition.ts`

**Files:**
- Create: `scripts/bootstrap-nutrition.ts`
- Modify: `package.json` (agregar script `"nutrition:bootstrap"`)

**Step 1: Escribir el script**

```typescript
// scripts/bootstrap-nutrition.ts
// Lee top-N productos del colegio piloto del schema reto, le pide a Claude
// estimación nutricional + canonical_name + categoría, y persiste en bioalert.product_nutrition.

import pg from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'node:child_process'

const STAGE = process.env.STAGE ?? 'hackathon'
const NIT_COLEGIO = process.env.NIT_COLEGIO ?? '900000680'   // default piloto
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
})

const claude = new Anthropic({ apiKey: ssm('anthropic/api-key') })

async function main() {
  console.log(`→ Top ${TOP_N} productos del colegio ${NIT_COLEGIO}`)
  const { rows: productos } = await pool.query<{ nombre_producto: string, veces: number }>(`
    SELECT nombre_producto, COUNT(*) AS veces
    FROM reto.ventas
    WHERE nit_colegio = $1 AND fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '90 days'
    GROUP BY nombre_producto
    ORDER BY veces DESC
    LIMIT $2
  `, [NIT_COLEGIO, TOP_N])

  console.log(`→ Pidiendo a Claude estimación nutricional (puede tardar ~30s)...`)
  const list = productos.map((p, i) => `${i+1}. ${p.nombre_producto}`).join('\n')
  const prompt = `Te paso una lista de productos vendidos en cafeterías escolares de Colombia.
Para cada producto, devuélveme JSON con estos campos:
- "nombre_producto": EXACTAMENTE como te lo pasé (sin modificar)
- "canonical_name": nombre normalizado (sin tildes, lowercase, agrupando variantes ortográficas — ej. "dedito queso", "dedito de queso horneado" → ambos canonical "dedito queso")
- "category": una de: "snack", "bebida", "dulce", "fruta", "comida", "lacteo", "otro"
- "calories_100g", "sugar_g", "fat_g", "protein_g", "sodium_mg": valores estimados por 100g

Productos:
${list}

Responde SOLO con un JSON array, nada más. Ejemplo:
[{"nombre_producto":"DEDITO QUESO","canonical_name":"dedito queso","category":"snack","calories_100g":380,"sugar_g":2,"fat_g":18,"protein_g":12,"sodium_mg":480}, ...]`

  const res = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = res.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('no text in response')
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
  }>

  console.log(`→ Insertando ${parsed.length} filas en bioalert.product_nutrition...`)
  for (const p of parsed) {
    await pool.query(`
      INSERT INTO bioalert.product_nutrition
        (nombre_producto, canonical_name, category,
         calories_100g, sugar_g, fat_g, protein_g, sodium_mg)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (nombre_producto) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        category       = EXCLUDED.category,
        calories_100g  = EXCLUDED.calories_100g,
        sugar_g        = EXCLUDED.sugar_g,
        fat_g          = EXCLUDED.fat_g,
        protein_g      = EXCLUDED.protein_g,
        sodium_mg      = EXCLUDED.sodium_mg,
        estimated_at   = now()
    `, [p.nombre_producto, p.canonical_name, p.category,
        p.calories_100g, p.sugar_g, p.fat_g, p.protein_g, p.sodium_mg])
  }
  console.log('✅ done')
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
```

**Step 2: Agregar npm script**

En `package.json`, sección `scripts`, agregá:
```json
"nutrition:bootstrap": "tsx scripts/bootstrap-nutrition.ts"
```

**Step 3: Correr**

```bash
NIT_COLEGIO=900000680 npm run nutrition:bootstrap
```

Expected (~30-60s): mensajes de progreso, terminando en `✅ done`. Verificar:
```bash
PGPASSWORD="$RDS_PASSWORD" psql -h "$RDS_HOST" -U bioalert_app -d bioalert \
  -c "SELECT COUNT(*), COUNT(DISTINCT canonical_name) FROM bioalert.product_nutrition;"
```
Expected: ~150 filas, ~80-120 canonical_names (consolidación de duplicados).

**Step 4: Commit**

```bash
git add scripts/bootstrap-nutrition.ts package.json
git commit -m "feat(scripts): bootstrap nutricional con Claude haiku 4.5"
git push
```

**Step 5: ANUNCIO**

> ✅ `bioalert.product_nutrition` poblada. Jose Arcila puede empezar EXT-2 (nutrition-weekly).

---

## Task 12: Fixtures SQL para `bioalert.*`

**Files:**
- Create: `data/fixtures/10-parent-phone-map.sql`
- Create: `data/fixtures/11-cafeteria-admins.sql`
- Create: `data/fixtures/12-student-allergens.sql`
- Create: `data/fixtures/13-product-allergens.sql`
- Create: `data/fixtures/14-inventory.sql`

**Step 1: parent_phone_map**

Conseguí de Miguel la lista de `identificacion_padre` de los estudiantes elegidos para la demo (ver `analysis/results/caso-demo.md`). Mapéalos a los teléfonos del equipo que ya opt-in'earon al sandbox de Kapso.

```sql
-- data/fixtures/10-parent-phone-map.sql
TRUNCATE bioalert.parent_phone_map;
INSERT INTO bioalert.parent_phone_map (identificacion_padre, phone_e164, nombre_padre) VALUES
  ('<id_padre_mateo>', '+57<tel_miguel>',   'Diana (padre demo)'),
  ('<id_padre_2>',     '+57<tel_dev2>',     'Padre demo 2'),
  ('<id_padre_3>',     '+57<tel_dev3>',     'Padre demo 3')
ON CONFLICT (identificacion_padre) DO UPDATE SET
  phone_e164 = EXCLUDED.phone_e164,
  nombre_padre = EXCLUDED.nombre_padre;
```

**Step 2: cafeteria_admins**

```sql
-- data/fixtures/11-cafeteria-admins.sql
TRUNCATE bioalert.cafeteria_admins;
INSERT INTO bioalert.cafeteria_admins (phone_e164, nit_colegio, display_name) VALUES
  ('+57<tel_admin_demo>', '900000680', 'Admin Cafetería DEMO 680')
ON CONFLICT (phone_e164) DO UPDATE SET
  nit_colegio = EXCLUDED.nit_colegio;
```

**Step 3: student_allergens (manual, ~3 estudiantes)**

```sql
-- data/fixtures/12-student-allergens.sql
TRUNCATE bioalert.student_allergens;
INSERT INTO bioalert.student_allergens (usuario_identificacion, allergen_name) VALUES
  ('<id_mateo>',     'mani'),
  ('<id_estud_2>',   'lactosa'),
  ('<id_estud_3>',   'gluten');
```

**Step 4: product_allergens — derivado de las nutriciones**

Identificá manualmente productos con maní/lactosa/gluten. Por ahora, hardcoded para 5 productos del top:

```sql
-- data/fixtures/13-product-allergens.sql
TRUNCATE bioalert.product_allergens;
INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name)
SELECT nombre_producto, 'gluten'
FROM bioalert.product_nutrition
WHERE canonical_name LIKE '%dedito%' OR canonical_name LIKE '%pan%' OR canonical_name LIKE '%galleta%';

INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name)
SELECT nombre_producto, 'lactosa'
FROM bioalert.product_nutrition
WHERE canonical_name LIKE '%queso%' OR canonical_name LIKE '%leche%' OR canonical_name LIKE '%yogurt%';
```

**Step 5: inventory — sintético para el piloto**

```sql
-- data/fixtures/14-inventory.sql
TRUNCATE bioalert.inventory;
-- Pobla con los top productos del colegio piloto, stock simulado
INSERT INTO bioalert.inventory (nombre_producto, nit_colegio, current_stock, minimum_stock)
SELECT DISTINCT
  v.nombre_producto,
  '900000680',
  (RANDOM() * 100)::int                     AS current_stock,
  20                                        AS minimum_stock
FROM reto.ventas v
WHERE v.nit_colegio = '900000680'
  AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
GROUP BY v.nombre_producto
ORDER BY COUNT(*) DESC
LIMIT 100
ON CONFLICT DO NOTHING;
-- Forzar 5 productos en stock crítico para el demo
UPDATE bioalert.inventory SET current_stock = 5 WHERE nombre_producto IN (
  SELECT nombre_producto FROM bioalert.inventory ORDER BY RANDOM() LIMIT 5
);
```

**Step 6: Aplicar todos**

```bash
for f in data/fixtures/1*.sql; do
  echo "→ $f"
  PGPASSWORD="$RDS_PASSWORD" psql -h "$RDS_HOST" -U bioalert_app -d bioalert -f "$f"
done
```

**Step 7: Commit**

```bash
git add data/fixtures/
git commit -m "feat(data): fixtures SQL para parent_phone_map, allergens, inventory"
git push
```

---

## Task 13: Vistas web estáticas

**Files:**
- Create: `web/nutrition-report/index.html`
- Create: `web/cafeteria-insights/index.html`
- Modify: `serverless.yml` (agregar S3 bucket + CloudFront)

**Step 1: `web/nutrition-report/index.html`**

HTML+JS puro con Chart.js. Una sola página, mobile-first. Recibe data via `?student=<id>` query param y fetch a `https://<bucket>/data/<id>.json`.

Template mínimo (Jose Maza lo afina visualmente):

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Nutricional Semanal · BioAlert+</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 1rem; background: #fafafa; }
    h1 { font-size: 1.4rem; }
    .card { background: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .flag-red { color: #d33; font-weight: 600; }
    canvas { max-height: 240px; }
  </style>
</head>
<body>
  <h1>Reporte nutricional semanal</h1>
  <div id="root">Cargando...</div>
  <script>
    const params = new URLSearchParams(location.search)
    const studentId = params.get('student')
    fetch(`./data/${studentId}.json`)
      .then(r => r.json())
      .then(render)
      .catch(e => document.getElementById('root').textContent = 'Error cargando datos')

    function render(d) {
      const root = document.getElementById('root')
      root.innerHTML = `
        <div class="card"><h2>${d.student_name}</h2><p>${d.school} · semana ${d.week}</p></div>
        <div class="card"><h3>Top productos</h3><ul>${d.top_products.map(p => `<li>${p.name} — ${p.count}x</li>`).join('')}</ul></div>
        <div class="card"><h3>Macros vs. promedio del colegio</h3><canvas id="macros"></canvas></div>
        ${d.flags.length ? `<div class="card flag-red">⚠️ ${d.flags.join('. ')}</div>` : ''}
      `
      new Chart(document.getElementById('macros'), {
        type: 'bar',
        data: {
          labels: ['Calorías', 'Azúcar (g)', 'Grasa (g)', 'Sodio (mg)'],
          datasets: [
            { label: d.student_name, data: d.student_macros, backgroundColor: '#3a8' },
            { label: 'Promedio colegio', data: d.school_avg_macros, backgroundColor: '#aaa' },
          ],
        },
      })
    }
  </script>
</body>
</html>
```

**Step 2: `web/cafeteria-insights/index.html`** — similar, dos secciones (benchmark + insight cruzado EXT-5).

**Step 3: Agregar S3 + CloudFront a `serverless.yml`**

En `resources.Resources` agregá:

```yaml
WebBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: bioalert-web-${self:provider.stage}-${aws:accountId}
    OwnershipControls:
      Rules:
        - ObjectOwnership: BucketOwnerEnforced
    PublicAccessBlockConfiguration:
      BlockPublicAcls: false
      BlockPublicPolicy: false
      IgnorePublicAcls: false
      RestrictPublicBuckets: false
    WebsiteConfiguration:
      IndexDocument: index.html

WebBucketPolicy:
  Type: AWS::S3::BucketPolicy
  Properties:
    Bucket: !Ref WebBucket
    PolicyDocument:
      Statement:
        - Sid: PublicReadGetObject
          Effect: Allow
          Principal: '*'
          Action: 's3:GetObject'
          Resource: !Sub '${WebBucket.Arn}/*'
```

(CloudFront opcional — para hackathon, S3 website endpoint directo basta.)

**Step 4: Deploy + sync vistas**

```bash
npx serverless deploy --stage hackathon
aws s3 sync web/ s3://bioalert-web-hackathon-642722971137/ \
  --profile biofood-hackathon --region us-east-1
```

Expected: imprime URL del bucket website. Anotala — Lambdas la usan en `process.env.WEB_BASE_URL`.

**Step 5: Commit**

```bash
git add web/ serverless.yml
git commit -m "feat(web): vistas estáticas nutrition-report y cafeteria-insights"
git push
```

---

## Task 14: Soporte H+12 a H+22

A partir de H+12 tu rol es **soporte de integración y polish**:

- **Cuando Jose Arcila termine `nutrition-weekly`:** lo coordinás con vos para que el JSON suba a `s3://bioalert-web-hackathon-.../data/<student>.json` y el HTML lo levante.
- **Cuando Jose Arcila termine `cafeteria-weekly`:** idem para `s3://.../insights/<nit_colegio>.json`.
- **Monitoreo de logs:** `npx serverless logs -f <function-name> --tail` para detectar errores temprano.
- **Bug fixes** en shared/ si Miguel o Jose Arcila detectan algo.
- **Polish visual de las vistas** — los Devs son senior, no diseñadores. Hacelo mobile-friendly y elegante con Chart.js.

---

## Definition of Done (Track C)

- [ ] RDS aprovisionada, schema aplicado, ETL cargado con conteos correctos
- [ ] `lambdas/shared/{db,whatsapp,claude,ssm,dynamo-conversations,logger,types}.ts` committed y type-check pasa
- [ ] `bioalert.product_nutrition` con ≥100 filas y canonical_name consolidando duplicados
- [ ] Las 5 tablas `bioalert.*` (parent_phone_map, cafeteria_admins, student_allergens, product_allergens, inventory) pobladas
- [ ] `web/nutrition-report/index.html` y `web/cafeteria-insights/index.html` deployadas en S3 con URL pública accesible desde celular
- [ ] Logs limpios (sin errores no esperados) durante H+18 a H+22
- [ ] Stack se puede destruir con `npm run remove` (verificado mentalmente, NO correr durante el hackathon)
