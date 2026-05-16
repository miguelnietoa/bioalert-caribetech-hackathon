# lambdas/

Código de las Lambdas. Una carpeta = una Lambda. Cada una expone un `index.js` con el handler.

- `conversation-handler/` — webhook entrante de WhatsApp, US-01, EXT-1 (recargas), tools 1-8 del agente Claude
- `allergen-polling/` — US-03, corre cada 60s, detecta alérgenos en transacciones nuevas
- `absence-cron/` — US-02, EventBridge 12:00 PM Colombia, detecta padres sin consumo del hijo
- `stock-cron/` — US-05, EventBridge 7:00 AM, alerta a admin de cafetería
- `nutrition-weekly/` — EXT-2, EventBridge domingos 6 PM, reporte nutricional semanal
- `cafeteria-weekly/` — EXT-3 + EXT-5, EventBridge lunes 7 AM, benchmark + insight cruzado
- `shared/` — utilidades compartidas: cliente DB (RDS Proxy), cliente WhatsApp, helpers nutrición

Patrón de queries: cada Lambda tiene una subcarpeta `queries/` con archivos `.sql` cargados con `fs.readFileSync` al cold start. Cero ORM.
