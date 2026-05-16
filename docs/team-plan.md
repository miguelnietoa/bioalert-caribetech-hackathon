# Team plan — BioAlert+ hackathon

> 24h. 3 devs. 1 producto. Doc para cada uno en `docs/plans/`. Lee tu doc al arrancar, séguilo, y respetá los archivos que NO te toca tocar.

## TL;DR del reparto

| Track | Owner | Misión | Doc personal |
|---|---|---|---|
| **A — Conversacional + Producto** | **Miguel** | Agente WhatsApp (US-01, US-04, EXT-1, EXT-4, EXT-6) + caso "Diana y Mateo" + uplift en $ + pitch | [`plans/conversacional-y-producto.md`](plans/conversacional-y-producto.md) |
| **B — Alertas** | **Dev 2** | Las 5 Lambdas de alertas y reportes (US-02, US-03, US-05, EXT-2, EXT-3 + EXT-5) | [`plans/alertas.md`](plans/alertas.md) |
| **C — Infra + Data + Web** | **Dev 3** | AWS, RDS, `lambdas/shared/`, fixtures SQL, bootstrap nutrición con Claude, vistas web estáticas | [`plans/infra-data-web.md`](plans/infra-data-web.md) |

Decisión clave: Miguel toma Conversacional + Producto porque (1) tiene todo el contexto cargado desde el setup, (2) la conversación está acoplada al storytelling "Diana y Mateo" del pitch, (3) eso libera 2 devs senior a especializarse.

---

## Dependency graph (el cuello de botella es Dev 3)

```
H0─H1:  Dev 3 corre setup (npm install, bootstrap-ssm, serverless deploy)
        Dev 2 hace opt-in al sandbox + escribe specs de fixtures local
        Miguel corre EDA del dataset (queries 02 y 03) → elige colegio piloto

H1─H2:  Dev 3 aplica schema + corre ETL del reto → RDS poblada con tipos limpios
        Miguel documenta caso "Diana y Mateo"
        Dev 2 sigue spec local + lee docs de Anthropic SDK

H2─H4:  Dev 3 escribe lambdas/shared/*  ← CRÍTICO: desbloquea a Miguel y Dev 2
        Miguel sigue con caso demo
        Dev 2 sigue spec / patterns

H4─H7:  Dev 3: bootstrap-nutrition.ts → puebla bioalert.product_nutrition
        Miguel: arranca lambdas/conversation-handler/ (handler base + DynamoDB)
        Dev 2: lambdas/allergen-polling/ (US-03, el más simple, valida patrón)

H7─H10: Dev 3: fixtures SQL (parent_phone_map con teléfonos REALES del equipo,
                allergens manuales, inventory simulado, cafeteria_admins)
        Miguel: tools 1-4
        Dev 2: lambdas/absence-cron + lambdas/stock-cron

H10─H14: Dev 3: web/nutrition-report/ (HTML + Chart.js)
         Miguel: tools 5-8 + EXT-1 lógica
         Dev 2: lambdas/nutrition-weekly (EXT-2)

H14─H16: Dev 3: web/cafeteria-insights/
         Miguel: system prompt + EXT-4 + EXT-6 quick replies
         Dev 2: lambdas/cafeteria-weekly + EXT-5 insight cruzado

H16─H18: TODOS: integration test grupal + bug fixes + smoke tests E2E

H18─H20: Dev 3: deploy de vistas a S3 + integración con Lambdas
         Miguel: cálculo uplift + pitch outline
         Dev 2: backup demo grabado + polish

H20─H22: Dev 3: monitoreo + logs limpios
         Miguel: dry-run #1 del pitch
         Dev 2: soporte demo

H22─H24: TODOS: 2-3 ensayos del pitch + setup demo en vivo
```

---

## Sync checkpoints (presenciales o en video)

| Hora | Qué pasa | Quién |
|---|---|---|
| **H+2** | Dev 3 anuncia "RDS up, ETL done, conteos cuadran" | todos saben que pueden conectar |
| **H+4** | Dev 3 anuncia "lambdas/shared/* committed" | Miguel y Dev 2 desbloqueados |
| **H+8** | Standup rápido (15 min). Cada uno muestra qué corre | todos |
| **H+12** | Integration test grupal (1 hora). Conv + Alertas + Vistas conectadas E2E | todos juntos |
| **H+16** | Feature freeze. Nada nuevo, solo bugs + polish | todos |
| **H+20** | Dry-run pitch #1 (45 min) | Miguel presenta, otros critican |
| **H+22** | Dry-run pitch #2 (45 min) | idem |

---

## Anti-conflict — files con dueño único

| Path | Dueño |
|---|---|
| `serverless.yml` | Dev 3 |
| `package.json` | Dev 3 |
| `tsconfig.json` | Dev 3 |
| `.env.example` | Dev 3 |
| `data/fixtures/*.sql` | Dev 3 |
| `scripts/*` | Dev 3 |
| `lambdas/shared/*` | Dev 3 |
| `lambdas/conversation-handler/**` | Miguel |
| `lambdas/allergen-polling/**` | Dev 2 |
| `lambdas/absence-cron/**` | Dev 2 |
| `lambdas/stock-cron/**` | Dev 2 |
| `lambdas/nutrition-weekly/**` | Dev 2 |
| `lambdas/cafeteria-weekly/**` | Dev 2 |
| `web/nutrition-report/**` | Dev 3 |
| `web/cafeteria-insights/**` | Dev 3 |
| `analysis/queries/*` | leer todos, modificar Miguel |
| `analysis/results/*` | Miguel |
| `docs/plans/<tu-doc>.md` | tú mismo |
| `CLAUDE.md` | cada uno actualiza solo su tabla en §8 |
| `docs/team-plan.md` (este archivo) | Miguel |

**Regla:** si NECESITÁS cambiar un archivo que no es tuyo, escribí en el canal del equipo y coordinamos. No edites unilateralmente.

---

## Git flow

- Trunk-based en `main`. **NO** feature branches durante el hackathon.
- Antes de cada commit: `git pull --rebase origin main`.
- Commits frecuentes (cada 30-60 min). Push apenas un cambio es estable.
- **NO** `git push --force` (excepto Dev 3 en caso extremo, anunciando en grupo).
- Mensajes convencionales: `feat:`, `fix:`, `chore:`, `docs:`, `wip:` (este último para cambios incompletos seguros).
- **NUNCA** `Co-Authored-By:` en mensajes de commit. Preferencia del equipo.

---

## Comunicación

- **1 canal único** para coordinación (Slack/Discord/WhatsApp). Pinneás:
  - "Voy a tocar X" antes de empezar
  - "Pushié Y" cuando estable
  - "Blocked por Z" cuando atorado >15 min
- Decisiones técnicas no triviales → mensaje al grupo. No improvises silencioso.
- 15 min stuck → pedir ayuda. No te quemes.
- Cambios al PRD o al plan → conversarlo con Miguel antes.

---

## Costs y safety

- RDS db.t4g.micro: Free Tier 12 meses, **$0** para hackathon
- DynamoDB on-demand: Free Tier 25 RCU/WCU, **$0**
- Lambda + API Gateway + CloudWatch: Free Tier, **$0**
- Claude API: ~$1-5 (Sonnet 4.6 + Haiku 4.5, tráfico de demo)
- Kapso Sandbox: gratis
- **Total esperado del hackathon: <$10**

Stop button: `npm run remove` desinstala todo el stack y los datos se borran (DeletionPolicy: Delete en la RDS). Hacerlo solo POST-pitch y solo Dev 3.

---

## Lo que NO hace nadie (CLAUDE.md §6)

- Frontend Angular
- ML entrenado
- Multi-tenant
- Pasarela de pagos
- Auth (el número de WhatsApp ES la identidad)
- Onboarding de usuarios (todo es fixture)
- Dashboard SPA complejo
- Tests unitarios formales (smoke tests bastan)
- Cruzar manualmente USDA/ICBF (Claude estima)
