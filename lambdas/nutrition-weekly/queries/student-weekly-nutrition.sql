-- top productos + macros últimos 7 días, SOLO para el hijo principal del padre.
-- Multi-hijo aware: si el padre tiene varios hijos, se queda con el que tenga más
-- compras totales (determinístico). Usa current_date America/Bogota como "hoy".
-- Macros: peso por unidad (gramos_por_unidad) con fallback 50g si Claude no estimó.
WITH yo AS (
  SELECT v.usuario_identificacion
  FROM reto.ventas v
  JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = v.identificacion_padre
  WHERE ppm.phone_e164 = $1
  GROUP BY 1
  ORDER BY COUNT(*) DESC, MAX(v.fecha) DESC, v.usuario_identificacion ASC
  LIMIT 1
),
last7 AS (
  SELECT v.*, pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg,
         pn.canonical_name, pn.category,
         COALESCE(pn.gramos_por_unidad, 50) AS gramos
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.usuario_identificacion = (SELECT usuario_identificacion FROM yo)
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
)
SELECT
  (SELECT json_agg(t) FROM (
    SELECT nombre_producto, COUNT(*) AS veces
    FROM last7 GROUP BY 1 ORDER BY 2 DESC LIMIT 3
  ) t) AS top_products,
  ROUND(SUM(calories_100g * cantidad * gramos / 100.0)) AS total_calories,
  ROUND(SUM(sugar_g * cantidad * gramos / 100.0))       AS total_sugar,
  ROUND(SUM(fat_g * cantidad * gramos / 100.0))         AS total_fat,
  ROUND(SUM(sodium_mg * cantidad * gramos / 100.0))     AS total_sodium,
  COUNT(*) FILTER (WHERE category IN ('dulce','snack')) * 100.0 / NULLIF(COUNT(*),0) AS pct_snack
FROM last7;
