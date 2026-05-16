# BioAlert+ — Plan de Ataque Hackathon Caribe Tech Arena 2026

> Documento de contexto y ejecución para el equipo. Diseñado para arrancar en Claude Code con todo el contexto necesario. 24 horas, 3 devs senior + 1 product senior.

---

## TL;DR

Construimos **BioAlert+**: el agente WhatsApp del PRD oficial de Pedro Noguera, ejecutado al pie de la letra en el stack que él definió (AWS Serverless + Node.js + Claude API), **expandido con extensiones quirúrgicas que cubren los 3 pilares del brief público** y agregan diferenciación de producto.

Ganamos porque:
- **Respetamos el PRD** (Pedro lo escribió — si lo ignoramos, perdemos)
- **Cumplimos los 3 pilares del brief público** (criterio de evaluación oficial)
- **Agregamos diferenciación de producto** que ningún otro equipo va a pensar
- **Pitcheamos con storytelling real** (Diana y Mateo del dataset) + **uplift de ticket en $**

---

## 1. Contexto: dos documentos, una verdad combinada

**Brief público** ([reto.biofoodsoftware.co](https://reto.biofoodsoftware.co/)) — Pedro Noguera, CEO Biofood:
- 3 pilares obligatorios para evaluación
- *"Atrévanse a proponer en grande"*
- Premio: $2.000.000 COP

**PRD técnico** (BioAlert, PDF entregado por Pedro):
- Stack y arquitectura específicos (NO negociables)
- 5 user stories (US-01 a US-05)
- Scope recortado para 24h
- Veredicto explícito: *"factible si el equipo no toca Angular, no discute arquitectura más de 2 horas, y levanta el número de WhatsApp Business en las primeras 3 horas"*

**Nuestra lectura:** el PRD es la verdad técnica. El brief es el criterio de evaluación. **Hacemos BioAlert según el PRD + extensiones que cubren los 3 pilares.**

### Los 3 pilares del brief (los jueces los van a evaluar)

1. **Incrementar el ticket de recarga de los padres** (KPI estrella) — WhatsApp + incremento medible argumentado con patrones del hijo.
2. **Mejorar la información nutricional para padres e hijos** — histórico × info nutricional → reporte (calorías, grasas, azúcares).
3. **Herramientas analíticas para la cafetería** — recomendaciones accionables vs. promedio nacional.

### Las 5 user stories del PRD (no negociables)

- **US-01:** Conversacional *"¿qué comió mi hijo hoy?"* — respuesta natural < 4s
- **US-02:** Alerta proactiva 12 PM si no hay consumo (EventBridge Cron)
- **US-03:** Alerta de alérgeno < 30s tras transacción (polling 60s)
- **US-04:** Proyección de agotamiento de saldo (promedio móvil 30 días)
- **US-05:** Alerta stock crítico al admin cafetería (Cron 7 AM)

---

## 2. Stack y arquitectura (del PRD — no se discute)

| Capa | Tecnología |
|---|---|
| Runtime | **Node.js 20** |
| Backend | Lambdas (Express handler) |
| API entrante | API Gateway (HTTP API) |
| BD | PostgreSQL (Biofood Global DB existente) |
| Connection pool | **RDS Proxy** (sin ORM, SQL crudo) |
| Motor IA | **Claude API — `claude-sonnet-4-20250514`** |
| Canal | WhatsApp Cloud API (Meta) |
| Cron / alertas | EventBridge → Lambda |
| Estado conversacional | DynamoDB (TTL 1h) |
| Secrets | SSM Parameter Store |
| Infra | AWS Serverless (sin microservicios) |

### Flujo de datos (del PRD)

```
1. Transacción ocurre en cafetería Biofood
2. API REST registra en PostgreSQL
3. Polling Lambda cada 60s detecta nueva fila
4. Motor evalúa:
   - ¿Alérgeno? → Alerta inmediata al padre (<30s)
   - ¿Stock bajo? → Alerta a cafetería (Cron 7AM)
   - ¿Sin consumo? → Alerta a padre (Cron 12PM)
5. Datos alimentan cálculo de proyección de saldo
6. WhatsApp Cloud API entrega mensajes
```

### Lo que el PRD prohíbe — respetar al pie de la letra

- ❌ **No tocar el frontend Angular existente**
- ❌ **No entrenar modelos ML** (toda inferencia por Claude API o queries SQL puras)
- ❌ **No multi-tenant** — 1 colegio piloto hardcodeado
- ❌ **No registro de usuarios** — el número de WhatsApp ES la identidad
- ❌ **No B2B para proveedores**
- ❌ **Solo últimos 30 días** para el MVP (no años de historia)

---

## 3. BioAlert+ — Extensiones diferenciadoras

Estas son las extensiones que agregamos al PRD para cubrir los 3 pilares del brief y separarnos del equipo promedio que va a entregar BioAlert literal.

### EXT-1 — Recarga Inteligente con 3 opciones (Pilar 1)

**Qué:** Extiende US-04. Cuando el padre pregunta por saldo o cuando el saldo proyectado va a agotarse, el bot **no responde con un solo monto**. Responde con 3 opciones precalculadas con narrativa data-driven:

| Opción | Monto ejemplo | Argumento personalizado |
|---|---|---|
| Esencial | $80.000 | "Cubre 2 semanas según el patrón real de Mateo" |
| Equilibrada | $150.000 | "Cubre el mes + el 38% de azúcar que consume Mateo merece atención" |
| Bienestar | $220.000 | "Cubre el mes + permite priorizar fruta/proteína cuando él los pida" |

**Mecanismos psicológicos:**
- **Anchoring** — el padre nunca tipearía $220.000 en un campo vacío; al ver 3 opciones, la del medio se vuelve "razonable"
- **Justificación data-driven** — "según el patrón real de tu hijo" elimina sensación de venta arbitraria
- **Sin compromiso recurrente** — cero PCI, cero certificaciones, cero fricción regulatoria

**Implementación:** lógica adicional en el Lambda de US-04. Sin infra nueva.

### EXT-2 — Reporte Nutricional Semanal Proactivo (Pilar 2)

**Qué:** Cron de domingo 6PM. Cada padre recibe por WhatsApp:
- Top 3 productos consumidos por su hijo esta semana
- Calorías totales, azúcar añadido, grasas
- Comparativo: *"Mateo vs. promedio de 4to grado de su colegio"*
- Banderas rojas (si aplica): *"3 días consecutivos sobre el límite recomendado de azúcar"*
- Link a vista web estática (S3 + CloudFront) con gráficas detalladas
- CTA suave: *"¿Querés ver opciones de recarga que prioricen lo saludable? Respondé Recarga"*

**Dependencia crítica:** tabla nutricional cruzada con productos. Construir en H0-H4 (paralelo a setup WhatsApp). USDA FoodData Central o ICBF Colombia.

**Implementación:** nueva Lambda + EventBridge Cron domingo 6PM + vista HTML estática deployada a S3.

### EXT-3 — Analítica para Cafetería vía WhatsApp + vista web mínima (Pilar 3)

**Qué:** El admin de cafetería recibe (además de US-05 stock crítico):

**Cron lunes 7 AM — Reporte semanal por WhatsApp:**
- Benchmark vs. promedio nacional: *"Tu colegio vende 30% menos fruta que el promedio de colegios similares"*
- Top 3 productos que tienen colegios similares y faltan en tu menú
- Demanda emergente: *"23 padres este mes mostraron interés en opciones más saludables"* (insight cruzado del Pilar 1 → Pilar 3)
- Link a vista web estática con drill-down

**Vista web estática (S3 + CloudFront):**
- HTML/JS puro o Next.js exportado estático — **NO Angular**
- Datos pregenerados en JSON desde Lambda diario
- Gráficas con Chart.js o Recharts
- Mobile-first (admin puede verlo desde celular)

**Por qué no rompe el PRD:** el PRD prohíbe tocar el frontend Angular **existente**. No prohíbe entregar una vista web complementaria. Es una página estática, sin estado, sin login, sin servidor.

### EXT-4 — Explicabilidad en alertas (UX diferencial)

**Qué:** Cada alerta y respuesta incluye un **"por qué te aviso esto"** en lenguaje natural.

Ejemplos:
- Alérgeno: *"⚠️ Juan compró Snack X a las 10:32 AM. Te aviso porque registraste alergia a maní y este producto lo contiene."*
- Recarga: *"Te recomiendo Equilibrada porque el ticket promedio de Mateo los últimos 30 días fue $145.000 y su consumo va en aumento."*
- Ausencia: *"Aún no se registran compras hoy. Te aviso porque típicamente Juan compra antes de las 11 AM."*

**Por qué importa:** demuestra IA seria, no caja negra. Los jueces técnicos lo respetan. Costo de implementación: trivial (parte del prompt al LLM).

### EXT-5 — Insight Cruzado Padre↔Cafetería (el "wow" del demo)

**Qué:** Cuando varios padres del mismo colegio reportan preocupación nutricional o eligen el plan Bienestar, el sistema agrega esa señal y la entrega a la cafetería.

Ejemplo en el reporte semanal a cafetería:
> *"Esta semana, 23 padres consultaron por contenido de azúcar de productos de tu cafetería. 12 padres eligieron la recarga Bienestar (priorizan fruta). Recomendación: aumentar SKUs de fruta de 2 a 5 — colegios similares ya lo hicieron y crecieron 18% en ticket promedio."*

**Por qué gana:** cierra el loop del ecosistema (padre→cafetería→hijo→padre). Ningún otro equipo va a pensar en esto. Es la diapositiva final del pitch.

**Implementación:** Lambda que agrega señales (preguntas frecuentes, opciones de recarga elegidas, alertas disparadas) y las incluye en el reporte semanal de cafetería.

### EXT-6 — Quick Replies en WhatsApp (pulido de producto)

**Qué:** Usar la feature de **interactive messages** de WhatsApp Cloud API con botones:
- *"Ver hoy"* / *"Esta semana"* / *"Recargar"*
- *"Quiero saber más"* / *"Está bien así"* / *"No alertarme hoy"*

**Por qué importa:** la gran mayoría va a entregar texto libre puro. Los botones hacen que la demo se sienta de producto real, no prototipo.

---

## 4. Tablas de datos

### Existentes en Biofood (confirmar nombres reales al conectar)
- `students` (id, name, grade, school_id, balance)
- `transactions` (id, student_id, product_id, amount, created_at)
- `products` (id, name, category, price)

### Fixtures nuevos a precargar (BLOQUEADOR CRÍTICO H0-H2)
- `student_allergens` (student_id, allergen_name) — mínimo 3 estudiantes con alergias
- `product_allergens` (product_id, allergen_name) — mínimo 5 productos
- `parent_phone_map` (phone_e164, student_id) — mínimo 10 registros
- `cafeteria_admins` (phone_e164, school_id)
- `inventory` (product_id, school_id, current_stock, minimum_stock)
- `product_nutrition` (product_id, calories_100g, sugar_g, fat_g, protein_g, sodium_mg) — **NUESTRA EXTENSIÓN, no está en el PRD**

### En DynamoDB
- `conversations` (phone_e164, session_json, updated_at) — TTL 1h

---

## 5. Tools del agente conversacional (Claude API)

El agente debe tener estas tools expuestas para conversación natural:

1. `get_student_consumption_today(phone)` — qué comió hoy (US-01)
2. `get_student_consumption_week(phone)` — última semana
3. `get_nutrition_summary(phone, days)` — calorías, azúcar, grasas (EXT-2)
4. `get_balance_projection(phone)` — proyección de agotamiento (US-04)
5. `get_recharge_recommendations(phone)` — 3 opciones personalizadas (EXT-1)
6. `compare_to_peers(phone)` — vs. compañeros de grado (EXT-2)
7. `get_school_alerts(phone, school_id)` — solo si es admin (US-05)
8. `get_cafeteria_benchmark(school_id)` — vs. promedio nacional (EXT-3, solo admin)

El system prompt define al agente como **"asistente nutricional familiar de Biofood"**, español, tono cálido pero conciso, llama al padre por su nombre, **explica por qué dice cada cosa** (EXT-4).

---

## 6. Storytelling: "Diana y Mateo"

**Esto es lo que gana el hackathon. No es decoración, es estrategia.**

### Responsable: Product Senior, dedicado todo el evento.

**Tarea durante H0-H8:**
1. Corre queries sobre los 30 días de transacciones del colegio piloto.
2. Identifica 3-5 candidatos a "Mateo" con patrones distintos:
   - Uno con consumo alto de azúcar
   - Uno con patrón irregular
   - Uno balanceado (control)
3. Construye perfil completo del elegido:
   - ID anonimizado del estudiante real
   - Edad/grado/colegio
   - Ticket promedio de recarga de su padre
   - Frecuencia de recarga
   - Top productos consumidos
   - % de azúcar añadido estimado
   - Comparación con compañeros
4. Documenta en `docs/caso-demo.md`.

### La demo arranca así:

> *"Esta es Diana. Su hijo Mateo está en 4to grado del Colegio X. Diana recarga $60.000 cada 10 días — el patrón promedio en Biofood. Lo que Diana no sabe es que el 38% de lo que Mateo compra en la cafetería es azúcar añadida. Hoy le vamos a mostrar a Diana algo que va a cambiar su próxima recarga, y va a cambiar lo que ofrece la cafetería de su colegio."*

A partir de ahí, **demo en vivo con WhatsApp real** y datos reales del dataset.

**Esto destroza a cualquier equipo que demuestre con "Usuario Demo".**

---

## 7. Cálculo de uplift — el número que cierra el pitch

### Responsable: Product Senior, en paralelo al caso demo.

Calcular sobre la data histórica del colegio piloto:

1. **Ticket promedio actual** de recarga (toda la población): query simple sobre tabla recargas.
2. **Distribución de tickets** (histograma): p25, p50, p75, p90.
3. **Cohort de padres que ya recargan alto** — ¿qué tienen en común? (techo realista).
4. **Modelo de 3 escenarios de uplift:**
   - Pesimista: 15% de padres del p50 sube a p65
   - Base: 30% sube a p75
   - Optimista: 40% sube a p80
5. **Proyección anualizada** extrapolada a los 90 colegios de Biofood.

### Frase del pitch:

> *"Aplicado a los 90 colegios de Biofood, esta solución representa entre $1.2B y $2.4B COP adicionales en recargas anuales según nuestro modelo conservador. Aquí está el cálculo, los supuestos, y la data que lo respalda."*

Documentar en `analysis/uplift-pitch.md` — los jueces empresariales se mueren con esto.

---

## 8. Cronograma de 24 horas

> Basado en el PRD oficial, con extensiones quirúrgicas insertadas.

| Hora | Track A — Bot | Track B — Alertas | Track C — Data/Extensiones | Track D — Producto |
|---|---|---|---|---|
| **H0-H3** | **WhatsApp sandbox + número activo (DEV DEDICADO)** | Fixtures DB cargados | Tabla nutricional (USDA/ICBF) cruzada con productos | Caso Diana/Mateo: explorar candidatos |
| **H3-H8** | Lambda ConversationHandler: webhook → Claude API → respuesta | Schema validation, conexión RDS Proxy | Continuar tabla nutricional + EXT-2 lógica | Caso demo elegido + perfil documentado |
| **H8-H13** | Tools 1-4 (consumo hoy, semana, proyección saldo) | Polling alérgenos (US-03) + Cron 12PM ausencia (US-02) | Diseño vista web estática (S3) | Cálculo de uplift iniciado |
| **H13-H18** | Tools 5-8 (recarga, peer compare, benchmark) + EXT-1 (3 opciones) | Cron 7AM stock crítico (US-05) + EXT-3 reporte semanal | Vista web cafetería deployada | Uplift documentado + pitch outline |
| **H18-H22** | Integración + EXT-4 (explicabilidad en prompts) + EXT-6 (quick replies) | EXT-5 (insight cruzado) | Pruebas end-to-end con caso real | Slides + ensayos demo |
| **H22-H24** | Polish | Polish | Backup demo grabado | **3 ensayos completos del pitch** |

### Primer bloqueo (del PRD, subrayado):
> *"Número de WhatsApp Business habilitado con Meta Cloud API en modo sandbox. Sin esto no hay demo. Asignar a 1 dev exclusivamente durante las primeras 3 horas."*

---

## 9. Reparto del equipo (4 devs + Product Senior)

| Rol | H0-H3 | H3-H18 | H18-H24 |
|---|---|---|---|
| **Dev 1 (WhatsApp)** | WhatsApp sandbox dedicado | Lambda conversacional + tools 1-8 | Pruebas integración + quick replies |
| **Dev 2 (Alertas)** | Fixtures DB + schema | Lambdas de alertas (US-02, US-03, US-05) + EXT-5 | Pruebas + backup demo |
| **Dev 3 (Infra/Data)** | Setup AWS + RDS Proxy + DynamoDB | Polling + Cron jobs + EXT-1 lógica recarga | Monitoreo + logs limpios |
| **Dev 4 (Frontend mini + Nutrición)** | **Tabla nutricional cruzada** | Vista web estática (S3) para EXT-2 y EXT-3 | Polish visual + responsive |
| **Product Senior** | Caso Diana/Mateo (exploración) | Caso documentado + cálculo de uplift | **Pitch ensayado 3 veces** |

---

## 10. Riesgos críticos (del PRD + nuestros)

| Riesgo | Severidad | Mitigación |
|---|---|---|
| **Meta WhatsApp API — aprobación sandbox** | CRÍTICO | Dev 1 dedicado H0-H3. Sin esto, no hay demo. |
| **Latencia PostgreSQL en Lambda cold start** | ALTO | RDS Proxy + connection pooling. SQL crudo sin ORM. |
| **Tabla nutricional no se cruza bien** | ALTO | Dev 4 desde H0. Fallback manual para top 50 productos. |
| **Límite tokens Claude API** | MEDIO | Limitar contexto a últimas 20 transacciones (del PRD) |
| **Rate limiting Meta (1000 conv/día)** | BAJO | Suficiente para demo. Documentar límite en slides. |
| **Equipo se distrae con dashboard elegante** | ALTO | Vista web es mínima, estática, mobile-first. Una sola página. No Angular, no React state management. |
| **Demo en vivo falla por red** | MEDIO | Backup grabado en H22-H24. |
| **Equipo enamorado del código, descuida pitch** | ALTO | Product Senior dueño del pitch desde H0. |

---

## 11. Métricas de éxito (del PRD)

| Métrica | Meta |
|---|---|
| Tiempo respuesta conversacional | < 4 segundos |
| Detección de alérgenos | 100% (regla determinista) |
| Entrega de alerta crítica | < 30 segundos |
| Proceso alerta masiva (todos los estudiantes) | < 2 minutos |
| Precisión proyección de saldo | ±2 días |

### Métricas adicionales nuestras
- **3 opciones de recarga personalizadas** funcionando para cualquier estudiante del dataset
- **Reporte nutricional semanal** generado para al menos 5 estudiantes
- **Benchmark de cafetería** disponible para al menos 1 colegio
- **Insight cruzado** funcionando (demo: 5+ padres consultan azúcar → cafetería ve alerta)

---

## 12. Estructura del repo

```
biofood-bioalert/
├── CLAUDE.md                    # Memoria persistente para Claude Code
├── biofood-hackathon-plan.md    # Este archivo
├── README.md
├── infra/                       # CloudFormation o CDK
│   ├── lambdas.yaml
│   ├── api-gateway.yaml
│   ├── eventbridge.yaml
│   └── dynamodb.yaml
├── lambdas/
│   ├── conversation-handler/    # US-01, EXT-1, tools del agente
│   │   ├── index.js
│   │   ├── claude-client.js
│   │   ├── tools/
│   │   └── prompts.js
│   ├── allergen-polling/        # US-03
│   ├── absence-cron/            # US-02
│   ├── stock-cron/              # US-05
│   ├── nutrition-weekly/        # EXT-2
│   ├── cafeteria-weekly/        # EXT-3 + EXT-5
│   └── shared/
│       ├── db.js                # RDS Proxy connection
│       ├── whatsapp.js          # Meta Cloud API client
│       └── nutrition.js
├── data/
│   ├── fixtures/                # Scripts SQL de fixtures
│   ├── nutrition-source/        # USDA o ICBF raw
│   └── nutrition-mapped.csv     # Cruzado con catálogo Biofood
├── web/                         # Vistas estáticas mínimas
│   ├── nutrition-report/        # EXT-2 vista padre
│   └── cafeteria-insights/      # EXT-3 vista admin
├── analysis/
│   ├── 01-eda.ipynb             # Notebook Python para EDA solamente
│   ├── 02-uplift.ipynb
│   └── results/
│       ├── caso-demo.md
│       └── uplift-pitch.md
└── docs/
    ├── db-schema.md
    ├── prd-original.pdf
    ├── tools-spec.md
    └── pitch-outline.md
```

**Nota:** análisis exploratorio puede ser Python/Jupyter (rapidez), pero **el código productivo es 100% Node.js**. No mezclar runtimes en Lambdas.

---

## 13. Lo que NO construimos (para no caer en la trampa)

- ❌ Frontend Angular (PRD lo prohíbe)
- ❌ Modelos ML entrenados (PRD lo prohíbe)
- ❌ Multi-tenant (PRD lo prohíbe — 1 colegio piloto)
- ❌ Pasarela de pagos (regulatorio + no aporta)
- ❌ Sistema de auth (el número WhatsApp es la identidad — PRD)
- ❌ Onboarding de usuarios (fixture precargado — PRD)
- ❌ App móvil nativa (WhatsApp basta)
- ❌ Dashboard complejo (vista estática mínima de UNA página por vista, no SPA)
- ❌ Réplica de ISA (el bot existente de Biofood)
- ❌ Modificaciones a tablas existentes (solo lectura)

---

## 14. Pitch outline (15 slides máximo)

1. **Hook** — "Diana no sabe qué come Mateo. Hoy le vamos a mostrar algo."
2. **Problema** — Ticket promedio bajo + padres ciegos + cafeterías reactivas (data del dataset)
3. **Solución en 1 frase** — Agente IA en WhatsApp que convierte data en alertas, recomendaciones y decisiones
4. **Demo en vivo** — Conversación real con caso Mateo
5. **Pilar 1: Recarga inteligente** — Las 3 opciones, mecanismo psicológico, anchoring
6. **Pilar 2: Reporte nutricional** — Mostrar el WhatsApp + vista web
7. **Pilar 3: Inteligencia para cafetería** — Reporte semanal + benchmark nacional
8. **EXT-5: El insight cruzado** — Cómo el ecosistema se retroalimenta
9. **Arquitectura técnica** — Diagrama del flujo del PRD
10. **Métricas del MVP** — Latencias, 100% detección alérgenos, etc.
11. **El uplift en $** — "$1.2B - $2.4B COP/año en la red Biofood"
12. **Por qué Biofood, por qué ahora** — 10 años de data desperdiciada → activada
13. **Roadmap post-hackathon** — Qué viene si Biofood adopta esto
14. **El equipo** — Senior devs + product, ejecutamos rápido
15. **Cierre** — "Atrévanse a proponer en grande dijeron. Aquí está."

---

## 15. Prompt inicial para Claude Code

Cuando arranques en Claude Code en la carpeta del repo, primer mensaje:

```
Voy a trabajar contigo en el Hackathon Caribe Tech Arena 2026, reto Biofood.

Lee dos documentos:
1. biofood-hackathon-plan.md (raíz del repo) — plan completo y contexto
2. docs/prd-original.pdf — PRD oficial de Pedro Noguera (CEO Biofood)

El PRD es la VERDAD técnica (stack, arquitectura, alcance). El plan
expande el scope para cubrir los 3 pilares del brief público con
extensiones EXT-1 a EXT-6.

Después de leer:

1. Crea un archivo CLAUDE.md en la raíz con resumen ejecutivo del
   proyecto, decisiones técnicas no negociables (stack del PRD),
   convenciones de código (Node.js 20, SQL crudo, sin ORM, sin
   microservicios) y las 5 US + 6 extensiones. Lee este archivo
   al inicio de cada sesión.

2. Crea la estructura de carpetas del repo según sección 12 del plan.

3. Inicializa git, primer commit.

4. Confirma con un mensaje: qué entendiste del scope, qué dudas
   tienes antes de empezar Fase 0 (setup de WhatsApp + fixtures).

NO empieces a codear todavía. Solo setup y confirmación de
entendimiento.
```

A partir de ahí trabajas en fases. Para cada fase, prompts cortos con un solo objetivo. Cuando una fase termina, pídele que actualice `CLAUDE.md` con lo hecho y lo siguiente.

---

## Apéndice: una sola frase para defender el proyecto

> **"BioAlert+ activa los 10 años de data transaccional de Biofood vía un agente WhatsApp que cumple los 3 pilares del reto: recargas más altas para padres con justificación nutricional personalizada, reportes nutricionales semanales con comparación con compañeros, e inteligencia accionable para cafeterías con benchmark nacional. Construido en el stack que Pedro Noguera definió en su PRD. Aplicado a los 90 colegios de Biofood, representa entre $1.2B y $2.4B COP adicionales en recargas anuales."**
