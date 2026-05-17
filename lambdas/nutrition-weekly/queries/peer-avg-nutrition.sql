-- Promedio de consumo del colegio en los últimos 7 días.
-- Usa current_date America/Bogota como "hoy".
-- Macros: peso por unidad (gramos_por_unidad) con fallback 50g.
WITH last7 AS (
  SELECT v.*, pn.calories_100g, pn.sugar_g, pn.fat_g, pn.sodium_mg,
         COALESCE(pn.gramos_por_unidad, 50) AS gramos
  FROM reto.ventas v
  LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
)
SELECT
  ROUND(SUM(calories_100g * cantidad * gramos / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0)) AS avg_calories,
  ROUND(SUM(sugar_g * cantidad * gramos / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))       AS avg_sugar,
  ROUND(SUM(fat_g * cantidad * gramos / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))         AS avg_fat,
  ROUND(SUM(sodium_mg * cantidad * gramos / 100.0) / NULLIF(COUNT(DISTINCT usuario_identificacion), 0))     AS avg_sodium
FROM last7;
