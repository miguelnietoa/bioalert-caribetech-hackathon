# lambdas/shared/

Utilidades reutilizadas por varias Lambdas. Importar relativo o publicar como Lambda Layer (decisión por hackathon: relativo está bien).

Archivos esperados:

- `db.js` — pool de conexiones contra RDS Proxy + helper `query(sql, params)`. SQL crudo, sin ORM.
- `whatsapp.js` — cliente Meta Cloud API: `sendText`, `sendInteractive` (botones EXT-6), `sendTemplate`. Firma de webhook.
- `claude.js` — wrapper minimal de Claude API con soporte de tool calling. Modelo `claude-sonnet-4-20250514`.
- `nutrition.js` — helpers para sumar/comparar nutrición y aplicar reglas de banderas rojas (azúcar/grasa/sodio).
- `dynamo-conversations.js` — get/put de `conversations` con TTL 1h.
- `ssm.js` — carga secrets desde SSM cacheando a nivel módulo.
- `logger.js` — `console.log(JSON.stringify({...}))` con `level`, `lambda`, `request_id`.
