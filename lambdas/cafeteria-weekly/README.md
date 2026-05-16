# lambdas/cafeteria-weekly/

EXT-3 + EXT-5 — Reporte semanal al admin de cafetería. EventBridge lunes 7 AM.

Mecánica:

1. Calcula benchmark del colegio piloto vs. promedio nacional (productos vendidos por categoría, ticket promedio, mix saludable).
2. Identifica top 3 productos que tienen colegios similares y faltan en el menú del piloto.
3. **EXT-5 (insight cruzado):** agrega señales de padres (preguntas frecuentes por azúcar, % que eligió plan Bienestar, alertas disparadas) y las entrega como recomendación accionable a la cafetería.
4. Genera HTML estático y lo sube a S3 (vista `web/cafeteria-insights/`).
5. Envía WhatsApp al admin vía `lambdas/shared/whatsapp.ts` (Kapso) con resumen + link.

Modelo Claude para este Lambda (narrativa de recomendaciones): `claude-haiku-4-5-20251001`.

Esta es la Lambda que produce el "wow" del demo (EXT-5 cierra el loop padre→cafetería).
