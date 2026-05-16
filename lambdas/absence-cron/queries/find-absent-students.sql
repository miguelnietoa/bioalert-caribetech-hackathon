-- Estudiantes activos del colegio piloto que NO compraron "hoy" (= max fecha del dataset)
WITH today AS (SELECT MAX(fecha) AS d FROM reto.ventas)
SELECT
  s.usuario_identificacion,
  s.nombre_estudiante,
  ppm.phone_e164,
  ppm.nombre_padre
FROM (
  SELECT DISTINCT v.usuario_identificacion, v.nombre_estudiante, v.identificacion_padre
  FROM reto.ventas v, today
  WHERE v.nit_colegio = $1
    AND v.fecha >= today.d - INTERVAL '30 days'
) s
JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = s.identificacion_padre
WHERE NOT EXISTS (
  SELECT 1 FROM reto.ventas v2, today
  WHERE v2.usuario_identificacion = s.usuario_identificacion
    AND v2.fecha = today.d
);
