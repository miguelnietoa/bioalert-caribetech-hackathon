-- Compara el colegio piloto vs. el resto de colegios
WITH piloto AS (
  SELECT category, COUNT(*) AS ventas
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
  GROUP BY category
),
resto AS (
  SELECT category, COUNT(*) AS ventas, COUNT(DISTINCT nit_colegio) AS colegios
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio != $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
  GROUP BY category
)
SELECT
  COALESCE(piloto.category, resto.category) AS category,
  piloto.ventas                              AS piloto_ventas,
  ROUND(resto.ventas::numeric / NULLIF(resto.colegios, 0)) AS avg_otros_colegios
FROM piloto FULL OUTER JOIN resto USING (category)
ORDER BY piloto_ventas DESC NULLS LAST;
