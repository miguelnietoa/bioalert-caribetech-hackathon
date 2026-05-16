# web/nutrition-report/

Vista del padre — EXT-2. Renderiza el reporte nutricional semanal del hijo con:

- Top 3 productos consumidos
- Totales: calorías, azúcar añadido, grasa, sodio
- Comparativa peer (mismo grado del colegio)
- Banderas rojas en colores semáforo
- CTA hacia recarga inteligente (EXT-1)

Stack: HTML/JS puro o Next.js con `output: 'export'`. Datos en `data.json` subido junto al HTML por la Lambda `nutrition-weekly`. Mobile-first.
