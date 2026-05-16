# Team plan — BioAlert+ hackathon

> 24h. 3 devs. 1 producto. Doc para cada uno en `docs/plans/`. Lee tu doc al arrancar, séguilo, y respetá los archivos que NO te toca tocar.

## TL;DR del reparto

| Track | Owner | Misión | Doc personal |
|---|---|---|---|
| **A — Conversacional + Producto** | **Miguel Nieto** | Agente WhatsApp (US-01, US-04, EXT-1, EXT-4, EXT-6) + caso "Diana y Mateo" + uplift en $ + pitch | [`plans/2026-05-16-track-a-conversacional.md`](plans/2026-05-16-track-a-conversacional.md) |
| **B — Alertas** | **Jose Arcila** | Las 5 Lambdas de alertas y reportes (US-02, US-03, US-05, EXT-2, EXT-3 + EXT-5) | [`plans/2026-05-16-track-b-alertas.md`](plans/2026-05-16-track-b-alertas.md) |
| **C — Infra + Data + Web** | **Jose Maza** | AWS, RDS, `lambdas/shared/`, fixtures SQL, bootstrap nutrición con Claude, vistas web estáticas | [`plans/2026-05-16-track-c-infra-data-web.md`](plans/2026-05-16-track-c-infra-data-web.md) |

Decisión clave: Miguel Nieto toma Conversacional + Producto porque (1) tiene todo el contexto cargado desde el setup, (2) la conversación está acoplada al storytelling "Diana y Mateo" del pitch, (3) eso libera a los 2 Jose a especializarse.

---

## Dependency graph (el cuello de botella es Jose Maza)

```
H0─H1:  Jose Maza corre setup (npm install, bootstrap-ssm, serverless deploy)
        Jose Arcila hace opt-in al sandbox + escribe specs de fixtures local
        Miguel corre EDA del dataset (queries 02 y 03) → elige colegio piloto

H1─H2:  Jose Maza aplica schema + corre ETL del reto → RDS poblada con tipos limpios
        Miguel documenta caso "Diana y Mateo"
        Jose Arcila sigue spec local + lee docs de Anthropic SDK

H2─H4:  Jose Maza escribe lambdas/shared/*  ← CRÍTICO: desbloquea a Miguel y Jose Arcila
        Miguel sigue con caso demo
        Jose Arcila sigue spec / patterns

H4─H7:  Jose Maza: bootstrap-nutrition.ts → puebla bioalert.product_nutrition
        Miguel: arranca lambdas/conversation-handler/ (handler base + DynamoDB)
        Jose Arcila: lambdas/allergen-polling/ (US-03, el más simple, valida patrón)

H7─H10: Jose Maza: fixtures SQL (parent_phone_map con teléfonos REALES del equipo,
                allergens manuales, inventory simulado, cafeteria_admins)
        Miguel: tools 1-4
        Jose Arcila: lambdas/absence-cron + lambdas/stock-cron

H10─H14: Jose Maza: web/nutrition-report/ (HTML + Chart.js)
         Miguel: tools 5-8 + EXT-1 lógica
         Jose Arcila: lambdas/nutrition-weekly (EXT-2)

H14─H16: Jose Maza: web/cafeteria-insights/
         Miguel: system prompt + EXT-4 + EXT-6 quick replies
         Jose Arcila: lambdas/cafeteria-weekly + EXT-5 insight cruzado

H16─H18: TODOS: integration test grupal + bug fixes + smoke tests E2E

H18─H20: Jose Maza: deploy de vistas a S3 + integración con Lambdas
         Miguel: cálculo uplift + pitch outline
         Jose Arcila: backup demo grabado + polish

H20─H22: Jose Maza: monitoreo + logs limpios
         Miguel: dry-run #1 del pitch
         Jose Arcila: soporte demo

H22─H24: TODOS: 2-3 ensayos del pitch + setup demo en vivo
```

---

## Sync checkpoints (presenciales o en video)

| Hora | Qué pasa | Quién |
|---|---|---|
| **H+2** | Jose Maza anuncia "RDS up, ETL done, conteos cuadran" | todos saben que pueden conectar |
| **H+4** | Jose Maza anuncia "lambdas/shared/* committed" | Miguel y Jose Arcila desbloqueados |
| **H+8** | Standup rápido (15 min). Cada uno muestra qué corre | todos |
| **H+12** | Integration test grupal (1 hora). Conv + Alertas + Vistas conectadas E2E | todos juntos |
| **H+16** | Feature freeze. Nada nuevo, solo bugs + polish | todos |
| **H+20** | Dry-run pitch #1 (45 min) | Miguel presenta, otros critican |
| **H+22** | Dry-run pitch #2 (45 min) | idem |

---

## Anti-conflict — files con dueño único

| Path | Dueño |
|---|---|
| `serverless.yml` | Jose Maza |
| `package.json` | Jose Maza |
| `tsconfig.json` | Jose Maza |
| `.env.example` | Jose Maza |
| `data/fixtures/*.sql` | Jose Maza |
| `scripts/*` | Jose Maza |
| `lambdas/shared/*` | Jose Maza |
| `lambdas/conversation-handler/**` | Miguel |
| `lambdas/allergen-polling/**` | Jose Arcila |
| `lambdas/absence-cron/**` | Jose Arcila |
| `lambdas/stock-cron/**` | Jose Arcila |
| `lambdas/nutrition-weekly/**` | Jose Arcila |
| `lambdas/cafeteria-weekly/**` | Jose Arcila |
| `web/nutrition-report/**` | Jose Maza |
| `web/cafeteria-insights/**` | Jose Maza |
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
- **NO** `git push --force` (excepto Jose Maza en caso extremo, anunciando en grupo).
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

Stop button: `npm run remove` desinstala todo el stack y los datos se borran (DeletionPolicy: Delete en la RDS). Hacerlo solo POST-pitch y solo Jose Maza.

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
