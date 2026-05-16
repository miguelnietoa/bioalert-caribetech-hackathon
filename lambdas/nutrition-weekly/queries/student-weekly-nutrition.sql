-- top 3 productos + macros últimos 7 días
WITH last7 AS (
  SELECT v.*, pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg, pn.canonical_name, pn.category
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.identificacion_padre = (
    SELECT identificacion_padre FROM bioalert.parent_phone_map WHERE phone_e164 = $1
  )
  AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
)
SELECT
  (SELECT json_agg(t) FROM (
    SELECT nombre_producto, COUNT(*) AS veces
    FROM last7 GROUP BY 1 ORDER BY 2 DESC LIMIT 3
  ) t) AS top_products,
  ROUND(SUM(calories_100g * cantidad / 100.0)) AS total_calories,
  ROUND(SUM(sugar_g * cantidad / 100.0))       AS total_sugar,
  ROUND(SUM(fat_g * cantidad / 100.0))         AS total_fat,
  ROUND(SUM(sodium_mg * cantidad / 100.0))     AS total_sodium,
  COUNT(*) FILTER (WHERE category IN ('dulce','snack')) * 100.0 / NULLIF(COUNT(*),0) AS pct_snack
FROM last7;
