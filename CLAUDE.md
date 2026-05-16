# CLAUDE.md — Memoria persistente BioAlert+

> **Lee este archivo COMPLETO al inicio de cada nueva sesión antes de tocar nada.** Es la fuente de verdad para el proyecto. Si una sección queda desactualizada, actualízala al cerrar la fase.

---

## 0. Documentos fuente

- `biofood-hackathon-plan.md` (raíz) — plan completo de 24h del equipo. Contexto, extensiones EXT-1..EXT-6, cronograma, riesgos.
- `docs/Biofood_PRD_BioAlert_Reto_Hackaton.pdf` — PRD oficial de Pedro Noguera (CEO Biofood). **VERDAD técnica no negociable.**

Cuando haya conflicto: PRD gana en stack/arquitectura, plan gana en alcance (porque agrega extensiones para cubrir los 3 pilares del brief público). **Desviaciones explícitas del PRD** (justificadas por velocidad de hackathon o realidad operativa) se documentan en §2.1 abajo.

---

## 1. Resumen ejecutivo

BioAlert+ es un agente de WhatsApp para padres y administradores de cafeterías escolares de Biofood. Convierte la data transaccional existente en PostgreSQL en alertas proactivas (alérgenos, ausencia de consumo, stock crítico) y respuestas conversacionales en lenguaje natural. Sobre el PRD literal (5 user stories, stack AWS Serverless + Node.js + Claude API) agregamos seis extensiones quirúrgicas (EXT-1..EXT-6) que cubren los 3 pilares del brief público: recarga inteligente con anchoring, reporte nutricional semanal, analítica con benchmark nacional para la cafetería, explicabilidad en cada alerta, insight cruzado padre↔cafetería y quick replies. Demo arranca con caso real "Diana y Mateo" del dataset; pitch cierra con uplift de ticket en $ extrapolado a los 90 colegios de Biofood. **Premio: $2.000.000 COP. Hackathon 24h. Equipo: 3 devs senior + 1 product senior (4 personas total).**

### 1.1. Dataset real disponible (extraído de reto.biofoodsoftware.co)

- Postgres en `3.208.123.187:5432`, db `biofooddb`, usuario `hackathon_dev`, read-only sobre tablas existentes. Credenciales en `.env.example` (públicas, parte del reto).
- **~4.2M ventas + ~3M recargas, años 2024-2026.** El PRD dice "últimos 30 días" para acotar contexto al LLM, pero el análisis exploratorio y el cálculo de uplift pueden y deben usar toda la historia.
- Cuentas demo de la plataforma Biofood existente (admin de colegio + padre) en `.env.example` — sirven para testear UX actual y entender las tablas reales.

---

## 2. Stack (del PRD §04 + decisiones lockeadas)

| Capa | Tecnología | Origen |
|---|---|---|
| Runtime | **Node.js 20** | PRD |
| Lenguaje | **TypeScript** (ES modules, target ES2022) | decisión equipo |
| Backend | Lambdas (handler estilo Express) | PRD |
| Deploy / IaC | **Serverless Framework v4** (`serverless.yml`) con esbuild built-in para TS | decisión equipo |
| API entrante | API Gateway (HTTP API) | PRD |
| BD | PostgreSQL — Biofood Global DB existente (acceso confirmado, solo lectura sobre tablas existentes) | PRD |
| Connection pool | **RDS Proxy** — SQL crudo, **sin ORM** | PRD |
| Motor IA (conversacional) | **Claude Sonnet 4.6** — `claude-sonnet-4-6` | desviación PRD (ver §2.1) |
| Motor IA (batch / crons) | **Claude Haiku 4.5** — `claude-haiku-4-5-20251001` | decisión equipo |
| Canal | **Kapso Sandbox** durante el hackathon (TypeScript SDK nativo, interactive messages soportados, webhooks con HMAC security). **Twilio WhatsApp Sandbox** como fallback si Kapso da fricción en H0-H3. El wrapper `lambdas/shared/whatsapp.ts` abstrae el canal para que el switch sea barato y para migrar a Meta Cloud API post-hackathon sin tocar las Lambdas. | desviación PRD (ver §2.1) |
| Cron / alertas | EventBridge → Lambda | PRD |
| Estado conversacional | DynamoDB (`conversations`, TTL 1h) | PRD |
| Secrets | SSM Parameter Store | PRD |
| Infra | AWS Serverless. **Sin microservicios.** Cuenta nueva de AWS Free Tier (sandbox personal de Miguel) | PRD + decisión equipo |
| Vistas estáticas (extensiones) | S3 + CloudFront, HTML/JS puro o Next.js exportado estático | plan |

### 2.1. Desviaciones del PRD (justificadas)

| Decisión PRD | Qué hacemos | Por qué |
|---|---|---|
| `claude-sonnet-4-20250514` | `claude-sonnet-4-6` para conversación, `claude-haiku-4-5-20251001` para crons | El modelo del PRD está **deprecated y se retira 2026-06-15** (un mes post-hackathon). Sonnet 4.6 es estrictamente superior en tool calling al mismo precio ($3/$15 por MTok). Haiku 4.5 corta el costo de los crons a un tercio ($1/$5). |
| WhatsApp Business API (Meta Cloud API directa) | **Kapso Sandbox** (primario) / Twilio Sandbox (fallback) | Meta puede tardar horas o días en aprobar incluso sandbox. Kapso y Twilio son instantáneos. Kapso gana porque tiene SDK TypeScript nativo, soporte explícito de interactive messages (necesarios para EXT-6) y webhooks con HMAC. La abstracción en `lambdas/shared/whatsapp.ts` permite migrar a Meta directo post-hackathon. |
| Tabla nutricional cruzada manualmente con USDA/ICBF | Bootstrap script que llama a Claude una sola vez para estimar valores nutricionales de cada producto del catálogo Biofood y persiste en `product_nutrition` | Cruzar manualmente USDA/ICBF con productos colombianos era 4h de Dev 4 sin valor diferencial. Claude estima con calidad razonable para el demo. |
| Modelo de datos relacional (`students`, `transactions`, `products`, `inventory`...) | Adaptación al schema real del reto: dos tablas planas (`hackaton_ventas`, `hackaton_recargas`) + fixtures `bioalert_*` en el mismo schema | El reto no expone schema relacional. `usuario_identificacion` reemplaza a `students.id`, `nombre_producto` reemplaza a `products.id`, balance se calcula on-the-fly. **`grade` no existe → EXT-2 peer compare se degrada a "compañeros del mismo colegio".** Detalle en `docs/db-schema.md`. |

### 2.2. Prohibido por el PRD — respetar literal

Tocar el frontend Angular existente, entrenar modelos ML propios, multi-tenant (1 colegio piloto hardcodeado), flujo de registro de usuarios (el número de WhatsApp ES la identidad), históricos >30 días, B2B para proveedores.

---

## 3. Alcance: 5 US del PRD + 6 extensiones

### User Stories del PRD (no negociables — §03)

| ID | Qué | Trigger | Latencia objetivo |
|---|---|---|---|
| **US-01** | "¿Qué comió mi hijo hoy?" conversacional | Webhook entrante WhatsApp (Kapso) | <4s |
| **US-02** | Alerta proactiva si no hay consumo al mediodía | EventBridge Cron 12:00 PM Colombia | <2 min para todos |
| **US-03** | Alerta inmediata de alérgeno | Polling Lambda cada 60s sobre `transactions` | <30s desde transacción |
| **US-04** | Proyección de agotamiento de saldo | Mensaje conversacional del padre | ±2 días error |
| **US-05** | Alerta de stock crítico al admin | EventBridge Cron 7:00 AM | (best effort) |

### Extensiones del plan (cubren los 3 pilares del brief público — §3 del plan)

| ID | Qué | Pilar |
|---|---|---|
| **EXT-1** | 3 opciones de recarga (Esencial / Equilibrada / Bienestar) con narrativa data-driven y anchoring | Pilar 1 (ticket) |
| **EXT-2** | Reporte nutricional semanal proactivo domingo 6PM con comparativa peer + vista web estática | Pilar 2 (nutrición) |
| **EXT-3** | Reporte semanal lunes 7AM al admin de cafetería con benchmark nacional + vista web estática | Pilar 3 (analítica) |
| **EXT-4** | Explicabilidad ("por qué te aviso esto") en TODA alerta y respuesta — vive en el system prompt | UX diferencial |
| **EXT-5** | Insight cruzado padre↔cafetería: agregamos señales (preguntas, opciones elegidas, alertas) y las entregamos a la cafetería | "Wow" del demo |
| **EXT-6** | Quick replies de WhatsApp (interactive messages con botones — Kapso `send-buttons`) | Pulido de producto |

### Tools del agente conversacional (Claude API — plan §5)

1. `get_student_consumption_today(phone)` — US-01
2. `get_student_consumption_week(phone)`
3. `get_nutrition_summary(phone, days)` — EXT-2
4. `get_balance_projection(phone)` — US-04
5. `get_recharge_recommendations(phone)` — EXT-1
6. `compare_to_peers(phone)` — EXT-2
7. `get_school_alerts(phone, school_id)` — US-05 (solo admin)
8. `get_cafeteria_benchmark(school_id)` — EXT-3 (solo admin)

---

## 4. Modelo de datos

> El PRD §05 lista tablas que **NO existen** en el reto. Inspección completa de la DB real en `docs/db-schema.md`. Resumen:

### Tablas reales del reto (solo lectura, schema `public`)

- **`hackaton_ventas`** (4.26M filas) — denormalizada, todo `text`. Campos clave: `usuario_identificacion`, `nombre_estudiante`, `fecha::text`, `cantidad::text`, `precio::text`, `nombre_producto`, `identificacion_padre`, `nombre_padre`, `colegio`, `nit_colegio`.
- **`hackaton_recargas`** (305k filas) — tipos limpios. `id bigint PK`, `fecha date`, `valor numeric`, mismas dimensiones de identificación. `identificacion_padre` NULL ≈80% de los casos.

Rango temporal: ventas 2024-01-08 → 2026-05-29 (futuro); recargas 2024-01-07 → 2026-05-15. **47 colegios, 19.2k estudiantes, 11.9k padres, 6.7k productos distintos** (con duplicados — ver gotchas en `docs/db-schema.md` §4).

### Permisos del usuario `hackathon_dev`

- ✅ `CREATE` en schema `public` → **podemos crear nuestras tablas en la misma DB**, sin RDS extra
- ✅ `SELECT` sobre `hackaton_*`
- ❌ `INSERT/UPDATE/DELETE` sobre `hackaton_*`
- ❌ `CREATE DATABASE`

### Tablas nuestras (prefijo `bioalert_*`, schema `public`, BLOQUEADOR H0-H2)

```
bioalert_parent_phone_map  (identificacion_padre PK, phone_e164)
bioalert_cafeteria_admins  (phone_e164 PK, nit_colegio)
bioalert_student_allergens (usuario_identificacion, allergen_name)
bioalert_product_allergens (nombre_producto, allergen_name)
bioalert_inventory         (nombre_producto, nit_colegio, current_stock, minimum_stock)
bioalert_product_nutrition (nombre_producto PK, canonical_name, calories_100g, sugar_g,
                            fat_g, protein_g, sodium_mg, estimated_by, estimated_at)
```

`bioalert_product_nutrition` se puebla con un bootstrap script que llama a Claude (`claude-haiku-4-5`) sobre los **top productos del colegio piloto** (~50-150), NO los 6,783 globales. El script también devuelve `canonical_name` para consolidar variantes ortográficas (ej. siete formas distintas de "dedito de queso").

### En DynamoDB

- `bioalert_conversations` (phone_e164, session_json, updated_at) — TTL 1h

### Cómo las Lambdas hablan con la realidad

Las tools del agente queryean **directo contra `hackaton_*`** y joinean con `bioalert_*` para fixtures (alérgenos, teléfonos, nutrición). El balance proyectado de US-04 se computa como `SUM(recargas.valor) - SUM(ventas.cantidad::numeric * ventas.precio::numeric)` por `usuario_identificacion`. EXT-2 "comparación con compañeros de grado" se degrada a **"compañeros del mismo colegio"** porque no hay columna `grade`. Detalles y queries en `docs/db-schema.md` y `analysis/queries/`.

---

## 5. Convenciones de código

- **Node.js 20**, **TypeScript** (`"module": "ESNext"`, `"target": "ES2022"`, `"moduleResolution": "Bundler"`). Lambdas se empaquetan con esbuild a través de Serverless Framework v4.
- **ES modules** (`import/export`). Un solo `package.json` a nivel raíz para velocidad de hackathon (monorepo si surge necesidad).
- **`async/await`** en todo. Nada de callbacks ni `.then()` encadenado.
- **SQL crudo** con parámetros nombrados, **sin ORM**. Las queries viven en archivos `.sql` separados de la lógica TS y se cargan con `fs.readFileSync` al cold start. Patrón: `lambdas/<lambda>/queries/*.sql` + `lambdas/<lambda>/index.ts` los importa.
- Una Lambda = una carpeta = un `index.ts` + dependencias locales. `lambdas/shared/` para utilidades compartidas (db, whatsapp, claude, dynamo, ssm, types, logger).
- Variables de entorno cargadas desde SSM Parameter Store en el handler, cacheadas a nivel módulo entre invocaciones (cold start friendly).
- Logs estructurados (`console.log(JSON.stringify({...}))`) — CloudWatch Insights friendly.
- **Sin tests unitarios formales** en el hackathon (no hay tiempo). Smoke tests manuales con `node --test` solo para utilidades críticas de `lambdas/shared/` si surge necesidad real.
- Tipos compartidos en `lambdas/shared/types.ts`. Cero `any` salvo cuando interactuamos con SDKs sin tipos.
- Comentarios solo cuando el "por qué" no sea obvio del código.

---

## 6. Lo que NO construimos (plan §13)

- Frontend Angular (PRD lo prohíbe)
- Modelos ML entrenados (PRD lo prohíbe — todo va por Claude API o queries SQL puras)
- Multi-tenant (PRD lo prohíbe — 1 colegio piloto)
- Pasarela de pagos (regulatorio + no aporta)
- Sistema de auth (el número de WhatsApp es la identidad — PRD)
- Onboarding de usuarios (fixture precargado — PRD)
- App móvil nativa (WhatsApp basta)
- Dashboard complejo (vista estática mínima de UNA página por vista, no SPA)
- Réplica de ISA (el bot existente de Biofood)
- Modificaciones a tablas existentes (solo lectura)
- Tests unitarios formales con coverage (no hay tiempo)
- B2B para proveedores
- Cruzar manualmente USDA/ICBF con catálogo Biofood (Claude estima)

---

## 7. Reparto del equipo (4 personas: 3 devs + 1 product)

| Rol | Responsabilidad principal | Lambdas / Artefactos owned |
|---|---|---|
| **Dev 1 — Conversacional** | Canal WhatsApp + agente conversacional end-to-end | Kapso onboarding + `lambdas/conversation-handler/` (US-01, US-04, EXT-1, EXT-4, EXT-6) + las 8 tools + `lambdas/shared/whatsapp.ts` + `lambdas/shared/claude.ts` |
| **Dev 2 — Alertas** | Todas las alertas (síncronas y por cron) | `lambdas/allergen-polling/` (US-03) + `lambdas/absence-cron/` (US-02) + `lambdas/stock-cron/` (US-05) + `lambdas/nutrition-weekly/` (EXT-2) + `lambdas/cafeteria-weekly/` (EXT-3 + EXT-5) |
| **Dev 3 — Infra + Data + Web** | AWS, IaC, fixtures, vistas estáticas | Cuenta AWS + Serverless Framework setup + RDS Proxy + DynamoDB + SSM + S3/CloudFront + `data/fixtures/*.sql` + bootstrap nutrición con Claude + `web/nutrition-report/` + `web/cafeteria-insights/` + `lambdas/shared/db.ts` + `lambdas/shared/dynamo-conversations.ts` + `lambdas/shared/ssm.ts` |
| **Product Senior** | Caso demo + uplift + pitch (sin código) | EDA del dataset → elección de colegio piloto → caso "Diana y Mateo" + cálculo de uplift en 3 escenarios + outline de pitch (15 slides) + 3 ensayos completos |

Coordinación: Dev 3 desbloquea a Dev 1 y Dev 2 (sin AWS+DB no se puede testear nada en la nube). Producto Senior trabaja en paralelo con la DB en local desde H0.

---

## 8. Estado actual de cada componente

> Actualizar al cierre de cada fase. Estados: `not started` / `in progress` / `done` / `blocked`.

### Infra
- AWS account (Free Tier, sandbox personal Miguel): **not started**
- Serverless Framework v4 setup + serverless.yml base: **not started**
- RDS Proxy + conexión a Biofood Global DB: **not started** (acceso confirmado por equipo)
- DynamoDB `conversations`: **not started**
- API Gateway (HTTP API) webhook para Kapso: **not started**
- EventBridge Crons (12PM, 7AM, dom 6PM, lun 7AM): **not started**
- SSM Parameter Store (secrets: Claude API key, Kapso API key + webhook secret, DB creds): **not started**
- S3 + CloudFront para vistas estáticas: **not started**

### Canal
- **Kapso Sandbox** activado + webhook configurado + opt-in del equipo + plan de fallback Twilio: **not started** (ya no es bloqueador crítico porque ambos sandboxes son instantáneos)

### Lambdas
- `conversation-handler` (US-01, US-04, EXT-1, tools 1-8, modelo Sonnet 4.6): **not started**
- `allergen-polling` (US-03): **not started**
- `absence-cron` (US-02): **not started**
- `stock-cron` (US-05): **not started**
- `nutrition-weekly` (EXT-2): **not started**
- `cafeteria-weekly` (EXT-3 + EXT-5): **not started**
- `shared/` (db, whatsapp[Kapso], claude, dynamo, ssm, types, logger): **not started**

### Data
- Fixtures SQL (parent_phone_map, student_allergens, product_allergens, inventory, cafeteria_admins): **not started**
- Bootstrap nutrición: script que llama a Claude una vez con catálogo de productos del piloto → genera `product_nutrition.sql`: **not started**

### Web (extensiones)
- Vista nutrition-report (EXT-2): **not started**
- Vista cafeteria-insights (EXT-3): **not started**

### Producto
- Caso "Diana y Mateo" elegido y documentado: **not started**
- Cálculo de uplift por 3 escenarios + extrapolación 90 colegios: **not started**
- Pitch outline (15 slides max) + ensayos: **not started**

---

## 9. Métricas de éxito (PRD §07 + nuestras)

| Métrica | Meta |
|---|---|
| Tiempo respuesta conversacional | <4s |
| Detección de alérgenos | 100% (regla determinista, no ML) |
| Entrega de alerta crítica | <30s |
| Proceso alerta masiva (todos los estudiantes) | <2 min |
| Precisión proyección de saldo | ±2 días |
| 3 opciones de recarga personalizadas | funcionando para cualquier estudiante del dataset |
| Reporte nutricional semanal | generado para ≥5 estudiantes |
| Benchmark de cafetería | disponible para ≥1 colegio |
| Insight cruzado (EXT-5) | demostrable: 5+ padres consultan azúcar → cafetería ve alerta |

---

## 10. Gotchas operacionales del hackathon

- **Kapso Sandbox:** TypeScript SDK nativo, soporta `send-text`, `send-buttons`, `send-lists`, `send-image`, etc. Webhooks de entrada con HMAC security. Es un número compartido — confirmar en H0 el flujo exacto de opt-in (qué tiene que enviar el padre antes de poder recibir) y si hay rate limit o session window. Si surgen sorpresas, fallback a Twilio.
- **Twilio Sandbox (fallback):** opt-in con `join <code>`, sesión expira 3 días, rate limit 1 msg/3s, NO documenta soporte sandbox de interactive messages → si llegamos acá, EXT-6 puede degradar a texto + numeritos ("Responde 1, 2 o 3"). Colombia no está restringido.
- **AWS Free Tier:** RDS Proxy NO está en free tier (~$0.72 total las 24h). Lambda + DynamoDB + API Gateway + CloudWatch sí entran. Tener una tarjeta a mano por si AWS la pide.
- **Serverless Framework v4 licensing:** gratis para hackathon. Si Biofood adopta post-evento y tiene >$2M USD ingresos, requiere licencia paga.
- **Claude Sonnet 4 deprecation:** el PRD pidió `claude-sonnet-4-20250514` que se retira **2026-06-15**. Si Pedro pregunta por qué usamos otro modelo, la respuesta es esa.

---

## 11. Flujo de trabajo en cada sesión

1. Lee este `CLAUDE.md` completo. Si una sección dice "not started" no asumas que ya existe.
2. Lee la sección 7 (Estado actual) y decide en qué fase del cronograma del plan estamos.
3. Antes de codear: revisa los `README.md` de las subcarpetas relevantes — explican qué va dónde.
4. Al terminar una fase: actualiza la sección 8 (Estado actual) con lo que cambió. Commit con mensaje convencional (`feat:`, `chore:`, `fix:`, `docs:`).
5. Si tomas una decisión técnica que afecta a otros, documéntala en §2.1 (si desvía del PRD) o en el README de la carpeta correspondiente.

---

## 12. Una frase para defender el proyecto (apéndice del plan)

> *"BioAlert+ activa los 10 años de data transaccional de Biofood vía un agente WhatsApp que cumple los 3 pilares del reto: recargas más altas para padres con justificación nutricional personalizada, reportes nutricionales semanales con comparación con compañeros, e inteligencia accionable para cafeterías con benchmark nacional. Construido en el stack que Pedro Noguera definió en su PRD. Aplicado a los 90 colegios de Biofood, representa entre $1.2B y $2.4B COP adicionales en recargas anuales."*
