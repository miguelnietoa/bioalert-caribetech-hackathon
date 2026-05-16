-- Detecta ventas con producto que contiene un alérgeno registrado para el estudiante,
-- desde el cursor (timestamp). Devuelve teléfono del padre y datos para alertar.
SELECT
  v.id                                  AS venta_id,
  v.fecha                               AS fecha,
  v.nombre_producto,
  v.usuario_identificacion,
  v.nombre_estudiante,
  pa.allergen_name,
  ppm.phone_e164                        AS phone_padre,
  ppm.nombre_padre
FROM reto.ventas v
JOIN bioalert.product_allergens pa ON pa.nombre_producto = v.nombre_producto
JOIN bioalert.student_allergens sa
  ON sa.usuario_identificacion = v.usuario_identificacion
  AND sa.allergen_name = pa.allergen_name
JOIN bioalert.parent_phone_map ppm
  ON ppm.identificacion_padre = v.identificacion_padre
WHERE v.id > $1::bigint
ORDER BY v.id
LIMIT 200;
