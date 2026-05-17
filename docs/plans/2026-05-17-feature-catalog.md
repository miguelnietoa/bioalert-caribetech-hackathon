# Feature Catalog — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Página estática `web/feature-catalog/` que liste todas las capabilities de BioAlert+ como cards accionables, con hasta 3 modos de demo por feature (trigger directo a AWS, atajo `wa.me` a WhatsApp, link a vista web). Pensada para que el jurado vea el alcance completo del producto en el pitch sin tener que demostrar cada feature en vivo.

**Architecture:** HTML + CSS + JS vanilla (consistente con `wompi-mock`, sin build step). Para los botones que disparan acciones reales, una Lambda nueva `demo-trigger` actúa como bridge: recibe el nombre de la feature + payload mínimo desde el browser, valida un token simple, y o bien (a) firma un webhook fake de Kapso y lo POSTea al `conversation-handler` (features conversacionales), o (b) invoca directamente la Lambda cron correspondiente vía AWS SDK. La página vive en S3 igual que las otras vistas.

**Tech Stack:** Node 20 + TypeScript (Lambda), HTML/CSS/JS vanilla (frontend), AWS SDK v3 (Invoke), HMAC SHA-256 (firma fake de Kapso), API Gateway HTTP API con CORS.

---

## Pre-requisitos

- Estar parado en `main` actualizado (post-merge de `fix-crons-and-sugar`).
- `npx tsc --noEmit` debe pasar en EXIT 0.
- Los crons deben estar funcionando (cafeteria-weekly + nutrition-weekly mandando reportes a Diana).
- Branch nueva: `feature-catalog`.

---

## Task 1: Manifest de features + tipos compartidos

**Files:**
- Create: `lambdas/shared/feature-manifest.ts`

**Step 1: Escribir el manifest**

```typescript
// lambdas/shared/feature-manifest.ts
// Único punto de verdad para qué features expone el catálogo demo.
// El backend (demo-trigger Lambda) y el frontend (catalog HTML) consumen este manifest.

export type FeatureKind = 'conversational_parent' | 'conversational_admin' | 'cron' | 'view_only'

export interface FeatureSpec {
  id: string
  kind: FeatureKind
  title: string
  description: string
  cobertura: string // "US-XX" | "EXT-X" | combinación
  // Para conversacionales: el mensaje que se simula desde el padre/admin
  whatsapp_text?: string
  // Para conversacionales: a qué teléfono se simula que escribe (Diana por default)
  as_phone?: string
  // Para crons: el FunctionName completo en AWS
  lambda_function?: string
  // Para vistas: ruta relativa al S3 bucket
  view_path?: string
}

export const DEFAULT_PARENT_PHONE = '+573046002689'   // Diana (Miguel)
export const DEFAULT_ADMIN_PHONE = '+573046002689'    // Miguel también es admin de cafetería 680
export const SANDBOX_NUMBER_REPLACE = 'KAPSO_SANDBOX_NUMBER'

export const FEATURES: FeatureSpec[] = [
  // ── Conversacional · Padre ──
  {
    id: 'consumption_today',
    kind: 'conversational_parent',
    title: '¿Qué comió hoy?',
    description: 'Lista de compras del estudiante hoy (timezone Bogotá), con hora, producto y monto.',
    cobertura: 'US-01',
    whatsapp_text: '¿qué comió Mateo hoy?',
  },
  {
    id: 'consumption_week',
    kind: 'conversational_parent',
    title: 'Resumen de la semana',
    description: 'Top productos + número de compras + gasto total últimos 7 días.',
    cobertura: 'US-01 ext',
    whatsapp_text: '¿y esta semana cómo le fue?',
  },
  {
    id: 'nutrition_summary',
    kind: 'conversational_parent',
    title: 'Análisis nutricional',
    description: 'Azúcar, calorías, grasa y sodio acumulados con peso por unidad real.',
    cobertura: 'EXT-2',
    whatsapp_text: '¿está comiendo mucha azúcar Mateo?',
  },
  {
    id: 'compare_peers',
    kind: 'conversational_parent',
    title: 'Vs. compañeros',
    description: 'Comparación con el promedio del colegio en ticket y % dulce.',
    cobertura: 'EXT-2',
    whatsapp_text: '¿Mateo come más azúcar que sus compañeros?',
  },
  {
    id: 'balance_projection',
    kind: 'conversational_parent',
    title: 'Saldo + proyección',
    description: 'Saldo actual y días estimados antes de agotamiento.',
    cobertura: 'US-04',
    whatsapp_text: '¿cuánto saldo le queda a Mateo?',
  },
  {
    id: 'recharge_recommendations',
    kind: 'conversational_parent',
    title: '3 opciones de recarga',
    description: 'Anchoring con Esencial / Equilibrada / Bienestar, narrativa data-driven.',
    cobertura: 'EXT-1',
    whatsapp_text: '¿cuánto le recargo?',
  },
  {
    id: 'wompi_checkout',
    kind: 'conversational_parent',
    title: 'Confirmar recarga → Wompi',
    description: 'El padre elige una opción y el bot envía link de pago Wompi (sandbox).',
    cobertura: 'EXT-1 + Wompi',
    whatsapp_text: 'voy con la equilibrada',
    view_path: 'wompi-mock/index.html',
  },

  // ── Conversacional · Admin cafetería ──
  {
    id: 'school_alerts',
    kind: 'conversational_admin',
    title: 'Stock crítico',
    description: 'Lista de productos por debajo del mínimo configurado.',
    cobertura: 'US-05',
    whatsapp_text: '¿qué tengo en stock crítico hoy?',
    as_phone: DEFAULT_ADMIN_PHONE,
  },
  {
    id: 'cafeteria_benchmark',
    kind: 'conversational_admin',
    title: 'Benchmark vs otros colegios',
    description: 'Comparación con promedio nacional + productos saludables faltantes.',
    cobertura: 'EXT-3',
    whatsapp_text: '¿cómo voy vs otros colegios?',
    as_phone: DEFAULT_ADMIN_PHONE,
    view_path: 'cafeteria-insights/index.html',
  },

  // ── Crons (event-driven) ──
  {
    id: 'allergen_polling',
    kind: 'cron',
    title: 'Alerta de alérgeno',
    description: 'Cada 60s: detecta ventas nuevas con productos que contienen alérgenos del estudiante. <30s al padre.',
    cobertura: 'US-03',
    lambda_function: 'bioalert-hackathon-allergen-polling',
  },
  {
    id: 'absence_cron',
    kind: 'cron',
    title: 'Alerta de ausencia',
    description: 'Diario 12 PM Bogotá: padres cuyos hijos no compraron hoy reciben aviso.',
    cobertura: 'US-02',
    lambda_function: 'bioalert-hackathon-absence-cron',
  },
  {
    id: 'stock_cron',
    kind: 'cron',
    title: 'Stock crítico diario',
    description: 'Diario 7 AM Bogotá: admin recibe consolidado de productos en stock crítico.',
    cobertura: 'US-05',
    lambda_function: 'bioalert-hackathon-stock-cron',
  },
  {
    id: 'nutrition_weekly',
    kind: 'cron',
    title: 'Reporte nutricional semanal',
    description: 'Domingos 6 PM Bogotá: padre recibe top productos + macros + comparativa peer + link a vista web.',
    cobertura: 'EXT-2',
    lambda_function: 'bioalert-hackathon-nutrition-weekly',
    view_path: 'nutrition-report/index.html',
  },
  {
    id: 'cafeteria_weekly',
    kind: 'cron',
    title: 'Reporte semanal cafetería + insight cruzado',
    description: 'Lunes 7 AM Bogotá: admin recibe benchmark + señales agregadas de padres (EXT-5) + recomendaciones accionables.',
    cobertura: 'EXT-3 + EXT-5',
    lambda_function: 'bioalert-hackathon-cafeteria-weekly',
    view_path: 'cafeteria-insights/index.html',
  },

  // ── Diferenciadores no demostrables como botón pero importantes ──
  {
    id: 'explainability',
    kind: 'view_only',
    title: 'Explicabilidad obligatoria (EXT-4)',
    description: 'Cada respuesta del bot incluye "te aviso esto porque..." con justificación basada en data. Nunca caja negra.',
    cobertura: 'EXT-4',
  },
  {
    id: 'multi_hijo',
    kind: 'view_only',
    title: 'Multi-hijo determinístico',
    description: 'El bot maneja padres con varios hijos en el dataset eligiendo al más activo por COUNT(*) + ties por fecha.',
    cobertura: 'producto real',
  },
  {
    id: 'timezone_bogota',
    kind: 'view_only',
    title: 'Timezone Bogotá nativo',
    description: 'Todas las queries usan now() AT TIME ZONE America/Bogota — sin confusión de "hoy" en dataset con fechas futuras.',
    cobertura: 'producto real',
  },
]

export function findFeature(id: string): FeatureSpec | undefined {
  return FEATURES.find(f => f.id === id)
}
```

**Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT 0

**Step 3: Commit**

```bash
git checkout -b feature-catalog
git add lambdas/shared/feature-manifest.ts
git commit -m "feat(shared): manifest de features para demo catalog"
git push -u origin feature-catalog
```

---

## Task 2: Lambda demo-trigger — esqueleto + dispatcher conversacional

**Files:**
- Create: `lambdas/demo-trigger/index.ts`

**Step 1: Escribir el handler con HMAC + post al conversation-handler**

```typescript
// lambdas/demo-trigger/index.ts
// Bridge para el feature catalog: recibe {feature, as_phone?} del browser
// y dispara la acción real (webhook conversacional o invoke Lambda cron).
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import crypto from 'node:crypto'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { getSecret } from '../shared/ssm.js'
import { logger } from '../shared/logger.js'
import {
  findFeature,
  DEFAULT_PARENT_PHONE,
  type FeatureSpec,
} from '../shared/feature-manifest.ts'

const CONVERSATION_WEBHOOK_URL =
  process.env.CONVERSATION_WEBHOOK_URL ??
  'https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/webhook/kapso'

const lambdaClient = new LambdaClient({})

function cors(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Token',
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function dispatchConversational(
  feature: FeatureSpec,
  asPhone: string,
): Promise<{ status: number; details: unknown }> {
  if (!feature.whatsapp_text) {
    return { status: 400, details: { error: 'feature has no whatsapp_text' } }
  }
  const body = JSON.stringify({
    event: 'whatsapp.message.received',
    data: {
      messages: [
        {
          from: asPhone,
          text: feature.whatsapp_text,
          timestamp: new Date().toISOString(),
        },
      ],
    },
  })
  const secret = await getSecret('kapso/webhook-secret')
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

  const res = await fetch(CONVERSATION_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body,
  })
  const text = await res.text()
  return {
    status: res.status,
    details: { phone: asPhone, message: feature.whatsapp_text, response_body: text },
  }
}

async function dispatchCron(feature: FeatureSpec): Promise<{ status: number; details: unknown }> {
  if (!feature.lambda_function) {
    return { status: 400, details: { error: 'feature has no lambda_function' } }
  }
  const cmd = new InvokeCommand({
    FunctionName: feature.lambda_function,
    InvocationType: 'Event', // async — no esperamos respuesta
    Payload: Buffer.from(JSON.stringify({})),
  })
  await lambdaClient.send(cmd)
  return {
    status: 202,
    details: { lambda: feature.lambda_function, mode: 'async_invoke' },
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // CORS preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' }
  }

  // Token check
  const tokenHeader = event.headers['x-demo-token'] ?? event.headers['X-Demo-Token']
  const expectedToken = await getSecret('demo/trigger-token')
  if (tokenHeader !== expectedToken) {
    return {
      statusCode: 401,
      headers: cors(),
      body: JSON.stringify({ error: 'invalid_token' }),
    }
  }

  // Body parse
  let payload: { feature?: string; as_phone?: string }
  try {
    payload = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'invalid_json' }) }
  }

  if (!payload.feature) {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'feature_required' }),
    }
  }

  const feature = findFeature(payload.feature)
  if (!feature) {
    return {
      statusCode: 404,
      headers: cors(),
      body: JSON.stringify({ error: 'feature_not_found', feature: payload.feature }),
    }
  }

  logger.info('demo trigger', { feature: feature.id, kind: feature.kind })

  let result: { status: number; details: unknown }
  if (feature.kind === 'conversational_parent' || feature.kind === 'conversational_admin') {
    const phone = payload.as_phone ?? feature.as_phone ?? DEFAULT_PARENT_PHONE
    result = await dispatchConversational(feature, phone)
  } else if (feature.kind === 'cron') {
    result = await dispatchCron(feature)
  } else {
    result = { status: 400, details: { error: 'feature_not_actionable', kind: feature.kind } }
  }

  return {
    statusCode: result.status >= 400 ? result.status : 200,
    headers: cors(),
    body: JSON.stringify({
      feature: feature.id,
      kind: feature.kind,
      status: result.status,
      details: result.details,
    }),
  }
}
```

**Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT 0. Si falla, leer error y corregir antes de seguir.

**Step 3: Commit**

```bash
git add lambdas/demo-trigger/index.ts
git commit -m "feat(demo-trigger): Lambda bridge para conversacional + cron"
```

---

## Task 3: Wire en serverless.yml + SSM token + permisos IAM + deploy

**Files:**
- Modify: `serverless.yml`

**Step 1: Crear el token SSM antes del deploy**

Run:
```bash
TOKEN=$(openssl rand -hex 16)
aws ssm put-parameter \
  --name /bioalert/hackathon/demo/trigger-token \
  --value "$TOKEN" --type SecureString \
  --profile biofood-hackathon --region us-east-1
echo "Token (anotalo, lo necesitamos para el frontend JS):"
echo "$TOKEN"
```

Expected: hex de 32 chars. Anotarlo (lo embeo en el HTML del catálogo en Task 5).

**Step 2: Agregar la función + permiso Lambda Invoke al `serverless.yml`**

En `provider.iam.role.statements`, agregar al final:

```yaml
        - Effect: Allow
          Action:
            - lambda:InvokeFunction
          Resource:
            - 'arn:aws:lambda:${aws:region}:${aws:accountId}:function:bioalert-${self:provider.stage}-*'
```

Y en `functions:`, después de `conversation-handler`, agregar:

```yaml
  demo-trigger:
    handler: lambdas/demo-trigger/index.handler
    timeout: 20
    memorySize: 512
    environment:
      STAGE: ${self:provider.stage}
      CONVERSATION_WEBHOOK_URL: https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/webhook/kapso
    events:
      - httpApi:
          method: POST
          path: /demo/trigger
      - httpApi:
          method: OPTIONS
          path: /demo/trigger
```

**Step 3: Deploy completo (necesario para el IAM nuevo)**

Run: `npx serverless deploy --stage hackathon --aws-profile biofood-hackathon`

Expected: `✔ Service deployed to stack bioalert-hackathon` con la nueva función `demo-trigger` listada. Anotar la URL del endpoint (típicamente la misma base `https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/demo/trigger`).

**Step 4: Smoke test del endpoint con un feature conversacional**

Run:
```bash
TOKEN=$(aws ssm get-parameter --name /bioalert/hackathon/demo/trigger-token \
  --with-decryption --query Parameter.Value --output text \
  --profile biofood-hackathon --region us-east-1)
curl -sS -X POST https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/demo/trigger \
  -H "Content-Type: application/json" \
  -H "X-Demo-Token: $TOKEN" \
  -d '{"feature":"consumption_today"}' | jq
```

Expected:
```json
{
  "feature": "consumption_today",
  "kind": "conversational_parent",
  "status": 200,
  "details": {
    "phone": "+573046002689",
    "message": "¿qué comió Mateo hoy?",
    "response_body": "ok"
  }
}
```
Y debería llegar el mensaje a tu WhatsApp.

**Step 5: Smoke test de un cron**

Run:
```bash
curl -sS -X POST https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/demo/trigger \
  -H "Content-Type: application/json" \
  -H "X-Demo-Token: $TOKEN" \
  -d '{"feature":"nutrition_weekly"}' | jq
```

Expected:
```json
{
  "feature": "nutrition_weekly",
  "kind": "cron",
  "status": 202,
  "details": {
    "lambda": "bioalert-hackathon-nutrition-weekly",
    "mode": "async_invoke"
  }
}
```
Y a los 4-6 segundos llega el reporte nutricional a tu WhatsApp.

**Step 6: Commit**

```bash
git add serverless.yml
git commit -m "feat(infra): expone demo-trigger HTTP endpoint + IAM lambda:InvokeFunction"
git push
```

---

## Task 4: Frontend HTML + CSS del feature catalog (sin JS todavía)

**Files:**
- Create: `web/feature-catalog/index.html`

**Step 1: Escribir el HTML estático con todas las cards**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BioAlert+ · Catálogo de capacidades</title>
  <style>
    :root {
      --bg: #F8FAFC;
      --card: #FFFFFF;
      --primary: #16A34A;
      --primary-dark: #15803D;
      --secondary: #1B5BBF;
      --text: #0F172A;
      --text-soft: #64748B;
      --border: #E2E8F0;
      --tag-bg: #ECFDF5;
      --tag-text: #047857;
      --success: #10B981;
      --error: #DC2626;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 1.5rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--primary);
    }
    h1 { font-size: 1.8rem; font-weight: 700; }
    .lead { color: var(--text-soft); margin-top: 0.5rem; }
    .pill {
      display: inline-block;
      background: var(--tag-bg);
      color: var(--tag-text);
      padding: 0.2rem 0.6rem;
      border-radius: 99px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    section {
      margin-top: 2rem;
    }
    section h2 {
      font-size: 1.2rem;
      margin-bottom: 1rem;
      color: var(--text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: box-shadow 0.15s;
    }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 0.5rem;
    }
    .card-title { font-size: 1.05rem; font-weight: 600; }
    .card-desc { color: var(--text-soft); font-size: 0.9rem; line-height: 1.4; }
    .card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.5rem;
    }
    .btn {
      padding: 0.5rem 0.85rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      background: white;
      color: var(--text);
      transition: all 0.15s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .btn:hover { border-color: var(--primary); color: var(--primary); }
    .btn-primary {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }
    .btn-primary:hover { background: var(--primary-dark); border-color: var(--primary-dark); color: white; }
    .btn-secondary {
      background: #25D366; /* WhatsApp green */
      color: white;
      border-color: #25D366;
    }
    .btn-secondary:hover { background: #1FBA5A; border-color: #1FBA5A; color: white; }
    .btn-view {
      background: var(--secondary);
      color: white;
      border-color: var(--secondary);
    }
    .btn-view:hover { background: #134DA1; border-color: #134DA1; color: white; }
    .card-status {
      font-size: 0.8rem;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      background: #F1F5F9;
      color: var(--text-soft);
      display: none;
    }
    .card-status.show { display: block; }
    .card-status.ok { background: #ECFDF5; color: #047857; }
    .card-status.err { background: #FEF2F2; color: #DC2626; }
    .info-card {
      background: #F0F9FF;
      border-color: #BAE6FD;
    }
  </style>
</head>
<body>
  <header>
    <h1>🍎 BioAlert+ · Catálogo de capacidades</h1>
    <p class="lead">
      Demo en vivo · COLEGIO DEMO 680 · Padre demo: Diana (madre de Mateo).
      Cada feature tiene hasta 3 modos: <strong>disparar real</strong> (llega a WhatsApp),
      <strong>abrir en WhatsApp</strong> (texto pre-escrito) o <strong>ver vista web</strong>.
    </p>
  </header>

  <section>
    <h2>Conversacional · Padre</h2>
    <div class="grid" data-section="parent"></div>
  </section>

  <section>
    <h2>Conversacional · Admin cafetería</h2>
    <div class="grid" data-section="admin"></div>
  </section>

  <section>
    <h2>Crons event-driven</h2>
    <div class="grid" data-section="cron"></div>
  </section>

  <section>
    <h2>Diferenciadores no demostrables como botón</h2>
    <div class="grid" data-section="view_only"></div>
  </section>

  <script src="./app.js"></script>
</body>
</html>
```

**Step 2: Smoke test visual (sin JS todavía)**

El HTML referencia `app.js` que no existe — el browser va a mostrar las sections vacías. Eso es OK por ahora; estamos validando que el CSS/markup compila.

Abrir el archivo con `open web/feature-catalog/index.html` (o equivalente). Expected: header verde + 4 secciones con título pero grids vacíos.

**Step 3: Commit**

```bash
git add web/feature-catalog/index.html
git commit -m "feat(web): HTML+CSS del feature catalog (sin JS)"
```

---

## Task 5: Frontend JS — render cards + dispatch a Lambda

**Files:**
- Create: `web/feature-catalog/app.js`

**Step 1: Escribir el JS que hace render + acciones**

```javascript
// web/feature-catalog/app.js

// Token embebido para el demo. Es la key del SSM /bioalert/hackathon/demo/trigger-token.
// Solo restringe acceso al endpoint público de la Lambda demo-trigger.
// Para producción esto se cambiaría por auth real.
const DEMO_TOKEN = '__REPLACE_WITH_TOKEN_FROM_TASK_3__'
const TRIGGER_URL = 'https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/demo/trigger'
const VIEW_BASE = 'https://bioalert-web-hackathon-642722971137.s3.us-east-1.amazonaws.com/'
const SANDBOX_NUMBER = '+15558988030' // ← reemplazar con tu KAPSO_SANDBOX_NUMBER real

const FEATURES = [
  // copy/paste desde lambdas/shared/feature-manifest.ts (mismo array)
  // (lo duplico acá porque feature-manifest.ts es TS y este es JS vanilla)
  {
    id: 'consumption_today', kind: 'conversational_parent',
    title: '¿Qué comió hoy?', cobertura: 'US-01',
    description: 'Lista de compras del estudiante hoy (timezone Bogotá), con hora, producto y monto.',
    whatsapp_text: '¿qué comió Mateo hoy?',
  },
  // ... [copiar el resto desde feature-manifest.ts]
]

const SECTION_MAP = {
  conversational_parent: 'parent',
  conversational_admin: 'admin',
  cron: 'cron',
  view_only: 'view_only',
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v
    else if (k === 'onClick') node.addEventListener('click', v)
    else if (k === 'href') node.href = v
    else if (k === 'target') node.target = v
    else node.setAttribute(k, v)
  }
  for (const c of children) {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c))
    else if (c) node.appendChild(c)
  }
  return node
}

async function triggerAws(featureId, statusEl) {
  statusEl.textContent = '⏳ Enviando…'
  statusEl.className = 'card-status show'
  try {
    const res = await fetch(TRIGGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Token': DEMO_TOKEN },
      body: JSON.stringify({ feature: featureId }),
    })
    const json = await res.json()
    if (res.ok) {
      const phone = json.details?.phone
      statusEl.textContent = phone
        ? `✅ Webhook firmado y enviado. Mensaje a ${phone}. Revisá WhatsApp.`
        : `✅ Cron disparado (${json.details?.lambda}). El resultado llega vía WhatsApp en ~5-15s.`
      statusEl.className = 'card-status show ok'
    } else {
      statusEl.textContent = `❌ Error ${res.status}: ${JSON.stringify(json)}`
      statusEl.className = 'card-status show err'
    }
  } catch (e) {
    statusEl.textContent = `❌ Network: ${e.message}`
    statusEl.className = 'card-status show err'
  }
}

function renderCard(f) {
  const statusEl = el('div', { className: 'card-status' })
  const actions = el('div', { className: 'card-actions' })

  // Botón 1: Trigger AWS (cuando aplica)
  if (f.kind === 'conversational_parent' || f.kind === 'conversational_admin' || f.kind === 'cron') {
    actions.appendChild(el('button', {
      className: 'btn btn-primary',
      onClick: () => triggerAws(f.id, statusEl),
    }, ['🤖 Disparar real']))
  }

  // Botón 2: wa.me (cuando hay whatsapp_text)
  if (f.whatsapp_text) {
    const wa = `https://wa.me/${SANDBOX_NUMBER.replace('+', '')}?text=${encodeURIComponent(f.whatsapp_text)}`
    actions.appendChild(el('a', {
      className: 'btn btn-secondary',
      href: wa, target: '_blank',
    }, ['💬 Abrir en WhatsApp']))
  }

  // Botón 3: View link (cuando hay view_path)
  if (f.view_path) {
    actions.appendChild(el('a', {
      className: 'btn btn-view',
      href: VIEW_BASE + f.view_path, target: '_blank',
    }, ['🔗 Ver vista']))
  }

  return el('div', { className: f.kind === 'view_only' ? 'card info-card' : 'card' }, [
    el('div', { className: 'card-head' }, [
      el('div', { className: 'card-title' }, [f.title]),
      el('span', { className: 'pill' }, [f.cobertura]),
    ]),
    el('div', { className: 'card-desc' }, [f.description]),
    statusEl,
    actions,
  ])
}

function main() {
  for (const f of FEATURES) {
    const section = SECTION_MAP[f.kind]
    if (!section) continue
    const grid = document.querySelector(`[data-section="${section}"]`)
    if (!grid) continue
    grid.appendChild(renderCard(f))
  }
}

main()
```

**Step 2: Copiar el array FEATURES completo desde feature-manifest.ts**

Abrir `lambdas/shared/feature-manifest.ts`, copiar el array `FEATURES` y traducirlo a JS sintaxis (sacar `as FeatureSpec[]`, etc.). Asegurate que TODOS los 17 features (parent + admin + cron + view_only) estén replicados.

**Step 3: Reemplazar el placeholder del token**

```bash
# El TOKEN del paso 3 de Task 3. Editar manualmente web/feature-catalog/app.js
# y cambiar __REPLACE_WITH_TOKEN_FROM_TASK_3__ por el valor real.
```

**Step 4: Reemplazar SANDBOX_NUMBER con el real**

```bash
SANDBOX=$(aws ssm get-parameter --name /bioalert/hackathon/kapso/sandbox-number \
  --with-decryption --query Parameter.Value --output text \
  --profile biofood-hackathon --region us-east-1)
echo "KAPSO_SANDBOX_NUMBER: $SANDBOX"
# Editar app.js y reemplazar el placeholder '+15558988030' por $SANDBOX.
```

**Step 5: Test local — abrir en browser**

```bash
open web/feature-catalog/index.html
```

Expected: las 4 secciones se llenan de cards. Botones aparecen.

**Step 6: Test funcional — click en "Disparar real" de "¿Qué comió hoy?"**

- Click en el botón verde de la primera card.
- Esperado: status cambia a "⏳ Enviando…" → "✅ Webhook firmado y enviado…"
- En 5-10s te llega el mensaje a WhatsApp.

**Step 7: Commit**

```bash
git add web/feature-catalog/app.js
git commit -m "feat(web): JS del feature catalog con 3 modos por feature"
```

---

## Task 6: Deploy a S3 + smoke test cada categoría

**Files:** ninguno

**Step 1: Subir los 2 archivos a S3**

Run:
```bash
aws s3 cp web/feature-catalog/index.html \
  s3://bioalert-web-hackathon-642722971137/feature-catalog/index.html \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache, max-age=0" \
  --profile biofood-hackathon --region us-east-1

aws s3 cp web/feature-catalog/app.js \
  s3://bioalert-web-hackathon-642722971137/feature-catalog/app.js \
  --content-type "application/javascript; charset=utf-8" \
  --cache-control "no-cache, max-age=0" \
  --profile biofood-hackathon --region us-east-1
```

**Step 2: Abrir la URL pública (HTTPS REST endpoint)**

URL: `https://bioalert-web-hackathon-642722971137.s3.us-east-1.amazonaws.com/feature-catalog/index.html`

Expected: la página carga, las 4 secciones con cards aparecen, botones se ven.

**Step 3: Smoke test categórico (1 click por sección, 4 clicks total)**

1. **Parent · "¿Qué comió hoy?" · Disparar real**
   - Click verde
   - Status muestra "Enviando…" → "✅ Webhook firmado…"
   - WhatsApp llega en ~5-10s

2. **Admin · "Stock crítico" · Abrir en WhatsApp**
   - Click WhatsApp verde
   - Se abre WhatsApp con `¿qué tengo en stock crítico hoy?` pre-escrito
   - User toca enviar manualmente — verificar que llega respuesta

3. **Cron · "Reporte nutricional semanal" · Disparar real**
   - Click verde
   - Status "Cron disparado (bioalert-hackathon-nutrition-weekly)…"
   - WhatsApp con reporte semanal llega en ~5-10s

4. **View · "Confirmar recarga → Wompi" · Ver vista**
   - Click azul "🔗 Ver vista"
   - Se abre la página wompi-mock con tarjeta de pago demo

**Step 4: Si los 4 pasan, commit + push**

```bash
git push
```

---

## Task 7: Documentar en CLAUDE.md + ofrecer al equipo

**Files:**
- Modify: `CLAUDE.md` (sección §7 o §8 dependiendo de versión)

**Step 1: Agregar mención al catálogo en CLAUDE.md**

Buscar la sección de "Vistas web (extensiones)" o equivalente. Agregar línea:

```markdown
- Feature catalog (demo de capacidades): **done** —
  `web/feature-catalog/` deployado en S3.
  URL: https://bioalert-web-hackathon-642722971137.s3.us-east-1.amazonaws.com/feature-catalog/index.html
  Cada feature tiene hasta 3 modos: trigger AWS (botón verde), abrir
  WhatsApp con texto pre-escrito (botón WhatsApp), ver vista web (botón azul).
  Backend: Lambda `demo-trigger` que firma webhook fake de Kapso o invoca
  Lambdas cron según el tipo de feature.
```

**Step 2: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: documentar feature catalog en CLAUDE.md"
git push
```

**Step 3: Abrir PR a main**

URL:
```
https://github.com/miguelnietoa/bioalert-caribetech-hackathon/compare/main...feature-catalog?expand=1
```

Título sugerido:
```
feat: feature catalog — página demo con trigger AWS, wa.me y links a vistas
```

---

## Definition of Done

- [ ] `lambdas/shared/feature-manifest.ts` con los 17 features definidos
- [ ] `lambdas/demo-trigger/index.ts` con handler conversational + cron + token check + CORS
- [ ] `serverless.yml` con la nueva función `demo-trigger` + permiso `lambda:InvokeFunction` + SSM token creado
- [ ] `npx tsc --noEmit` EXIT 0
- [ ] `web/feature-catalog/index.html` con cards renderizadas en 4 secciones
- [ ] `web/feature-catalog/app.js` con los 3 tipos de botón por feature
- [ ] Páginas en S3 con URL HTTPS pública
- [ ] Smoke test categórico (parent · admin · cron · view) los 4 funcionan
- [ ] PR a main abierta

## Riesgos conocidos / TODO post-pitch

1. **Token embebido en JS** — para producción debería ser auth con OAuth o JWT corto. En hackathon es OK.
2. **CORS abierto a `*`** — para producción restringir al dominio del bucket o de CloudFront.
3. **Sin rate limit** — alguien con el token puede inundar el bot. Para hackathon es OK.
4. **`view_only` features** (multi-hijo, EXT-4, timezone) están en cards informativas sin botón — solo visual.
