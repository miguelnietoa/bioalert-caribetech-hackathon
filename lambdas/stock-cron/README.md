# lambdas/stock-cron/

US-05 — Alerta de stock crítico al admin de cafetería. EventBridge 7:00 AM.

Mecánica:

1. Lee `inventory` filtrando `current_stock <= minimum_stock`.
2. Si no hay críticos → no envía nada (PRD).
3. Si hay → arma lista por `school_id`, busca admin en `cafeteria_admins`, envía un solo mensaje consolidado al admin vía `lambdas/shared/whatsapp.ts` (Kapso) con productos + stock actual.
4. Aplica EXT-4 (el mensaje incluye razón explícita).
