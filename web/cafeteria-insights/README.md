# web/cafeteria-insights/

Vista del admin de cafetería — EXT-3 + EXT-5. Una sola página con:

- Benchmark del colegio vs. promedio nacional (mix de categorías, ticket promedio, % saludable)
- Top 3 productos que tienen colegios similares y faltan
- **Insight cruzado (EXT-5):** señales agregadas de padres ("23 padres consultaron por azúcar esta semana") con recomendación accionable
- Stock crítico vigente

Stack: idem `nutrition-report/`. Datos pregenerados desde la Lambda `cafeteria-weekly`.
