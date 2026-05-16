# CLAUDE.md — Memoria persistente BioAlert+

> **Lee este archivo COMPLETO al inicio de cada nueva sesión antes de tocar nada.** Es la fuente de verdad para el proyecto. Si una sección queda desactualizada, actualízala al cerrar la fase.

---

## 0. Documentos fuente

- `biofood-hackathon-plan.md` (raíz) — plan completo de 24h del equipo. Contexto, extensiones EXT-1..EXT-6, cronograma, riesgos.
- `docs/Biofood_PRD_BioAlert_Reto_Hackaton.pdf` — PRD oficial de Pedro Noguera (CEO Biofood). **VERDAD técnica no negociable.**

Cuando haya conflicto: PRD gana en stack/arquitectura, plan gana en alcance (porque agrega extensiones para cubrir los 3 pilares del brief público).

---

## 1. Resumen ejecutivo

BioAlert+ es un agente de WhatsApp para padres y administradores de cafeterías escolares de Biofood. Convierte la data transaccional existente en PostgreSQL en alertas proactivas (alérgenos, ausencia de consumo, stock crítico) y respuestas conversacionales en lenguaje natural. Sobre el PRD literal (5 user stories, stack AWS Serverless + Node.js + Claude API) agregamos seis extensiones quirúrgicas (EXT-1..EXT-6) que cubren los 3 pilares del brief público: recarga inteligente con anchoring, reporte nutricional semanal, analítica con benchmark nacional para la cafetería, explicabilidad en cada alerta, insight cruzado padre↔cafetería y quick replies. Demo arranca con caso real "Diana y Mateo" del dataset; pitch cierra con uplift de ticket en $ extrapolado a los 90 colegios de Biofood. **Premio: $2.000.000 COP. Hackathon 24h. Equipo: 3 devs senior + 1 product senior.**

---

## 2. Stack no negociable (del PRD §04)

| Capa | Tecnología |
|---|---|
| Runtime | **Node.js 20** |
| Backend | Lambdas (handler estilo Express) |
| API entrante | API Gateway (HTTP API) |
| BD | PostgreSQL (Biofood Global DB existente — solo lectura sobre tablas existentes) |
| Connection pool | **RDS Proxy** — SQL crudo, **sin ORM** |
| Motor IA | Claude API — modelo `claude-sonnet-4-20250514` (del PRD literal) |
| Canal | WhatsApp Business API (Meta Cloud API) |
| Cron / alertas | EventBridge → Lambda |
| Estado conversacional | DynamoDB (`conversations`, TTL 1h) |
| Secrets | SSM Parameter Store |
| Infra | AWS Serverless. **Sin microservicios.** |
| Vistas estáticas (extensiones) | S3 + CloudFront, HTML/JS puro o Next.js exportado estático |

**Prohibido por el PRD:** tocar el frontend Angular existente, entrenar modelos ML, multi-tenant (1 colegio piloto hardcodeado), flujo de registro de usuarios (el número de WhatsApp ES la identidad), históricos >30 días, B2B para proveedores.

---

## 3. Alcance: 5 US del PRD + 6 extensiones

### User Stories del PRD (no negociables — §03)

| ID | Qué | Trigger | Latencia objetivo |
|---|---|---|---|
| **US-01** | "¿Qué comió mi hijo hoy?" conversacional | Webhook entrante WhatsApp | <4s |
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
| **EXT-6** | Quick replies de WhatsApp (interactive messages con botones) | Pulido de producto |

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

### Tablas existentes en Biofood (solo lectura — confirmar nombres reales al conectar)

- `students` (id, name, grade, school_id, balance)
- `transactions` (id, student_id, product_id, amount, created_at)
- `products` (id, name, category, price)

### Tablas nuevas a precargar como fixtures (BLOQUEADOR H0-H2 del PRD)

- `student_allergens` (student_id, allergen_name) — mínimo 3 estudiantes con alergias
- `product_allergens` (product_id, allergen_name) — mínimo 5 productos
- `parent_phone_map` (phone_e164, student_id) — mínimo 10 registros
- `cafeteria_admins` (phone_e164, school_id)
- `inventory` (product_id, school_id, current_stock, minimum_stock)
- `product_nutrition` (product_id, calories_100g, sugar_g, fat_g, protein_g, sodium_mg) — **nuestra extensión para EXT-2/EXT-3, no está en el PRD**

### En DynamoDB

- `conversations` (phone_e164, session_json, updated_at) — TTL 1h

---

## 5. Convenciones de código

- **Node.js 20**, **JavaScript** (no TypeScript). Decisión por velocidad de hackathon. *Pendiente confirmación final del equipo — si se acuerda TS antes de H3, se actualiza esta sección.*
- **ES modules** (`import/export`, `"type": "module"` en cada `package.json`).
- **`async/await`** en todo. Nada de callbacks ni `.then()` encadenado.
- **SQL crudo** con parámetros nombrados, **sin ORM**. Las queries viven en archivos `.sql` separados de la lógica JS y se cargan con `fs.readFileSync` al cold start. Patrón: `lambdas/<lambda>/queries/*.sql` + `lambdas/<lambda>/index.js` los importa.
- Una Lambda = una carpeta = un `index.js` + dependencias locales. `lambdas/shared/` para utilidades compartidas (db, whatsapp, nutrition).
- Variables de entorno cargadas desde SSM Parameter Store en el handler, cacheadas a nivel módulo entre invocaciones.
- Logs estructurados (`console.log(JSON.stringify({...}))`) — CloudWatch Insights friendly.
- **Sin tests unitarios formales** en el hackathon (no hay tiempo). Smoke tests manuales con `node --test` solo para utilidades críticas de `lambdas/shared/`.
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

---

## 7. Estado actual de cada componente

> Actualizar al cierre de cada fase. Estados: `not started` / `in progress` / `done` / `blocked`.

### Infra
- AWS account + IAM roles: **not started**
- RDS Proxy + connection a Biofood Global DB: **not started**
- DynamoDB `conversations`: **not started**
- API Gateway (HTTP API) webhook: **not started**
- EventBridge Crons (12PM, 7AM, dom 6PM, lun 7AM): **not started**
- SSM Parameter Store (secrets): **not started**
- S3 + CloudFront para vistas estáticas: **not started**

### Canal
- WhatsApp Business API sandbox + número activo: **not started** (bloqueador crítico, dev dedicado H0-H3 del PRD)

### Lambdas
- `conversation-handler` (US-01, EXT-1, tools 1-8): **not started**
- `allergen-polling` (US-03): **not started**
- `absence-cron` (US-02): **not started**
- `stock-cron` (US-05): **not started**
- `nutrition-weekly` (EXT-2): **not started**
- `cafeteria-weekly` (EXT-3 + EXT-5): **not started**
- `shared/` (db, whatsapp, nutrition helpers): **not started**

### Data
- Fixtures SQL (parent_phone_map, student_allergens, product_allergens, inventory, cafeteria_admins): **not started**
- Tabla nutricional cruzada (USDA/ICBF → catálogo Biofood): **not started**

### Web (extensiones)
- Vista nutrition-report (EXT-2): **not started**
- Vista cafeteria-insights (EXT-3): **not started**

### Producto
- Caso "Diana y Mateo" elegido y documentado: **not started**
- Cálculo de uplift por 3 escenarios + extrapolación 90 colegios: **not started**
- Pitch outline (15 slides max) + ensayos: **not started**

---

## 8. Métricas de éxito (PRD §07 + nuestras)

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

## 9. Flujo de trabajo en cada sesión

1. Lee este `CLAUDE.md` completo. Si una sección dice "not started" no asumas que ya existe.
2. Lee la sección 7 (Estado actual) y decide en qué fase del cronograma del plan estamos.
3. Antes de codear: revisa los `README.md` de las subcarpetas relevantes — explican qué va dónde.
4. Al terminar una fase: actualiza la sección 7 con lo que cambió. Commit con mensaje convencional (`feat:`, `chore:`, `fix:`, `docs:`).
5. Si tomas una decisión técnica que afecta a otros, déjala documentada en el archivo correspondiente o aquí.

---

## 10. Una frase para defender el proyecto (apéndice del plan)

> *"BioAlert+ activa los 10 años de data transaccional de Biofood vía un agente WhatsApp que cumple los 3 pilares del reto: recargas más altas para padres con justificación nutricional personalizada, reportes nutricionales semanales con comparación con compañeros, e inteligencia accionable para cafeterías con benchmark nacional. Construido en el stack que Pedro Noguera definió en su PRD. Aplicado a los 90 colegios de Biofood, representa entre $1.2B y $2.4B COP adicionales en recargas anuales."*
