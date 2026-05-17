# Arquitectura BioAlert+

> Documento para pasarle a Claude.ai u otro LLM como contexto del proyecto.
> Cubre: qué es el producto, stack, servicios AWS usados, componentes,
> flujos principales y referencias a los diagramas visuales.

---

## 1. Qué es BioAlert+

**BioAlert+** es un agente conversacional de WhatsApp para padres y administradores de cafeterías escolares de **Biofood** (~90 colegios en Colombia, ~4.26M ventas y ~305k recargas en el dataset del reto).

El producto convierte la data transaccional que Biofood ya tiene en Postgres (ventas y recargas de cafetería) en:

- **Respuestas conversacionales** por WhatsApp ("¿qué comió mi hijo hoy?", "¿cuánto le recargo?").
- **Alertas proactivas** que llegan solas (alérgeno detectado, ausencia de consumo, saldo por agotarse, stock crítico).
- **Reportes semanales** automatizados (nutricional para el padre, business intelligence para la cafetería).
- **Vistas web** complementarias para análisis profundo (catálogo de capacidades del producto, dashboard de insights para la cafetería).

Construido en 24h para el hackathon **Caribe Tech Arena 2026** (premio $2M COP). Stack 100% serverless en AWS, IA conversacional con Claude API.

---

## 2. Decisiones de stack (resumen)

| Capa | Tecnología | Por qué |
|---|---|---|
| Runtime | **Node.js 20** | Pedido en el PRD oficial de Biofood. |
| Lenguaje | **TypeScript** (ESM, target ES2022) | Tipado fuerte ahorra tiempo de debugging en hackathon. |
| Empaquetado | **Serverless Framework v4** + esbuild | IaC declarativa con bundling nativo. |
| Compute | **AWS Lambda** | Sin servidores que mantener, escala automática. |
| Persistencia | **Amazon RDS Postgres 15** (db.t4g.micro) | El PRD lo pidió + permite SQL crudo con índices propios. |
| Estado conversacional | **Amazon DynamoDB** (TTL 1h) | Sesiones cortas; pay-per-request. |
| HTTP entrante | **Amazon API Gateway** (HTTP API) | Más barato y simple que REST API. |
| Programación | **Amazon EventBridge Schedules** | Crons nativos sin contenedores. |
| Secrets | **AWS SSM Parameter Store** | Gratis, integrado con IAM. |
| Vistas web | **Amazon S3 + CloudFront** | Estáticas, sin servidor. |
| Canal WhatsApp | **Kapso Sandbox** (entrada) + **Meta Cloud API** (salida) | Kapso da inbound con webhooks HMAC en minutos; Meta para outbound directo elimina latencia extra. |
| IA conversacional | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | Mejor tool calling, mismo precio que Sonnet 4. |
| IA batch | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | 1/3 del costo para reportes semanales. |

---

## 3. Servicios AWS usados (la arquitectura serverless)

Todo corre dentro de una cuenta AWS Free Tier dedicada. Cero servidores administrados, cero containers.

### 3.1. Compute · AWS Lambda
**11 funciones**, todas Node.js 20 + TypeScript, empaquetadas con esbuild:

**Síncronas (HTTP-triggered):**
- `conversation-handler` — corazón del bot. Recibe webhook de Kapso, llama a Claude Sonnet 4.6 con 9 tools registradas, queryea Postgres, mantiene contexto en DynamoDB, responde por WhatsApp.
- `cafeteria-insights-api` — sirve el dashboard React. 8 queries SQL en paralelo (orders, summary, benchmark, discontinue, launch, parent insights, critical stock).
- `demo-trigger` — bridge para el feature catalog: firma webhooks fake hacia conversation-handler o invoca async otras Lambdas para que el jurado dispare features desde el browser.
- `pos-api` — sirve `GET /pos/student/{id}/flags` al POS mock. Devuelve nombre, saldo y sugerencias sutiles activas del padre con sus sustitutos.

**Programadas (EventBridge cron):**
- `allergen-polling` (cada 60s) — detecta ventas con alérgenos del estudiante y notifica al padre en <30s.
- `absence-cron` (12 PM Bogotá) — padres cuyo hijo no compró hoy reciben aviso.
- `stock-cron` (7 AM Bogotá) — admin recibe lista de productos en stock crítico.
- `balance-cron` (8 AM Bogotá) — padres cuyo hijo se queda sin saldo en ≤2 días reciben alerta + CTA de recarga.
- `streak-detector` (7:30 AM Bogotá) — detecta categorías que el estudiante repite 3+ días en últimos 5 días hábiles y envía WhatsApp interactivo al padre con 3 botones (alertar/restringir/alternativas).
- `nutrition-weekly` (Domingo 6 PM) — reporte nutricional del estudiante con top productos, macros, comparación con compañeros.
- `cafeteria-weekly` (Lunes 7 AM) — reporte semanal a la cafetería con benchmark nacional + señales agregadas de padres.

### 3.2. API · Amazon API Gateway (HTTP API)
**4 rutas públicas**:
- `POST /webhook/kapso` → conversation-handler (Kapso firma con HMAC-SHA256).
- `POST /demo/trigger` → demo-trigger (protegido con token simple en header).
- `GET /cafeteria-insights` → cafeteria-insights-api (público, CORS abierto).
- `GET /pos/student/{studentId}/flags` → pos-api (público, CORS abierto).

Endpoint actual: `https://c8brdpdf03.execute-api.us-east-1.amazonaws.com`.

### 3.3. Datos · Amazon RDS PostgreSQL 15.7
Instancia `db.t4g.micro` (ARM, 1 vCPU, 1 GB RAM). Schemas:

**Schema `reto`** (clon del dataset oficial del hackathon, solo lectura semánticamente):
- `reto.ventas` — 4.26M filas de compras de cafetería en 47 colegios, 2024-2026.
- `reto.recargas` — 305k filas de recargas de saldo por estudiante.

**Schema `bioalert`** (tablas nuestras, fixtures sintéticos):
- `parent_phone_map` — mapea `identificacion_padre` → `phone_e164` para entregar mensajes.
- `student_allergens` — alérgenos registrados por estudiante.
- `product_allergens` — alérgenos por producto del catálogo.
- `product_nutrition` — valores nutricionales por producto (estimados con Claude Haiku en un bootstrap script).
- `inventory` — stock actual y mínimo por producto/colegio.
- `cafeteria_admins` — teléfonos de admins por colegio.
- `benchmark_nacional_cache` — materialización del benchmark nacional para evitar 30s de scan en cada request.
- `streaks` — rachas detectadas pendientes de acción del padre.
- `restrictions` — restricciones activas creadas por el padre, con cafeteria_message hardcoded.
- `category_substitutes` — mapa estático: categoría restringida → productos sustitutos vendibles del catálogo Biofood.

### 3.4. Estado · Amazon DynamoDB
- Tabla `bioalert-conversations-hackathon` (PK: `phone_e164`, TTL 1h).
- Guarda historial de mensajes y resultados de tools para mantener contexto entre turnos.

### 3.5. Schedules · Amazon EventBridge
6 reglas que disparan las Lambdas cron mencionadas arriba. Usan crontab en UTC con offset para zona horaria Bogotá (UTC-5).

### 3.6. Web · Amazon S3 + CloudFront
Bucket `bioalert-web-hackathon-642722971137` sirve 4 vistas estáticas:
- `/feature-catalog/` — landing del demo, 17 capabilities con botones para dispararlas en vivo.
- `/cafeteria-insights/` — React + Tailwind, dashboard de insights para la cafetería (consume `cafeteria-insights-api`).
- `/nutrition-report/` — Chart.js, reporte nutricional semanal por estudiante.
- `/wompi-mock/` — checkout simulado de Wompi (pasarela colombiana).

### 3.7. Secrets · AWS SSM Parameter Store
Centraliza: API key de Claude, API key de Kapso, webhook secret, password del RDS, token del demo-trigger, etc. Las Lambdas los leen al cold start y cachean en memoria.

---

## 4. Componentes externos

### 4.1. Kapso (proveedor WhatsApp)
- Sandbox compartido para hackathon (alternativa instantánea a WhatsApp Business API directa, que requiere aprobación de Meta).
- Provee inbound: cuando un usuario manda texto al número del sandbox, Kapso firma un webhook HMAC-SHA256 y lo POST-ea a nuestro API Gateway.
- Para outbound usamos **Meta Cloud API directo** (no Kapso) para evitar saltos extra. El wrapper `lambdas/shared/whatsapp.ts` abstrae el canal.
- Sesión 24h: el usuario tiene que escribir primero al sandbox para que podamos responderle.

### 4.2. Claude API (Anthropic)
- **Sonnet 4.6** (`claude-sonnet-4-6`) en conversation-handler: razonamiento + tool calling con 9 tools registradas (consumption_today, balance_projection, nutrition_summary, recharge_recommendations, etc.).
- **Haiku 4.5** (`claude-haiku-4-5-20251001`) en crons: redacción de reportes semanales y estimación nutricional de productos (un bootstrap script). 1/3 del costo de Sonnet.

---

## 5. Flujos principales

### Flujo A · Padre pregunta algo por WhatsApp
1. Padre escribe "¿qué comió Mateo hoy?" al sandbox de Kapso.
2. Kapso firma con HMAC y POST-ea a `POST /webhook/kapso`.
3. API Gateway invoca `conversation-handler`.
4. La Lambda verifica el HMAC, lee la sesión de DynamoDB, llama a Claude Sonnet 4.6 con los 9 tools registrados.
5. Claude decide llamar `get_student_consumption_today(phone)` → la Lambda ejecuta SQL contra RDS, devuelve a Claude.
6. Claude redacta la respuesta natural + agrega explicabilidad ("te aviso esto porque…").
7. La Lambda actualiza DynamoDB y envía el texto al padre vía Meta Cloud API directo.
8. **Latencia objetivo: <4s**.

### Flujo B · Alerta proactiva (ejemplo: balance-cron)
1. EventBridge dispara `balance-cron` a las 8 AM Bogotá.
2. La Lambda corre una query agregada contra RDS para identificar estudiantes con saldo ≤ 2 días o sobregirado.
3. Por cada hit construye mensaje con saldo, gasto promedio, proyección y CTA a recarga.
4. Envía vía Meta Cloud API.

### Flujo C · Demo en vivo (feature catalog)
1. Jurado abre `https://…/feature-catalog/index.html` en el navegador.
2. Hace click en "🤖 Disparar" en una capability.
3. Browser hace `POST /demo/trigger` al API Gateway con un token.
4. `demo-trigger` valida el token, identifica si la feature es conversacional o cron:
   - Conversacional: firma un webhook fake como si viniera de Kapso y lo POST-ea a `/webhook/kapso` → activa el flujo A normal.
   - Cron: hace `InvokeAsync` directamente a la Lambda correspondiente.
5. El jurado ve el resultado por WhatsApp en 5-10 segundos.

### Flujo D · Dashboard de insights de cafetería
1. Admin abre `https://…/cafeteria-insights/index.html`.
2. La app React hace `GET /cafeteria-insights?nit=900000680`.
3. `cafeteria-insights-api` corre 8 queries SQL secuenciales contra RDS:
   - `summary` (ventas, pedidos, ticket)
   - `orders` (últimas 50)
   - `benchmark_piloto` + lectura de `benchmark_nacional_cache`
   - `discontinue` (productos con caída ≥30% vs 3 semanas anteriores)
   - `launch` (productos saludables top en otros colegios y ausentes acá)
   - `parent_signals` (padres alto azúcar, sobregirados, activos)
   - `critical_stock` (productos bajo mínimo)
4. Devuelve un JSON con shape `CafeteriaInsightsPayload`.
5. React renderiza con Tailwind.

### Flujo E · Rachas, restricciones y POS (padre → cafetería)

1. *Cron streak-detector 7:30 AM Bogotá*: para cada estudiante del piloto, detecta categorías con 3+ días distintos en los últimos 5 días hábiles.
2. Si encuentra una racha nueva → inserta en `bioalert.streaks` + WhatsApp **interactivo** al padre con 3 botones (Solo alertar / Restringir / Alternativas).
3. Padre toca un botón (o responde por texto): el `conversation-handler` procesa con las tools `acknowledge_streak`, `activate_restriction`, `get_substitutes`.
4. Si crea restricción → fila en `bioalert.restrictions` con `cafeteria_message` hardcoded por categoría (tono sutil, no punitivo). La restricción tiene vigencia: 1 semana, 1 mes o indefinida.
5. *Cafetería*: el cajero abre la página POS mock, ingresa el código del estudiante → `GET /pos/student/{id}/flags` → la página muestra saldo + tarjeta verde-acento con la sugerencia del padre + sustitutos vendibles concretos.
6. Tagline operativa: *"No bloqueamos ventas. Redirigimos demanda."*

URLs vivas:
- POS mock: <https://bioalert-web-hackathon-642722971137.s3.us-east-1.amazonaws.com/pos-mock/index.html>
- Casos demo: Mateo `0010204385` (bebida), Antonella `0010204361` (dulce), Valentina `0010130672` (control sin restricción).

---

## 6. Lo que NO construimos (intencionalmente)

- Frontend Angular existente de Biofood (prohibido por PRD).
- Modelos ML propios (prohibido por PRD — todo va por Claude API o SQL).
- Multi-tenant (1 colegio piloto hardcodeado).
- Pasarela de pagos real (Wompi mockeado para demo).
- Sistema de auth (el número de WhatsApp ES la identidad).
- App móvil nativa.
- Tests unitarios formales (no hay tiempo en hackathon).

---

## 7. Métricas objetivo

| Métrica | Meta |
|---|---|
| Respuesta conversacional | < 4 s |
| Detección de alérgeno | 100 % (regla determinista, no ML) |
| Entrega de alerta crítica | < 30 s |
| Procesamiento alerta masiva | < 2 min para todos los estudiantes del piloto |
| Precisión proyección de saldo | ± 2 días |

---

## 8. Diagramas visuales

En este mismo directorio (`docs/`):

- **`bioalert-arch-light.png`** — diagrama de arquitectura de alto nivel para fondos claros. Muestra la caja `AWS Cloud · us-east-1` conteniendo los servicios usados (API Gateway, EventBridge, CloudFront+S3, SSM, Lambda, RDS, DynamoDB, CloudWatch), con Kapso (WhatsApp), Claude API y el navegador como elementos externos.
- **`bioalert-arch-dark.png`** — la misma arquitectura en paleta oscura (slate-900 background, accents vibrantes). Ideal para slides con fondo oscuro.

En el README ambas se exponen vía `<picture>` con `prefers-color-scheme`, así GitHub elige automáticamente la versión correcta según el tema del lector.

---

## 9. Para el LLM que recibe este documento

Si recibes este markdown como contexto, asume que:

- El producto está **construido y desplegado en AWS** (no es vaporware). Endpoint público funcional.
- La arquitectura es **100 % serverless**: ni un solo servidor, container o instancia EC2.
- Todo el código fuente está en TypeScript bajo `lambdas/` y `web/`.
- El dataset es **real** (4.26M ventas, 305k recargas de Biofood) con fixtures sintéticos para alérgenos, teléfonos e inventario.
- El diferenciador del producto no es la tecnología sino la **explicabilidad obligatoria** (cada respuesta del bot incluye "te aviso esto porque…") y el **insight cruzado padre↔cafetería**: las señales agregadas de conversaciones de padres se entregan a la cafetería como recomendaciones accionables.

Si te piden generar:
- **Slides del pitch**: enfatiza los 3 pilares del reto (ticket de recarga via EXT-1, nutrición via EXT-2, analítica de cafetería via EXT-3+EXT-5).
- **Otro diagrama**: usa la lista de servicios AWS de la sección 3 y los flujos de la sección 5.
- **Estimación de costos**: la cuenta corre en Free Tier; RDS (~$0.72/24h) es el único servicio fuera de free tier para el hackathon.
- **Casos de uso adicionales**: revisa los 5 user stories del PRD (US-01 a US-05) y las 6 extensiones (EXT-1 a EXT-6) en `CLAUDE.md` raíz.
