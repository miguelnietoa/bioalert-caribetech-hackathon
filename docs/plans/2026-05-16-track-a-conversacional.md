# Track A — Conversacional + Producto — Implementation Plan

> **For Miguel:** Vos sos el dueño del producto y del agente conversacional. Lo que hace o no hace el bot lo decidís vos, lo que se dice en el pitch lo escribís vos. Los otros 2 devs construyen lo que vos necesitás que el bot pueda hacer.
>
> Referencia transversal: [`../team-plan.md`](../team-plan.md), [`../db-schema.md`](../db-schema.md), [`../../CLAUDE.md`](../../CLAUDE.md).

**Goal:** Construir el agente WhatsApp completo (US-01, US-04, EXT-1, EXT-4, EXT-6) + el caso demo "Diana y Mateo" + el cálculo de uplift + el pitch.

**Architecture:** Una sola Lambda (`conversation-handler`) que recibe webhooks de Kapso, carga sesión de DynamoDB, llama a Claude Sonnet 4.6 con 8 tools, ejecuta los tool calls contra Postgres vía `lambdas/shared/db.ts`, responde vía `lambdas/shared/whatsapp.ts`. EXT-4 vive en el system prompt; EXT-1 vive en el handler de la tool `get_recharge_recommendations`; EXT-6 lo emite el handler post-respuesta cuando aplica.

**Tech stack:** Anthropic SDK (tool calling, modelo `claude-sonnet-4-6`), Kapso REST API, pg, DynamoDB.

---

## Pre-requisitos antes de arrancar

- Tenés que tener acceso al canal del equipo y a la DB del reto (creds en `.env.example`).
- Tu opt-in al sandbox de Kapso ya fue hecho (vos lo configuraste).
- `psql` instalado.
- Esperá a que Dev 3 confirme **"shared/* committed"** antes de empezar el handler (Task 5+). Mientras tanto: Tasks 1-4 NO dependen de Dev 3.

---

## Task 1: EDA — elegir colegio piloto

**Files:**
- Run: `analysis/queries/02-colegios-candidatos.sql`

**Step 1: Conectar a biofooddb (público) y correr el ranking**

```bash
PGPASSWORD='PasswordHackaton2026' psql \
  -h 3.208.123.187 -p 5432 -U hackathon_dev -d biofooddb \
  -v dias=90 -f analysis/queries/02-colegios-candidatos.sql
```

Expected: tabla con ~7 colegios candidatos. El primero recomendado en [`../db-schema.md`](../db-schema.md) §5 es **NIT 900000680 (COLEGIO DEMO 680)**.

**Step 2: Decidir colegio**

Por defecto **900000680**. Si después de mirar la data preferís otro, anotalo y avisá al equipo — afecta a Dev 3 (`bootstrap-nutrition.ts` usa NIT_COLEGIO env var).

**Step 3: Anunciar al equipo**

> 🎯 Colegio piloto: **NIT 900000680**. Dev 3, podés correr `NIT_COLEGIO=900000680 npm run nutrition:bootstrap`.

---

## Task 2: Identificar 3 estudiantes arquetípicos ("Mateos")

**Files:**
- Run: `analysis/queries/03-mateos-candidatos.sql`

**Step 1: Correr con el NIT elegido**

```bash
PGPASSWORD='PasswordHackaton2026' psql \
  -h 3.208.123.187 -p 5432 -U hackathon_dev -d biofooddb \
  -v nit_colegio="'900000680'" -v dias=90 \
  -f analysis/queries/03-mateos-candidatos.sql
```

Expected: hasta 30 filas con archetipo `A — Alto azúcar`, `B — Irregular`, `C — Balanceado (control)`.

**Step 2: Elegir 3 estudiantes**

De la lista, escoger 1 de cada archetipo. **Mateo = el de Alto azúcar** (es el protagonista del pitch). Para los otros dos, balance entre data interesante y nombres que suenan bien en demo.

Anotá para cada uno:
- `usuario_identificacion`
- `nombre_estudiante`
- `identificacion_padre`
- `nombre_padre`
- métricas clave (gasto_total, ticket_promedio, pct_dulce, ventas)

---

## Task 3: Documentar caso "Diana y Mateo"

**Files:**
- Create: `analysis/results/caso-demo.md`

**Step 1: Escribir el caso**

Template:

```markdown
# Caso demo: Diana y Mateo (NIT 900000680, COLEGIO DEMO 680)

## Mateo
- **usuario_identificacion:** `<id>`
- **nombre:** `<nombre>` (anonimizado del dataset)
- **Padre:** Diana — `identificacion_padre: <id>`
- **Datos de los últimos 90 días:**
  - Ventas totales: <N>
  - Gasto total: $<X>
  - Ticket promedio: $<X>
  - % gasto en "dulce/snack": <Y>%
  - Productos top: <lista>

## El otro lado: Diana
- **Teléfono mapeado a sandbox:** +57<tu-tel>
- Recarga promedio últimos 90 días: $<X> cada <N> días
- Patrón: <descripción de comportamiento — proactiva / reactiva / etc.>

## Punto de tensión que ataca el demo
"Diana cree que Mateo come bien. La data dice que el 40% de su consumo en
cafetería es azúcar añadida. Diana no lo sabe — hasta hoy."

## Casos de uso a demostrar
1. Diana pregunta "¿qué comió Mateo esta semana?" — US-01
2. Diana pregunta "¿cuánto saldo le queda?" — US-04
3. Diana pregunta "¿cuánto recomiendan recargar?" — EXT-1, 3 opciones
4. Llega alerta automática del cron de nutrición (EXT-2) → vista web
5. Mateo compra un producto con alérgeno (registrado: maní) → alerta <30s (US-03)
6. (Si hay tiempo) admin cafetería recibe benchmark + insight cruzado (EXT-3 + EXT-5)
```

**Step 2: Commit**

```bash
git add analysis/results/caso-demo.md
git commit -m "docs: caso demo Diana y Mateo (colegio 900000680)"
git push
```

**Step 3: Pasarle a Dev 3 los IDs**

Dev 3 los necesita para `data/fixtures/10-parent-phone-map.sql` (mapear `identificacion_padre` real → tu teléfono que opt-in'easte).

> 📋 Para Dev 3: padres a mapear en `parent_phone_map`:
> - `<id_padre_mateo>` → `+57<tu_tel>` (Diana, demo principal)
> - `<id_padre_2>` → `+57<tel_dev2>` (padre demo 2)
> - `<id_padre_3>` → `+57<tel_dev3>` (padre demo 3)

---

## ⏸️ CHECKPOINT — esperar shared/

Antes de seguir con Tasks 4+, **Dev 3 tiene que haber anunciado "shared/* committed"** (H+4 esperado). Mientras tanto, podés:

- Refinar el caso demo
- Pre-redactar el system prompt (ver Task 6 abajo)
- Leer docs de Anthropic tool use: https://docs.claude.com/en/docs/build-with-claude/tool-use

---

## Task 4: `lambdas/conversation-handler/index.ts` — handler base

**Files:**
- Create: `lambdas/conversation-handler/index.ts`
- Modify: `serverless.yml` (agregar la función) — coordinar con Dev 3

**Step 1: Escribir el handler base**

```typescript
// lambdas/conversation-handler/index.ts
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { verifyWebhookSignature, sendText } from '../shared/whatsapp.js'
import { getSession, putSession } from '../shared/dynamo-conversations.js'
import { chatWithTools, MODEL_CONVERSATIONAL } from '../shared/claude.js'
import { logger } from '../shared/logger.js'
import { TOOLS, executeToolCall } from './tools/index.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import type { ConversationSession } from '../shared/types.js'

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const raw = event.body ?? ''
  const sig = event.headers['x-webhook-signature']
  if (!await verifyWebhookSignature(raw, sig)) {
    logger.warn('webhook signature invalid')
    return { statusCode: 401, body: 'invalid signature' }
  }

  const payload = JSON.parse(raw)
  if (payload.event !== 'whatsapp.message.received') {
    return { statusCode: 200, body: 'ignored' }
  }

  // Kapso debouncing batches messages → procesamos texto concatenado
  const msgs: Array<{ from: string, text: string }> = payload.data.messages
  const from = msgs[0].from
  const text = msgs.map(m => m.text).join('\n').trim()

  logger.info('inbound', { from, text_len: text.length })

  let session = await getSession(from) ?? {
    phone_e164: from,
    history: [],
    expires_at: 0,
  } as ConversationSession

  session.history.push({ role: 'user', content: text })

  // Bucle de tool calling
  while (true) {
    const res = await chatWithTools({
      systemPrompt: SYSTEM_PROMPT,
      messages: session.history,
      tools: TOOLS,
    })

    const toolUses = res.content.filter(b => b.type === 'tool_use')
    if (toolUses.length === 0) {
      const textBlock = res.content.find(b => b.type === 'text')
      const reply = textBlock?.type === 'text' ? textBlock.text : '(sin respuesta)'
      session.history.push({ role: 'assistant', content: reply })
      await sendText(from, reply)
      await putSession(session)
      return { statusCode: 200, body: 'ok' }
    }

    // Acumular asistente con tool_use blocks
    session.history.push({ role: 'assistant', content: res.content })

    // Ejecutar tools y agregar tool_result al historial
    const toolResults = []
    for (const tu of toolUses) {
      if (tu.type !== 'tool_use') continue
      const result = await executeToolCall(tu.name, tu.input, from)
      toolResults.push({
        type: 'tool_result' as const,
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      })
    }
    session.history.push({ role: 'user', content: toolResults })
  }
}
```

**Step 2: Coordinar con Dev 3 para agregar la función a `serverless.yml`**

Mandale este snippet por chat:

```yaml
functions:
  conversation-handler:
    handler: lambdas/conversation-handler/index.handler
    timeout: 30
    memorySize: 1024
    environment:
      STAGE: ${self:provider.stage}
    events:
      - httpApi:
          method: POST
          path: /webhook/kapso
```

**Step 3: Commit (todavía no deployable — tools/ y prompts/ faltan)**

```bash
git add lambdas/conversation-handler/index.ts
git commit -m "feat(conv): handler base + tool calling loop"
git push
```

---

## Task 5: System prompt

**Files:**
- Create: `lambdas/conversation-handler/prompts/system.ts`

**Step 1: Escribir**

```typescript
// lambdas/conversation-handler/prompts/system.ts
export const SYSTEM_PROMPT = `Eres el agente de Biofood — asistente nutricional familiar.

Idioma: español de Colombia. Tono: cálido pero conciso, como WhatsApp con un asesor de confianza. Llamas al padre por su nombre.

REGLA DE ORO (EXT-4): SIEMPRE explicas POR QUÉ dices cada cosa. Frases tipo "te aviso esto porque..." o "te recomiendo eso porque...". Si una recomendación o alerta no tiene justificación basada en data de las tools, NO la digas. Nunca inventes datos.

DATOS QUE PUEDES USAR: solo lo que devuelven las tools. Si no tienes un dato, di "no tengo esa información hoy" en vez de inventar.

LÍMITE DE CONTEXTO: cuando llames tools de consumo histórico, los resultados ya vienen acotados a las últimas 20 transacciones o 30 días. No pidas más.

IDENTIFICACIÓN DEL USUARIO:
- Si el teléfono del usuario está en parent_phone_map → es un PADRE. Las tools relevantes: get_student_consumption_today/week, get_nutrition_summary, get_balance_projection, get_recharge_recommendations, compare_to_peers.
- Si el teléfono está en cafeteria_admins → es un ADMIN DE CAFETERÍA. Tu rol cambia: ahora eres asesor de negocio. Tools relevantes: get_school_alerts, get_cafeteria_benchmark.

REGLA EXT-1 (recargas): si el padre pregunta por saldo, recargar, o cualquier intención de recarga — SIEMPRE llama get_recharge_recommendations y devuelve las 3 opciones (Esencial, Equilibrada, Bienestar) con justificación data-driven. Nunca un monto único.

FORMATO DE RESPUESTA:
- Usa emojis con moderación (✅⚠️📊🍎)
- Párrafos cortos, máximo 4-5 líneas
- Si hay datos numéricos importantes, ponelos en bold con *asteriscos*
- Cierra con una pregunta abierta solo si tiene sentido continuar la conversación

EJEMPLOS DE BUENA RESPUESTA:

Usuario: ¿qué comió Mateo hoy?
Tú: Hoy Mateo compró:
- *Limonada Frappé* a las 10:15 ($3.000)
- *Dedito de queso* a las 12:30 ($4.000)

Total: *$7.000*. Te lo cuento porque me preguntaste por hoy y vi 2 transacciones registradas.

Usuario: ¿cuánto le queda de saldo?
Tú: Le quedan aproximadamente *$45.000*. Te aviso esto porque, según el patrón de gasto de Mateo en los últimos 30 días (~$5.700/día), eso le alcanza para *8 días más*. Si querés ver opciones de recarga, escribí "Recargar".`
```

**Step 2: Commit**

```bash
git add lambdas/conversation-handler/prompts/system.ts
git commit -m "feat(conv): system prompt con EXT-4 explicabilidad"
git push
```

---

## Task 6: Tools registry — `tools/index.ts`

**Files:**
- Create: `lambdas/conversation-handler/tools/index.ts`

**Step 1: Escribir registry**

```typescript
// lambdas/conversation-handler/tools/index.ts
import type Anthropic from '@anthropic-ai/sdk'
import * as t1 from './get-student-consumption-today.js'
import * as t2 from './get-student-consumption-week.js'
import * as t3 from './get-nutrition-summary.js'
import * as t4 from './get-balance-projection.js'
import * as t5 from './get-recharge-recommendations.js'
import * as t6 from './compare-to-peers.js'
import * as t7 from './get-school-alerts.js'
import * as t8 from './get-cafeteria-benchmark.js'

const HANDLERS: Record<string, (input: unknown, phone: string) => Promise<unknown>> = {
  [t1.def.name]: t1.handler,
  [t2.def.name]: t2.handler,
  [t3.def.name]: t3.handler,
  [t4.def.name]: t4.handler,
  [t5.def.name]: t5.handler,
  [t6.def.name]: t6.handler,
  [t7.def.name]: t7.handler,
  [t8.def.name]: t8.handler,
}

export const TOOLS: Anthropic.Tool[] = [t1.def, t2.def, t3.def, t4.def, t5.def, t6.def, t7.def, t8.def]

export async function executeToolCall(name: string, input: unknown, phone: string): Promise<unknown> {
  const h = HANDLERS[name]
  if (!h) return { error: `unknown tool: ${name}` }
  try {
    return await h(input, phone)
  } catch (e: any) {
    return { error: e.message ?? String(e) }
  }
}
```

**Step 2: Cada tool sigue el mismo patrón** — definir 8 archivos siguiendo este template:

```typescript
// lambdas/conversation-handler/tools/get-student-consumption-today.ts
import type Anthropic from '@anthropic-ai/sdk'
import { query } from '../../shared/db.js'

export const def: Anthropic.Tool = {
  name: 'get_student_consumption_today',
  description: 'Devuelve las compras del estudiante vinculado al teléfono del padre el día de hoy.',
  input_schema: { type: 'object', properties: {}, required: [] },
}

export async function handler(_input: unknown, phone: string): Promise<unknown> {
  const rows = await query<{ nombre_producto: string, importe: number, fecha: Date }>(`
    SELECT v.nombre_producto, v.importe, v.fecha
    FROM reto.ventas v
    JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = v.identificacion_padre
    WHERE ppm.phone_e164 = $1
      AND v.fecha = (SELECT MAX(fecha) FROM reto.ventas)  -- "hoy" = max fecha del dataset
    ORDER BY v.fecha DESC
    LIMIT 20
  `, [phone])
  return { compras: rows }
}
```

**Step 3: Implementar las 8 tools** (~1h)

Patrones por tool:

1. **`get_student_consumption_today`** — SELECT últimas compras de "hoy" (= max fecha del dataset).
2. **`get_student_consumption_week`** — SELECT compras últimos 7 días.
3. **`get_nutrition_summary`** — JOIN con `bioalert.product_nutrition`, suma de macros. Parámetro `days` (default 7).
4. **`get_balance_projection`** — SUM(recargas) - SUM(ventas*cantidad), proyección con avg diario.
5. **`get_recharge_recommendations`** (EXT-1) — calcula 3 opciones con narrativa. Ver Task 7.
6. **`compare_to_peers`** — peer = mismo colegio (no grade). Promedio del colegio vs. el estudiante.
7. **`get_school_alerts`** — solo si el teléfono es admin. Lista productos en stock crítico.
8. **`get_cafeteria_benchmark`** — solo admin. Top productos colegio vs. top productos otros colegios.

**Step 4: Commit cada tool**

```bash
git add lambdas/conversation-handler/tools/
git commit -m "feat(conv): 8 tools del agente (US-01, US-04, EXT-1)"
git push
```

---

## Task 7: EXT-1 — narrativa de las 3 opciones de recarga

**Files:**
- Modify: `lambdas/conversation-handler/tools/get-recharge-recommendations.ts`

**Step 1: Lógica de las 3 opciones**

```typescript
// dentro de handler() de get-recharge-recommendations
const { rows: stats } = await query<{ avg_daily: number, sugar_pct: number, balance: number }>(`
  WITH spend AS (
    SELECT
      ppm.phone_e164,
      AVG(v.importe) AS avg_daily,
      SUM(v.importe) FILTER (WHERE pn.category IN ('dulce','snack')) * 100.0
        / NULLIF(SUM(v.importe), 0) AS sugar_pct
    FROM reto.ventas v
    JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = v.identificacion_padre
    LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
    WHERE ppm.phone_e164 = $1
      AND v.fecha >= (SELECT MAX(fecha) - INTERVAL '30 days' FROM reto.ventas)
    GROUP BY ppm.phone_e164
  )
  SELECT
    avg_daily,
    COALESCE(sugar_pct, 0) AS sugar_pct,
    /* balance */
    (SELECT COALESCE(SUM(valor),0) FROM reto.recargas r
       JOIN bioalert.parent_phone_map ppm2 ON ppm2.identificacion_padre = r.identificacion_padre
       WHERE ppm2.phone_e164 = $1) -
    (SELECT COALESCE(SUM(importe),0) FROM reto.ventas v
       JOIN bioalert.parent_phone_map ppm2 ON ppm2.identificacion_padre = v.identificacion_padre
       WHERE ppm2.phone_e164 = $1) AS balance
  FROM spend
`, [phone])

const s = stats[0]
if (!s) return { error: 'no spend data' }

const esencial = Math.round(s.avg_daily * 14 / 1000) * 1000    // 2 semanas
const equilibrada = Math.round(s.avg_daily * 30 / 1000) * 1000 // 1 mes
const bienestar = Math.round(s.avg_daily * 30 * 1.4 / 1000) * 1000 // 1 mes + margen para fruta

return {
  saldo_actual: Math.round(s.balance),
  patron_diario: Math.round(s.avg_daily),
  pct_dulce: Math.round(s.sugar_pct),
  opciones: [
    {
      nombre: 'Esencial',
      monto: esencial,
      narrativa: `Cubre 2 semanas según el patrón real ($${Math.round(s.avg_daily)}/día).`,
    },
    {
      nombre: 'Equilibrada',
      monto: equilibrada,
      narrativa: `Cubre el mes completo.${s.sugar_pct > 30
        ? ` El ${Math.round(s.sugar_pct)}% del consumo va a snacks/dulces — vale la pena monitorear.`
        : ''}`,
    },
    {
      nombre: 'Bienestar',
      monto: bienestar,
      narrativa: 'Cubre el mes + margen para priorizar fruta o proteína cuando sea posible.',
    },
  ],
}
```

**Step 2: Commit**

```bash
git add lambdas/conversation-handler/tools/get-recharge-recommendations.ts
git commit -m "feat(conv): EXT-1 con 3 opciones data-driven y anchoring"
git push
```

---

## Task 8: EXT-6 — quick replies con buttons

**Files:**
- Modify: `lambdas/conversation-handler/index.ts` (intercept response, emit buttons)

**Step 1: Lógica de buttons**

Después del `sendText(from, reply)`, si el reply menciona "recarga" o si la última tool fue `get_recharge_recommendations`, enviá buttons:

```typescript
import { sendButtons } from '../shared/whatsapp.js'

// después de sendText:
const lastTool = res.content.find(b => b.type === 'tool_use')
if (lastTool?.type === 'tool_use' && lastTool.name === 'get_recharge_recommendations') {
  await sendButtons(from, '¿Cuál preferís?', [
    { id: 'recharge_esencial',    title: 'Esencial' },
    { id: 'recharge_equilibrada', title: 'Equilibrada' },
    { id: 'recharge_bienestar',   title: 'Bienestar' },
  ])
}
```

**Step 2: Commit**

```bash
git add lambdas/conversation-handler/index.ts
git commit -m "feat(conv): EXT-6 quick replies para 3 opciones de recarga"
git push
```

---

## Task 9: Smoke test E2E desde tu WhatsApp

**Files:** ninguno (test manual)

**Step 1: Deploy**

Coordiná con Dev 3 (es quien controla `serverless.yml`):

```bash
npx serverless deploy --stage hackathon -f conversation-handler
```

**Step 2: Configurar webhook URL en Kapso**

Cambiar de `webhook.site/...` a la URL del API Gateway desplegado:

```
https://<api-id>.execute-api.us-east-1.amazonaws.com/webhook/kapso
```

**Step 3: Probar desde tu WhatsApp**

Enviá al sandbox: `¿qué comió Mateo hoy?`

Expected: respuesta del bot en <8s (4s Claude + 5s debouncing window). Si llega "no tengo esa información hoy" significa que el teléfono no está mapeado en `parent_phone_map`. Coordiná con Dev 3.

**Step 4: Iterá**

Probá las queries del caso demo:
- "¿qué comió esta semana?"
- "¿cuánto saldo le queda?"
- "Quiero recargar"
- "¿está comiendo mucha azúcar?"

---

## Task 10: Cálculo de uplift y pitch

**Files:**
- Create: `analysis/results/uplift-pitch.md`

**Step 1: Queries de baseline**

```bash
PGPASSWORD='PasswordHackaton2026' psql -h 3.208.123.187 -p 5432 -U hackathon_dev -d biofooddb -c "
WITH stats AS (
  SELECT
    COUNT(DISTINCT identificacion_padre) AS padres,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY valor) AS p25,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY valor) AS p50,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY valor) AS p75,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY valor) AS p90,
    AVG(valor) AS avg_recarga
  FROM hackaton_recargas
  WHERE fecha >= '2025-01-01'
)
SELECT * FROM stats;
"
```

**Step 2: Modelo de 3 escenarios**

| Escenario | % de padres del p50 que sube a... | Uplift por padre | Total piloto | Extrapolación 90 colegios |
|---|---|---|---|---|
| Pesimista | 15% sube de p50 a p65 | $X | $Y | $Z |
| Base | 30% sube de p50 a p75 | $X | $Y | $Z |
| Optimista | 40% sube de p50 a p80 | $X | $Y | $Z |

**Step 3: Frase final del pitch**

> "Aplicado a los 90 colegios de Biofood, esta solución representa entre $X.X y $Y.Y mil millones COP adicionales en recargas anuales según nuestro modelo conservador. Aquí está el cálculo, los supuestos, y la data que lo respalda."

**Step 4: Commit**

```bash
git add analysis/results/uplift-pitch.md
git commit -m "docs: uplift pitch 3 escenarios + extrapolación 90 colegios"
git push
```

---

## Task 11: Pitch outline (15 slides)

**Files:**
- Create: `docs/pitch-outline.md`

Sigue el outline del plan §14:

1. Hook — "Esta es Diana. Su hijo Mateo está en COLEGIO DEMO 680..."
2. Problema — data del dataset (avg ticket, peers ciegos)
3. Solución 1 frase
4. **DEMO EN VIVO** — conversación real con WhatsApp
5. Pilar 1: recarga inteligente (EXT-1)
6. Pilar 2: reporte nutricional (EXT-2 + vista web)
7. Pilar 3: analítica cafetería (EXT-3 + vista web)
8. EXT-5: insight cruzado padre↔cafetería (el "wow")
9. Arquitectura técnica
10. Métricas del MVP
11. Uplift en $ (frase poderosa)
12. Por qué Biofood, por qué ahora
13. Roadmap post-hackathon
14. Equipo
15. Cierre — "Atrévanse a proponer en grande. Aquí está."

---

## Task 12: 3 ensayos del pitch

H+20: dry-run #1 (45 min). H+22: dry-run #2. H+23: ensayo final con cronómetro (target: 8-10 min). Los otros 2 devs son tu audiencia y te critican sin piedad.

---

## Definition of Done (Track A)

- [ ] Caso demo "Diana y Mateo" documentado en `analysis/results/caso-demo.md` con 3 estudiantes
- [ ] `lambdas/conversation-handler/` con las 8 tools, system prompt, EXT-1, EXT-4, EXT-6
- [ ] Smoke test desde WhatsApp real: las 4 queries clave funcionan (consumo hoy/semana, balance, recarga 3 opciones)
- [ ] `analysis/results/uplift-pitch.md` con 3 escenarios y extrapolación
- [ ] `docs/pitch-outline.md` con los 15 slides
- [ ] 3 ensayos del pitch completados antes de H+24
