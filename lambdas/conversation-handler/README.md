# lambdas/conversation-handler/

Handler del webhook entrante de WhatsApp. Es el corazón conversacional del producto.

Responsabilidades:

1. Validar firma del webhook de Meta
2. Cargar sesión de DynamoDB (`conversations`) con TTL 1h
3. Resolver `phone_e164` → `student_id` vía `parent_phone_map` (o `cafeteria_admins`)
4. Llamar a Claude API (`claude-sonnet-4-20250514`) con system prompt + tools 1-8
5. Ejecutar tool calls contra Postgres (vía RDS Proxy)
6. Aplicar EXT-4 (explicabilidad: cada respuesta lleva "por qué te aviso esto")
7. Aplicar EXT-6 (quick replies cuando aplique)
8. Responder vía WhatsApp Cloud API
9. Guardar sesión actualizada en DynamoDB

Estructura interna:

- `index.js` — handler principal
- `claude-client.js` — wrapper de Claude API con tool calling
- `prompts/` — system prompt + plantillas
- `tools/` — implementación de las 8 tools del agente

Cubre: US-01, US-04, EXT-1, EXT-4, EXT-6.
