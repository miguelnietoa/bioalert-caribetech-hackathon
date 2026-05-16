# Track B — Alertas + Reportes — Implementation Plan

> **For Dev 2:** Sos dueño de las 5 Lambdas event-driven: alérgenos en tiempo real, ausencia, stock, reporte nutricional semanal, y reporte de cafetería con insight cruzado. Patrones repetitivos — la primera Lambda toma 1.5h, las otras 4 toman 30-45 min cada una si copiás bien el patrón.
>
> Referencia transversal: [`../team-plan.md`](../team-plan.md), [`../db-schema.md`](../db-schema.md), [`../../CLAUDE.md`](../../CLAUDE.md).

**Goal:** 5 Lambdas funcionando que cubren US-02, US-03, US-05, EXT-2, EXT-3 + EXT-5. Cada una emite mensajes WhatsApp vía `lambdas/shared/whatsapp.ts` con EXT-4 (explicabilidad) en el formato.

**Architecture:** Cada Lambda es independiente, tiene su `index.ts`, su carpeta `queries/*.sql`, y un trigger en `serverless.yml`. Todas comparten `lambdas/shared/*` (db, whatsapp, claude, logger). Ninguna se llama entre sí — comunican vía DB.

**Tech stack:** Node.js 20, TypeScript, pg, Anthropic SDK (Haiku 4.5 para narrativa de reportes), Kapso REST (vía wrapper).

---

## Pre-requisitos antes de arrancar

- Profile AWS `biofood-hackathon` configurado en tu máquina.
- Tu número de WhatsApp opt-in al sandbox de Kapso (envía tu número a Miguel para crear el opt-in con el código de 6 caracteres).
- `psql` instalado.
- **Esperar a Dev 3** anuncio "shared/* committed" antes de empezar Task 3+. Mientras tanto: Tasks 1-2 son independientes.

---

## Task 1: Opt-in al sandbox de Kapso

**Files:** ninguno (manual)

**Step 1: Pedile a Miguel** que en su dashboard de Kapso vaya a **WhatsApp → Sandbox → Add Test Number** y agregue tu número personal.

**Step 2:** Te llega un código de 6 caracteres + un botón "Open WhatsApp" → enviás el código → confirmación recibida en WhatsApp.

**Step 3:** Probá enviar `hola` al sandbox de Kapso desde tu WhatsApp y verificá con Miguel que llegue al webhook.site del equipo.

> ✅ Avisá en el canal: "Dev 2 opt-in OK".

---

## Task 2: Spec de fixtures que vos necesitás

**Files:** ninguno (mensaje a Dev 3)

**Step 1: Mandale a Dev 3 vía canal del equipo** los datos que necesitás en `bioalert.*` para que tus Lambdas tengan algo que disparar:

- 3 estudiantes con alergias (ej. `usuario_identificacion=<id>`, allergen=`mani`)
- 5 productos con esos alérgenos (ej. dedito queso → lactosa)
- 1 admin de cafetería (tu teléfono, mapeado al NIT 900000680)
- Inventario con 5 productos en stock crítico (current < minimum)

Miguel te pasa los IDs reales cuando termine su EDA (Task 2 de [`2026-05-16-track-a-conversacional.md`](2026-05-16-track-a-conversacional.md)).

---

## ⏸️ CHECKPOINT — esperar shared/

Antes de Task 3, **Dev 3 anuncia "shared/* committed"** (esperado H+4). Mientras tanto, leé los handlers de Anthropic SDK y la doc de Kapso send-messages.

---

## Task 3: `lambdas/allergen-polling/` — US-03 (1h, el más simple)

**Files:**
- Create: `lambdas/allergen-polling/index.ts`
- Create: `lambdas/allergen-polling/queries/find-new-allergen-hits.sql`
- Modify: `serverless.yml` (vía Dev 3 — mandale snippet)

**Step 1: SQL — detectar transacciones nuevas con alérgeno**

```sql
-- lambdas/allergen-polling/queries/find-new-allergen-hits.sql
-- Detecta ventas con producto que contiene un alérgeno registrado para el estudiante,
-- desde el cursor (timestamp). Devuelve teléfono del padre y datos para alertar.
SELECT
  v.id                                  AS venta_id,
  v.fecha                               AS fecha,
  v.nombre_producto,
  v.usuario_identificacion,
  v.nombre_estudiante,
  pa.allergen_name,
  ppm.phone_e164                        AS phone_padre,
  ppm.nombre_padre
FROM reto.ventas v
JOIN bioalert.product_allergens pa ON pa.nombre_producto = v.nombre_producto
JOIN bioalert.student_allergens sa
  ON sa.usuario_identificacion = v.usuario_identificacion
  AND sa.allergen_name = pa.allergen_name
JOIN bioalert.parent_phone_map ppm
  ON ppm.identificacion_padre = v.identificacion_padre
WHERE v.id > $1::bigint
ORDER BY v.id
LIMIT 200;
```

Notar: `$1` es el cursor (último `id` procesado).

**Step 2: Handler**

```typescript
// lambdas/allergen-polling/index.ts
import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SQL = readFileSync(resolve(__dirname, 'queries/find-new-allergen-hits.sql'), 'utf8')

const STAGE = process.env.STAGE ?? 'hackathon'
const CURSOR_NAME = `/bioalert/${STAGE}/cursors/allergen-polling`
const ssm = new SSMClient({})

async function getCursor(): Promise<string> {
  try {
    const r = await ssm.send(new GetParameterCommand({ Name: CURSOR_NAME }))
    return r.Parameter?.Value ?? '0'
  } catch {
    return '0'
  }
}

async function setCursor(value: string): Promise<void> {
  await ssm.send(new PutParameterCommand({
    Name: CURSOR_NAME, Value: value, Type: 'String', Overwrite: true,
  }))
}

export const handler: ScheduledHandler = async () => {
  const cursor = await getCursor()
  const hits = await query<{
    venta_id: string
    fecha: Date
    nombre_producto: string
    nombre_estudiante: string | null
    allergen_name: string
    phone_padre: string
    nombre_padre: string | null
  }>(SQL, [cursor])

  logger.info('allergen poll', { cursor, hits: hits.length })

  for (const h of hits) {
    const hora = new Date(h.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    const body =
      `⚠️ Alerta de alérgeno\n\n` +
      `${h.nombre_estudiante} compró *${h.nombre_producto}* a las ${hora}.\n\n` +
      `Este producto contiene *${h.allergen_name}*. ` +
      `Te aviso esto porque registraste alergia a ${h.allergen_name} para tu hijo.`
    try {
      await sendText(h.phone_padre, body)
    } catch (e: any) {
      logger.error('send failed', { venta_id: h.venta_id, error: e.message })
    }
    await new Promise(r => setTimeout(r, 250))  // throttle 4/s (debajo del rate limit)
  }

  if (hits.length > 0) {
    const lastId = hits[hits.length - 1]!.venta_id
    await setCursor(lastId)
  }
}
```

**Step 3: Snippet a Dev 3 para `serverless.yml`**

> Dev 3, agregale esto a `serverless.yml` en `functions:`:
> ```yaml
> allergen-polling:
>   handler: lambdas/allergen-polling/index.handler
>   timeout: 60
>   memorySize: 512
>   environment:
>     STAGE: ${self:provider.stage}
>   events:
>     - schedule: rate(1 minute)
> ```
> Y agregale a IAM:
> ```yaml
> - Effect: Allow
>   Action: ['ssm:PutParameter', 'ssm:GetParameter']
>   Resource: 'arn:aws:ssm:${aws:region}:${aws:accountId}:parameter/bioalert/*/cursors/*'
> ```

**Step 4: Smoke test manual**

Insertá una venta sintética con un producto+estudiante con alérgeno:

```sql
INSERT INTO reto.ventas
  (usuario_identificacion, nombre_estudiante, fecha, cantidad, precio,
   nombre_producto, identificacion_padre, nombre_padre, colegio, nit_colegio)
VALUES
  ('<id_mateo>', '<nombre>', NOW(), 1, 4000,
   'DEDITO QUESO', '<id_padre>', '<nombre_padre>', 'COLEGIO DEMO 680', '900000680');
```

Esperá 1-2 min: deberías recibir WhatsApp de alerta.

**Step 5: Commit**

```bash
git add lambdas/allergen-polling/
git commit -m "feat(alertas): US-03 polling de alérgenos cada 60s"
git push
```

---

## Task 4: `lambdas/absence-cron/` — US-02 (30 min, mismo patrón)

**Files:**
- Create: `lambdas/absence-cron/index.ts`
- Create: `lambdas/absence-cron/queries/find-absent-students.sql`

**Step 1: SQL**

```sql
-- Estudiantes activos del colegio piloto que NO compraron "hoy" (= max fecha del dataset)
WITH today AS (SELECT MAX(fecha) AS d FROM reto.ventas)
SELECT
  s.usuario_identificacion,
  s.nombre_estudiante,
  ppm.phone_e164,
  ppm.nombre_padre
FROM (
  SELECT DISTINCT v.usuario_identificacion, v.nombre_estudiante, v.identificacion_padre
  FROM reto.ventas v, today
  WHERE v.nit_colegio = $1
    AND v.fecha >= today.d - INTERVAL '30 days'
) s
JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = s.identificacion_padre
WHERE NOT EXISTS (
  SELECT 1 FROM reto.ventas v2, today
  WHERE v2.usuario_identificacion = s.usuario_identificacion
    AND v2.fecha = today.d
);
```

**Step 2: Handler — patrón idéntico a allergen-polling**

```typescript
// El esqueleto es igual: leer SQL, ejecutar, iterar, sendText. Diferencias:
// - Sin cursor (corre 1x al día a las 12 PM)
// - SQL con parámetro nit_colegio del piloto
// - Mensaje con EXT-4: "Aún no se registran compras hoy. Típicamente <nombre>
//   compra antes de las 11 AM según su patrón habitual."
```

**Step 3: Snippet a Dev 3**

> ```yaml
> absence-cron:
>   handler: lambdas/absence-cron/index.handler
>   timeout: 120
>   memorySize: 512
>   environment:
>     STAGE: ${self:provider.stage}
>     NIT_PILOTO: '900000680'
>   events:
>     - schedule: cron(0 17 ? * MON-FRI *)   # 12 PM Colombia = 17 UTC
> ```

**Step 4: Smoke test manual**

```bash
npx serverless invoke -f absence-cron --stage hackathon --log
```

Expected: logs muestran cuántos estudiantes ausentes detectó. Tu WhatsApp recibe alerta si Mateo no compró hoy.

**Step 5: Commit**

```bash
git add lambdas/absence-cron/
git commit -m "feat(alertas): US-02 ausencia de consumo cron 12PM"
git push
```

---

## Task 5: `lambdas/stock-cron/` — US-05 (30 min)

**Files:**
- Create: `lambdas/stock-cron/index.ts`
- Create: `lambdas/stock-cron/queries/find-low-stock.sql`

**Step 1: SQL**

```sql
SELECT
  i.nombre_producto,
  i.current_stock,
  i.minimum_stock,
  ca.phone_e164,
  ca.display_name
FROM bioalert.inventory i
JOIN bioalert.cafeteria_admins ca ON ca.nit_colegio = i.nit_colegio
WHERE i.current_stock <= i.minimum_stock
ORDER BY ca.phone_e164, i.current_stock ASC;
```

**Step 2: Handler — agrupar por admin y mandar mensaje consolidado**

```typescript
// agrupar rows por phone_e164
const byAdmin = new Map<string, typeof rows>()
for (const r of rows) {
  if (!byAdmin.has(r.phone_e164)) byAdmin.set(r.phone_e164, [])
  byAdmin.get(r.phone_e164)!.push(r)
}

for (const [phone, items] of byAdmin) {
  const lines = items.map(i =>
    `• *${i.nombre_producto}* — stock ${i.current_stock} (mínimo ${i.minimum_stock})`
  )
  const body =
    `🚨 Productos en stock crítico esta mañana:\n\n` +
    lines.join('\n') +
    `\n\nTe aviso esto porque su nivel está por debajo del mínimo configurado.`
  await sendText(phone, body)
}
```

**Step 3: Snippet a Dev 3**

> ```yaml
> stock-cron:
>   handler: lambdas/stock-cron/index.handler
>   timeout: 60
>   memorySize: 512
>   environment: { STAGE: ${self:provider.stage} }
>   events:
>     - schedule: cron(0 12 ? * * *)   # 7 AM Colombia
> ```

**Step 4: Commit**

```bash
git add lambdas/stock-cron/
git commit -m "feat(alertas): US-05 stock crítico cron 7AM"
git push
```

---

## Task 6: `lambdas/nutrition-weekly/` — EXT-2 (2-3h, más complejo)

**Files:**
- Create: `lambdas/nutrition-weekly/index.ts`
- Create: `lambdas/nutrition-weekly/queries/student-weekly-nutrition.sql`
- Create: `lambdas/nutrition-weekly/queries/peer-avg-nutrition.sql`

**Pre-requisito:** `bioalert.product_nutrition` ya poblada (Dev 3 lo hace en H+7).

**Step 1: SQL agregado**

```sql
-- student-weekly-nutrition.sql — top 3 productos + macros últimos 7 días
WITH last7 AS (
  SELECT v.*, pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg, pn.canonical_name, pn.category
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.identificacion_padre = (
    SELECT identificacion_padre FROM bioalert.parent_phone_map WHERE phone_e164 = $1
  )
  AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
)
SELECT
  (SELECT json_agg(t) FROM (
    SELECT nombre_producto, COUNT(*) AS veces
    FROM last7 GROUP BY 1 ORDER BY 2 DESC LIMIT 3
  ) t) AS top_products,
  ROUND(SUM(calories_100g * cantidad / 100.0)) AS total_calories,
  ROUND(SUM(sugar_g * cantidad / 100.0))       AS total_sugar,
  ROUND(SUM(fat_g * cantidad / 100.0))         AS total_fat,
  ROUND(SUM(sodium_mg * cantidad / 100.0))     AS total_sodium,
  COUNT(*) FILTER (WHERE category IN ('dulce','snack')) * 100.0 / NULLIF(COUNT(*),0) AS pct_snack
FROM last7;
```

**Step 2: Handler con narrativa via Claude Haiku 4.5**

Para cada padre en `parent_phone_map`:

1. Query nutrición del hijo
2. Query promedio del colegio
3. Llamar Claude Haiku 4.5 para generar narrativa corta (~3 líneas) con banderas rojas
4. Subir JSON a S3 `s3://bioalert-web-hackathon-.../data/<student>.json`
5. Mandar WhatsApp con resumen + link a la vista web

```typescript
import { chatWithTools, MODEL_BATCH } from '../shared/claude.js'
// ... después del query agregado:
const narrative = await chatWithTools({
  systemPrompt: 'Eres asistente nutricional. Escribe en español 3 líneas concisas con banderas rojas si las hay. Tono cálido pero directo.',
  messages: [{ role: 'user', content: `Datos semanales:\nCalorías: ${stats.total_calories}\nAzúcar: ${stats.total_sugar}g\n% snacks: ${stats.pct_snack}%\nPromedio colegio: ${peer.total_calories} cal, ${peer.total_sugar}g azúcar.` }],
  tools: [],
  model: MODEL_BATCH,
})
const narrText = (narrative.content[0] as any).text
// ...
const url = `https://${BUCKET}/nutrition-report/index.html?student=${studentId}`
const body =
  `🍎 Reporte nutricional semanal\n\n${narrText}\n\nVer detalle: ${url}\n\n` +
  `¿Querés ver opciones de recarga que prioricen lo saludable? Respondé *Recargar*.`
await sendText(phone, body)
```

**Step 3: Subir JSON a S3** — Dev 3 te explica cómo, usa `@aws-sdk/client-s3`.

**Step 4: Snippet a Dev 3**

> ```yaml
> nutrition-weekly:
>   handler: lambdas/nutrition-weekly/index.handler
>   timeout: 300
>   memorySize: 1024
>   environment:
>     STAGE: ${self:provider.stage}
>     WEB_BUCKET: bioalert-web-${self:provider.stage}-${aws:accountId}
>   events:
>     - schedule: cron(0 23 ? * SUN *)   # Dom 6 PM Colombia
> ```
> Y permiso S3: `s3:PutObject` sobre `arn:aws:s3:::bioalert-web-*/data/*`.

**Step 5: Smoke test**

```bash
npx serverless invoke -f nutrition-weekly --stage hackathon --log
```

Tu teléfono debería recibir mensaje con link clickable. Abrí el link en el celular: vista con Chart.js renderizada.

**Step 6: Commit**

```bash
git add lambdas/nutrition-weekly/
git commit -m "feat(alertas): EXT-2 reporte nutricional semanal con vista web"
git push
```

---

## Task 7: `lambdas/cafeteria-weekly/` — EXT-3 + EXT-5 (3h, el "wow")

**Files:**
- Create: `lambdas/cafeteria-weekly/index.ts`
- Create: `lambdas/cafeteria-weekly/queries/cafeteria-benchmark.sql`
- Create: `lambdas/cafeteria-weekly/queries/cross-insights.sql`

**Step 1: SQL benchmark**

```sql
-- cafeteria-benchmark.sql
-- Compara el colegio piloto vs. el resto de colegios
WITH piloto AS (
  SELECT category, COUNT(*) AS ventas
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1
    AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
  GROUP BY category
),
resto AS (
  SELECT category, COUNT(*) AS ventas, COUNT(DISTINCT nit_colegio) AS colegios
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio != $1
    AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
  GROUP BY category
)
SELECT
  COALESCE(piloto.category, resto.category) AS category,
  piloto.ventas                              AS piloto_ventas,
  ROUND(resto.ventas::numeric / NULLIF(resto.colegios, 0)) AS avg_otros_colegios
FROM piloto FULL OUTER JOIN resto USING (category)
ORDER BY piloto_ventas DESC NULLS LAST;
```

**Step 2: SQL cross-insights — EXT-5**

```sql
-- cross-insights.sql
-- Agrega señales de padres del colegio piloto.
-- Por simplicidad para hackathon: insights derivados directamente de la data
-- (no log de queries del bot — eso requiere otra tabla). Lo simulamos así:
SELECT
  -- "Padres con consumo de azúcar alto" (proxy: estudiantes con pct_dulce > 35% últimos 30 días)
  COUNT(DISTINCT v.identificacion_padre) FILTER (WHERE pn.category IN ('dulce','snack'))
    AS padres_alto_azucar_proxy,
  -- Productos saludables que faltan: top productos de otros colegios que el piloto NO tiene
  (SELECT array_agg(nombre_producto)
   FROM (
     SELECT v2.nombre_producto FROM reto.ventas v2
     LEFT JOIN bioalert.product_nutrition pn2 ON pn2.nombre_producto = v2.nombre_producto
     WHERE v2.nit_colegio != $1
       AND pn2.category IN ('fruta','lacteo')
       AND v2.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
     GROUP BY v2.nombre_producto
     HAVING NOT EXISTS (
       SELECT 1 FROM reto.ventas v3 WHERE v3.nit_colegio = $1 AND v3.nombre_producto = v2.nombre_producto
     )
     ORDER BY COUNT(*) DESC LIMIT 3
   ) t) AS productos_faltantes_saludables
FROM reto.ventas v
LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
WHERE v.nit_colegio = $1
  AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '30 days';
```

**Step 3: Handler**

Patrón similar a `nutrition-weekly`:
1. Para cada admin de cafetería del colegio piloto:
2. Query benchmark + cross-insights
3. Claude Haiku 4.5 genera recomendaciones accionables (2-3 líneas)
4. Subir JSON a `s3://.../insights/<nit>.json`
5. Mandar WhatsApp con resumen + link

```typescript
const body =
  `📊 Reporte semanal de tu cafetería\n\n` +
  `Esta semana, *${insights.padres_alto_azucar_proxy} padres* ` +
  `tienen hijos con consumo elevado de azúcar.\n\n` +
  `Productos que tienen colegios similares y faltan acá:\n` +
  insights.productos_faltantes_saludables.map((p: string) => `• ${p}`).join('\n') +
  `\n\nTe aviso esto porque estos padres podrían convertirse en compradores frecuentes ` +
  `si la cafetería ofrece alternativas saludables.\n\nVer análisis completo: ${url}`
```

**Step 4: Smoke test + commit**

```bash
npx serverless invoke -f cafeteria-weekly --stage hackathon --log
git add lambdas/cafeteria-weekly/
git commit -m "feat(alertas): EXT-3 + EXT-5 reporte semanal cafetería con insight cruzado"
git push
```

---

## Task 8: Backup demo grabado

**Files:** ninguno

A H+18, grabá un video con WhatsApp + screen-share que muestre:
1. Diana pregunta "qué comió Mateo hoy" → respuesta
2. Diana pregunta "cuánto recomiendan recargar" → 3 opciones + buttons
3. Mateo "compra" un producto con alérgeno → alerta llega <30s
4. Admin de cafetería recibe reporte semanal con insight cruzado

Subílo a Drive del equipo. Si la demo en vivo falla por red/Kapso/etc, lo proyectamos.

---

## Task 9: Polish + soporte H+18 → H+22

- Revisar logs de tus Lambdas: `npx serverless logs -f <name> --tail --stage hackathon`
- Ajustar throttling si chocás con rate limit de Kapso
- Asegurar que mensajes están bien formateados (no líneas cortadas raras)
- Ayudar a Miguel y Dev 3 con bugs cruzados

---

## Definition of Done (Track B)

- [ ] `lambdas/allergen-polling/` desplegada, dispara <30s post-transacción de prueba
- [ ] `lambdas/absence-cron/` desplegada, smoke test invocado manualmente, envía a teléfonos sin compra
- [ ] `lambdas/stock-cron/` desplegada, mensaje consolidado al admin
- [ ] `lambdas/nutrition-weekly/` desplegada, sube JSON a S3, link clickable funciona
- [ ] `lambdas/cafeteria-weekly/` desplegada con EXT-5 (insight cruzado) visible en el WhatsApp + en la vista
- [ ] Backup demo grabado disponible en Drive del equipo
- [ ] Mensajes WhatsApp formateados correctamente (sin `\n` raros, emojis donde corresponde, EXT-4 "te aviso esto porque..." en cada mensaje)
