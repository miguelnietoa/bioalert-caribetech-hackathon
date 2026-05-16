# lambdas/shared/

Utilidades reutilizadas por varias Lambdas. Importar relativo o publicar como Lambda Layer (decisión por hackathon: relativo está bien).

Archivos esperados:

- `db.ts` — pool de conexiones contra RDS Proxy + helper `query<T>(sql, params)`. SQL crudo, sin ORM.
- `whatsapp.ts` — **wrapper del canal de mensajería, abstrae el provider concreto.** Implementación primaria con Kapso TS SDK (`@kapso/sdk` o equivalente — confirmar nombre exacto en H0); fallback con Twilio si Kapso da fricción. Expone: `sendText(to, body)`, `sendButtons(to, body, buttons)`, `sendList(to, body, sections)`, `sendImage(to, url, caption)`, `verifyWebhookSignature(headers, rawBody)`. Las Lambdas nunca importan SDK del provider directo.
- `claude.ts` — wrapper minimal de Claude API con soporte de tool calling. Modelo por defecto: `claude-sonnet-4-6`. Acepta override para usar `claude-haiku-4-5-20251001` en crons.
- `nutrition.ts` — helpers para sumar/comparar nutrición y aplicar reglas de banderas rojas (azúcar/grasa/sodio).
- `dynamo-conversations.ts` — get/put de `conversations` con TTL 1h.
- `ssm.ts` — carga secrets desde SSM cacheando a nivel módulo.
- `logger.ts` — `console.log(JSON.stringify({...}))` con `level`, `lambda`, `request_id`.
- `types.ts` — tipos compartidos: `Student`, `Transaction`, `Product`, `NutritionFacts`, `Conversation`, `WhatsAppMessage`, etc.

La abstracción de `whatsapp.ts` es lo que protege al producto de los riesgos del canal en producción — cuando Biofood adopte el proyecto y migremos a Meta Cloud API directa, solo este archivo cambia.
