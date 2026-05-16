# lambdas/absence-cron/

US-02 — Alerta proactiva de ausencia de consumo. Disparado por EventBridge a las 12:00 PM Colombia en días hábiles.

Mecánica:

1. Lista todos los `student_id` activos del colegio piloto.
2. Filtra los que NO tienen transacciones con `created_at >= inicio_dia_local`.
3. Cruza con `parent_phone_map` para obtener teléfono.
4. Envía mensaje WhatsApp al padre. Aplica EXT-4 ("aún no se registran compras hoy; típicamente Juan compra antes de las 11 AM").

Objetivo de tiempo: <2 minutos para todos los estudiantes (métrica PRD).
