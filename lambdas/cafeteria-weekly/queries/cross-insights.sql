-- Agrega señales de padres del colegio piloto.
-- Por simplicidad para hackathon: insights derivados directamente de la data
SELECT
  -- "Padres con consumo de azúcar alto" (proxy: estudiantes con pct_dulce > 35% últimos 30 días)
  COUNT(DISTINCT v.identificacion_padre) FILTER (WHERE pn.category IN ('dulce','snack'))
    AS padres_alto_azucar_proxy,
  -- Productos saludables que faltan: top productos de otros colegios que el piloto NO tiene
  (SELECT array_agg(nombre_producto)
   FROM (
     SELECT v2.nombre_producto FROM reto.ventas v2
     LEFT JOIN bioalert.product_nutrition pn2 ON pn2.nombre_producto = v2.nombre_producto
     WHERE v2.nit_colegio != $1
       AND pn2.category IN ('fruta','lacteo')
       AND v2.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
     GROUP BY v2.nombre_producto
     HAVING NOT EXISTS (
       SELECT 1 FROM reto.ventas v3 WHERE v3.nit_colegio = $1 AND v3.nombre_producto = v2.nombre_producto
     )
     ORDER BY COUNT(*) DESC LIMIT 3
   ) t) AS productos_faltantes_saludables
FROM reto.ventas v
LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
WHERE v.nit_colegio = $1
  AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '30 days';
