# web/

Vistas estáticas mínimas servidas desde S3 + CloudFront. **No es Angular, no es SPA, no tiene login.**

- `nutrition-report/` — vista del padre (EXT-2). Una sola página, mobile-first, gráficas con Chart.js o Recharts.
- `cafeteria-insights/` — vista del admin de cafetería (EXT-3). Una sola página, drill-down de benchmark nacional + recomendaciones EXT-5.

Datos pregenerados a JSON desde la Lambda correspondiente y subidos a S3 junto con el HTML. Cero servidor, cero estado.

El PRD prohíbe tocar el frontend Angular **existente**, no prohíbe entregar vistas estáticas complementarias.
