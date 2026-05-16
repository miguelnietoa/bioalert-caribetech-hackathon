# BioAlert+ — Caribe Tech Arena 2026 (reto Biofood)

Agente de WhatsApp para padres y administradores de cafeterías escolares de Biofood. Construido sobre el PRD oficial de Pedro Noguera (CEO Biofood) + seis extensiones que cubren los 3 pilares del brief público.

**Premio:** $2.000.000 COP · **Hackathon:** 24 horas · **Equipo:** 3 devs senior + 1 product senior.

## Documentos clave

- [`CLAUDE.md`](./CLAUDE.md) — memoria persistente del proyecto. **Leer primero.**
- [`biofood-hackathon-plan.md`](./biofood-hackathon-plan.md) — plan completo de 24h.
- [`docs/Biofood_PRD_BioAlert_Reto_Hackaton.pdf`](./docs/Biofood_PRD_BioAlert_Reto_Hackaton.pdf) — PRD oficial.
- [`docs/aws-onboarding.md`](./docs/aws-onboarding.md) — setup de AWS CLI compartido (Arcila / Maza arrancan acá).

## Estructura

```
infra/      CloudFormation o CDK
lambdas/    Código de las Lambdas (conversation-handler, alertas, crons)
data/       Fixtures SQL + tabla nutricional cruzada
web/        Vistas estáticas (S3 + CloudFront) para extensiones EXT-2 y EXT-3
analysis/   Notebooks EDA + cálculo de uplift + caso demo "Diana y Mateo"
docs/       PRD, schemas, spec de tools, outline del pitch
```

Cada subcarpeta tiene su propio `README.md` con qué va ahí.
