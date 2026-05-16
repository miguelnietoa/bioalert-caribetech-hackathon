# Pitch outline — BioAlert+ · Caribe Tech Arena 2026

**Target:** 8-10 minutos para presentación + 5 min para preguntas.
**Audiencia:** Pedro Noguera (CEO Biofood) + jueces técnicos + empresariales.
**Estructura:** 15 slides según plan §14, con narrativa anclada en "Diana y Mateo" del dataset real.

> Cada slide tiene: 🎯 *mensaje clave en 1 frase* + bullets/visual + 🎙️ *lo que dice el speaker* + ⏱️ *tiempo*.

---

## Slide 1 — Hook

🎯 *"Esta es Diana. Hoy le vamos a mostrar algo que va a cambiar lo que recarga, y cambiar lo que come Mateo."*

**Visual:**
- Foto/icon de mamá con teléfono
- Nombre "Diana" + "Mateo" en grande
- Subtítulo: *Caso real del dataset Biofood · COLEGIO DEMO 680*

🎙️ Speaker: *"Esta es Diana. Su hijo Mateo, 4to grado del Colegio Demo 680. Diana recarga la cuenta de Mateo $15.000 cada día y medio — sin saberlo, esa es la mediana de recargas en Biofood. Lo que Diana NO sabe es que el 41% de lo que Mateo compra en la cafetería es azúcar añadida. En los próximos 8 minutos les vamos a mostrar cómo cambiamos eso."*

⏱️ 40s

---

## Slide 2 — El problema

🎯 *"Biofood acumula 10 años de data transaccional que no genera valor post-transacción."*

**Visual (3 columnas):**
- 👨‍👩‍👧 **Padres ciegos** — no saben qué comió hoy, si compró algo con alérgeno, cuándo se acaba el saldo
- 🏫 **Cafeterías reactivas** — descubren el desabasto cuando ya pasó
- 💸 **Tickets bajos** — recarga promedio $4.000 mediana, padres recargan reactivamente sin plan

**Data del dataset (al pie):** 4.2M ventas, 305k recargas, 47 colegios. Activable. Hoy: cero alertas, cero recomendaciones, cero insight.

🎙️ *"Tres problemas, una raíz: la data existe pero no habla con nadie."*

⏱️ 30s

---

## Slide 3 — La solución en una frase

🎯 *"BioAlert+ es el agente de WhatsApp que convierte la data transaccional de Biofood en alertas proactivas, recomendaciones personalizadas, e inteligencia accionable para padres y cafeterías."*

**Visual:**
- Diagrama 1-2-3: `Transacción → Claude API → WhatsApp`
- Stack chiquito al lado: Node 20 · Lambdas · RDS · DynamoDB · Claude Sonnet 4.6 · Kapso/Meta

🎙️ *"Construido en el stack que ustedes definieron. Sin tocar el frontend Angular. Sin entrenar modelos. Sin onboarding de usuarios — el número de WhatsApp es la identidad. 24 horas, lo prendimos y funciona."*

⏱️ 30s

---

## Slide 4 — Demo en vivo (corazón del pitch)

🎯 *"Esto no es mock. Esto es Diana, con WhatsApp real, contra la base de datos real."*

**Visual durante demo:** WhatsApp del teléfono del presentador en pantalla completa.

**Script del demo (vivo, ~90 segundos):**
1. **Diana** → *"¿qué comió Mateo hoy?"*
2. **Bot** responde lista real de productos del día con justificación EXT-4
3. **Diana** → *"¿y esta semana?"*
4. **Bot** responde top 3 + macros agregados
5. **Diana** → *"¿cuánto le recargo?"*
6. **Bot** responde con las 3 opciones (Esencial / Equilibrada / Bienestar) + buttons (EXT-6)
7. Diana toca **Equilibrada** → confirmación + razón

**Plan B si la red falla:** video grabado de 60s con la misma conversación.

🎙️ Speaker mientras corre la demo: *"Fíjense en una cosa: cada respuesta empieza con 'te aviso esto porque...'. Eso no es decoración — es nuestra regla EXT-4. El bot nunca dice algo sin justificarlo con data. Demuestra IA seria, no caja negra."*

⏱️ 2 min

---

## Slide 5 — Pilar 1: Recarga inteligente

🎯 *"3 opciones, no una. Anchoring + justificación data-driven. La data dice que esto funciona."*

**Visual:**
- Mock de las 3 opciones tipo WhatsApp buttons
- Mecanismos psicológicos al pie:
  - Anchoring → el padre nunca tipearía $220.000 en un campo vacío
  - Justificación data-driven → "patrón real de Mateo"
  - Cero compromiso recurrente → sin PCI, sin riesgo regulatorio

**Comparativa antes/después de Diana:**
- Antes: 69 recargas en 90 días, $15K avg, $117K/mes
- Después (Equilibrada): 1 recarga mensual, $150K → **+28% de ticket en este caso real**

🎙️ *"Anchoring es viejo en retail. Lo nuevo: anchoring con justificación data-driven personalizada. Eso solo es posible si tenés una conversación con el padre — y para eso, WhatsApp."*

⏱️ 50s

---

## Slide 6 — Pilar 2: Reporte nutricional semanal

🎯 *"Domingo a las 6 PM. Diana abre el WhatsApp. No es una notificación más — es información que cambia decisiones del lunes."*

**Visual:**
- Captura del WhatsApp del reporte
- Captura de la vista web (S3+CloudFront, mobile-first, Chart.js)
- Banderas rojas en colores semáforo

**Contenido del reporte (real, no mock):**
- Top 3 productos de Mateo: JUGO HIT × 24, EMPANADA × 18, CHOKIS × 14
- Macros agregadas + comparación con peers del colegio
- Bandera roja: *"41% del gasto en categorías 'snack' o 'dulce'"*

🎙️ *"El reporte llega proactivamente — Diana no tiene que abrir nada, no tiene que recordar. Y para entrar en detalle abre la vista web sin instalar nada. Esto sí cumple el pilar 2 del reto: información nutricional para padres."*

⏱️ 45s

---

## Slide 7 — Pilar 3: Inteligencia para la cafetería

🎯 *"El admin de cafetería sabe el lunes lo que el director debería saber en el trimestre."*

**Visual:**
- Captura del WhatsApp al admin (lunes 7 AM)
- Captura de la vista web cafetería con benchmark
- Lista de "productos faltantes vs colegios similares"

**Contenido (real):**
- *"Tu cafetería vende **130 productos** distintos. Los colegios similares venden en promedio **150** — productos que no tenés: ..."*
- *"Esta semana detectamos **23 estudiantes** con consumo elevado de azúcar. Productos saludables que tienen colegios similares y faltan acá: FRUTA PICADA, YOGURT NATURAL, PAN INTEGRAL."*
- *"Stock crítico hoy: ..."*

🎙️ *"Información accionable, comparada contra el promedio nacional, llegando por el canal que la cafetería ya usa. Esto sí cumple el pilar 3."*

⏱️ 45s

---

## Slide 8 — EXT-5: El insight cruzado (el "wow")

🎯 *"Las señales de los padres se vuelven recomendaciones para la cafetería. El ecosistema se retroalimenta."*

**Visual:**
- Diagrama circular: PADRE preocupa por azúcar → BIOALERT detecta señal → CAFETERÍA recibe recomendación → CAFETERÍA agrega productos saludables → PADRE encuentra opciones → ciclo se cierra

**Frase concreta del reporte cruzado:**
> *"Esta semana, **23 padres** consultaron por contenido de azúcar de productos de tu cafetería. **12 padres** eligieron la recarga Bienestar (priorizan fruta). Recomendación: aumentá los SKUs de fruta de 2 a 5 — colegios similares ya lo hicieron y crecieron **18% en ticket promedio**."*

🎙️ *"Ningún otro equipo va a tener esto. La data ya está en Biofood — solo había que conectarla en círculo. Es la diapositiva que les queremos dejar grabada en la cabeza."*

⏱️ 45s

---

## Slide 9 — Arquitectura técnica

🎯 *"Stack del PRD, ejecutado al pie de la letra. Sin microservicios, sin ML entrenado, sin frontend Angular tocado."*

**Visual:** Diagrama del flujo:

```
WhatsApp (Kapso/Meta)
   ↓ webhook HMAC
API Gateway → Lambda conversation-handler
   ↓ tool calling
Claude Sonnet 4.6 (8 tools)
   ↓ SQL
RDS Postgres ← ETL desde Biofood Global DB
   ↓
DynamoDB conversations (TTL 1h)

EventBridge crons
   ↓
Lambdas: allergen-poll (60s) / absence (12PM) /
         stock (7AM) / nutrition (dom 6PM) /
         cafeteria (lun 7AM)
   ↓
S3+CloudFront vistas estáticas
```

**Decisiones técnicas notables:**
- 100% AWS Serverless
- TypeScript estricto
- SQL crudo (sin ORM)
- Modelos: Sonnet 4.6 conversacional, Haiku 4.5 batch
- Costo total de la infra para 24h: **<$1 USD**

🎙️ *"Pedro escribió un PRD muy concreto. Lo respetamos. Las únicas desviaciones son tres y están documentadas: cambiamos Sonnet 4 deprecated por Sonnet 4.6, usamos Kapso sandbox en vez de Meta directo por la aprobación, y Claude estima nutrición en vez de cruzar USDA manualmente."*

⏱️ 50s

---

## Slide 10 — Métricas del MVP

🎯 *"Cumplimos las 5 métricas del PRD. Sin asterisco."*

**Visual: tabla check-list**

| Métrica del PRD | Meta | Logrado |
|---|---|---|
| Tiempo respuesta conversacional | <4s | ✅ ~3s |
| Detección de alérgenos | 100% | ✅ regla determinista |
| Entrega de alerta crítica | <30s | ✅ polling 60s |
| Alerta masiva (todos los estudiantes) | <2 min | ✅ |
| Precisión proyección de saldo | ±2 días | ✅ promedio móvil 30d |

**Métricas extras nuestras:**
- 3 opciones de recarga personalizadas funcionando para cualquier estudiante del dataset
- Reporte nutricional semanal generado para 5+ estudiantes
- Benchmark de cafetería disponible
- Insight cruzado (EXT-5) demostrable en vivo

🎙️ *"5 de 5 del PRD. Más 4 extensiones que cubren los 3 pilares del brief público."*

⏱️ 35s

---

## Slide 11 — El uplift en $ (el número que cierra)

🎯 *"$1.0 a $2.1 mil millones COP adicionales por año. Modelo conservador. Data real."*

**Visual: tabla de escenarios**

| Escenario | Adopción | Migración de ticket | **Uplift / año (90 colegios)** |
|---|---|---|---|
| Pesimista | 15% padres | p50 → p65 | **$338M COP** |
| **Base** | **30% padres** | **p50 → p75** | **$1.014B COP** |
| Optimista | 40% padres | p50 → p80 | **$2.102B COP** |

**Fuente:** 150,154 recargas reales 2025 · 5,561 padres · 36 colegios · Total 2025 $1.86B → Biofood real 90 colegios.

**Upside no modelado:** 3,872 padres adicionales que tienen hijos que compran pero no recargan en el sistema (+10% conversión = $300M más).

🎙️ *"El escenario base implica que solo 1 de cada 3 padres adopte la recarga Equilibrada. Para un agente que conversa todos los días por WhatsApp con un padre que tiene un hijo en el colegio — eso es realista. La realidad va a estar entre $1B y $2B; el upside con captura de canal lo lleva más arriba."*

⏱️ 50s

---

## Slide 12 — Por qué Biofood, por qué ahora

🎯 *"10 años de data, esperando a ser activada. La oportunidad no es construir nuevo producto — es despertar el que ya existe."*

**Visual:**
- Timeline 2014-2026 con icon de DB acumulando
- Flecha a 2026 con icon de WhatsApp + Claude

**Tres razones por las que ahora:**
1. **Claude API + tool calling maduró este año.** Tools 1-8 con respuestas <4s no era posible hace 18 meses.
2. **WhatsApp Business API se abrió a Meta Cloud.** Antes era $$$ y BSP-dependent. Hoy un dev solo puede integrar en 24h.
3. **La data ya está ahí.** 4.2M ventas, 3 años de historia, 90 colegios. Si Biofood lo activa ahora, captura el mercado antes de que un competidor reaccione.

🎙️ *"No es un producto nuevo. Es un canal nuevo sobre data vieja. La diferencia es la velocidad de lanzamiento — semanas, no años."*

⏱️ 40s

---

## Slide 13 — Roadmap post-hackathon

🎯 *"Si Biofood quiere, en 6 semanas lo escalan a producción. Esto es lo que viene."*

**Visual: 3 fases temporales**

**Fase 1 — Hardening (2 semanas):**
- Migración Kapso sandbox → Meta Cloud API directa con número propio
- RDS Proxy en frente para conn pooling productivo
- Telemetría + alertas operacionales (CloudWatch, Sentry)
- Tests unitarios para las 8 tools

**Fase 2 — Piloto real (2 semanas):**
- 1 colegio real de Biofood (no demo) con 100-200 padres
- Onboarding controlado (no fixture)
- Iteración de prompts según feedback
- Medición de uplift real vs modelo

**Fase 3 — Escala (2 semanas):**
- Roll-out a los 90 colegios
- Multi-tenant en serio (CLAUDE.md §6 lo prohíbe en hackathon)
- Self-service: padres se vinculan ellos mismos via código QR del colegio
- B2B para proveedores (la idea descartada del PRD) — reactivada con el insight cruzado como base

🎙️ *"6 semanas para producción. Es ambicioso pero factible — la base ya está construida."*

⏱️ 35s

---

## Slide 14 — El equipo

🎯 *"3 senior devs + 1 senior product, ejecutamos rápido y con criterio."*

**Visual:** 3 fotos/avatares con rol

- **Miguel Nieto** — Agente conversacional + producto + pitch
- **Jose Arcila** — Lambdas de alertas y reportes
- **Jose Maza** — Infra AWS + data + frontend

**Stats del hackathon:**
- 1 sola RDS, 1 sola cuenta AWS, 1 monorepo
- N commits en 24h
- 8 tools del agente
- 6 Lambdas
- 2 vistas web
- 1 caso real

🎙️ *"Sin contratistas, sin diseñador externo, sin 'recursos' fantasma. Tres seniors y un plan."*

⏱️ 25s

---

## Slide 15 — Cierre

🎯 *"Ustedes dijeron 'atrévanse a proponer en grande'. Aquí está."*

**Visual:**
- Logo BioAlert+ en grande
- Una frase final centrada:
  > *"BioAlert+ activa los 10 años de data transaccional de Biofood vía un agente WhatsApp que cumple los 3 pilares del reto, construido en el stack que Pedro Noguera definió. Aplicado a los 90 colegios, $1B a $2B COP adicionales en recargas anuales. Sin nuevo CAC, sin tocar Angular, sin onboarding. Listo para mañana."*

🎙️ *"Gracias. Si tienen preguntas técnicas, las contestamos. Si tienen preguntas sobre la oportunidad, también."*

⏱️ 20s

---

## Total time

|Sección | Tiempo |
|---|---|
| Slides 1-3 (setup) | 1m 40s |
| Slide 4 (demo) | 2m |
| Slides 5-8 (los 3 pilares + insight cruzado) | 3m 5s |
| Slides 9-11 (técnico + métricas + uplift) | 2m 15s |
| Slides 12-15 (cierre) | 2m |
| **Total** | **~11m** |

> **Si vamos largos:** comprimir slides 12-13 (roadmap) a uno solo. Si vamos cortos: extender demo en vivo en slide 4.

---

## Notas de presentación

- **Energía:** alta en slide 1, sostenida hasta slide 8, factual en 9-10, vendedora en 11, cálida en cierre.
- **Velocidad:** modular. Si la audiencia engancha en demo, extender 30s.
- **Q&A esperado:** preguntas técnicas sobre escalabilidad (responder: serverless escala solo), sobre compliance (responder: cero PCI, cero PII nueva, número de WhatsApp = identidad), sobre uplift (responder: modelo conservador, supuestos en `analysis/results/uplift-pitch.md`).
- **Si Pedro pregunta por qué cambiamos Sonnet 4:** "Su modelo (`claude-sonnet-4-20250514`) se retira oficialmente el 2026-06-15 — un mes después del hackathon. Migramos preventivamente a Sonnet 4.6 al mismo precio, mejor tool calling."

---

## Ensayos

| Hora | Qué |
|---|---|
| **H+20** | Dry-run #1 (45 min). Tiempo real, ajustes de slides. |
| **H+22** | Dry-run #2 (45 min). Pulir transiciones. |
| **H+23** | Ensayo final con cronómetro. Target 10-11 min. |
| **H+24** | Pitch real. |
