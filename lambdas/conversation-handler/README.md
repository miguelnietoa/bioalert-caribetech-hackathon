# lambdas/conversation-handler/

Handler del webhook entrante de WhatsApp (Kapso Sandbox durante el hackathon; Twilio como fallback; Meta Cloud API post-hackathon). Es el corazón conversacional del producto.

Responsabilidades:

1. Validar firma HMAC del webhook de Kapso.
2. Cargar sesión de DynamoDB (`conversations`) con TTL 1h.
3. Resolver `phone_e164` → `student_id` vía `parent_phone_map` (o `cafeteria_admins`).
4. Llamar a Claude API (`claude-sonnet-4-6`) con system prompt + tools 1-8.
5. Ejecutar tool calls contra Postgres (vía RDS Proxy).
6. Aplicar EXT-4 (explicabilidad: cada respuesta lleva "por qué te aviso esto") en el system prompt.
7. Aplicar EXT-6 (quick replies vía Kapso `send-buttons` cuando aplique).
8. Responder vía el wrapper `lambdas/shared/whatsapp.ts` (que internamente usa Kapso TS SDK).
9. Guardar sesión actualizada en DynamoDB.

Estructura interna:

- `index.ts` — handler principal
- `claude-client.ts` — wrapper de Claude API con tool calling
- `prompts/` — system prompt + plantillas
- `tools/` — implementación de las 8 tools del agente
- `queries/` — archivos `.sql` cargados con `fs.readFileSync`

Cubre: US-01, US-04, EXT-1, EXT-4, EXT-6.
