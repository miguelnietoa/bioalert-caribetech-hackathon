# lambdas/nutrition-weekly/

EXT-2 — Reporte nutricional semanal proactivo. EventBridge domingos 6 PM.

Mecánica:

1. Para cada padre en `parent_phone_map`, agrega consumo del hijo en últimos 7 días.
2. JOIN con `product_nutrition` (precargada por el bootstrap script de Claude) para calcular calorías, azúcar, grasas, sodio.
3. Compara con promedio de compañeros del mismo grado y colegio (peer benchmark).
4. Detecta banderas rojas (ej. 3+ días sobre límite recomendado de azúcar). Esta detección la hace el Lambda en SQL/JS, no Claude.
5. Genera HTML estático y lo sube a S3 (vista `web/nutrition-report/`).
6. Envía WhatsApp vía `lambdas/shared/whatsapp.ts` (Kapso `send-text` con link) con top 3 productos, totales, comparativa y link a la vista, + CTA suave a EXT-1.

Modelo Claude para este Lambda (si necesita narrativa generativa): `claude-haiku-4-5-20251001` — más barato para batch.

Dependencia: `product_nutrition` debe estar poblada antes de la primera corrida (bootstrap script al inicio del hackathon).
