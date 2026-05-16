# lambdas/allergen-polling/

US-03 — Alerta crítica de alérgeno. Latencia objetivo: <30s desde transacción.

Mecánica:

1. Disparado por EventBridge cada 60 segundos (cron rate).
2. Lee tabla `transactions` filtrando `created_at > last_seen_at` (cursor en SSM o DynamoDB).
3. Para cada nueva fila, hace JOIN con `product_allergens` y `student_allergens`.
4. Si hay intersección → envía alerta WhatsApp inmediata al padre con producto, alérgeno, hora.
5. Aplica EXT-4: el mensaje explica por qué se disparó ("registraste alergia a maní y este producto lo contiene").
6. Actualiza cursor.

Regla determinista, sin ML, 100% de detección (métrica del PRD).
