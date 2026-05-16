-- 02-colegios-candidatos.sql
-- Ranking de colegios candidatos a piloto.
--
-- Filtra colegios "goldilocks":
--   - 30 a 200 estudiantes activos en la ventana
--   - >= 500 ventas en la ventana
-- Ordena por estudiantes activos desc, luego volumen.
--
-- La ventana se calcula relativa a MAX(fecha) de ventas porque el dataset
-- llega hasta 2026-05-29 (futuro respecto a "hoy" 2026-05-16).
--
-- Uso (CLI):
--   PGPASSWORD='PasswordHackaton2026' psql -h 3.208.123.187 -p 5432 \
--     -U hackathon_dev -d biofooddb \
--     -v dias=90 -f analysis/queries/02-colegios-candidatos.sql

\if :{?dias}
\else
  \set dias 90
\endif

\echo Ventana: últimos :dias días contados desde MAX(fecha) de ventas.

WITH ventana AS (
  SELECT (MAX(fecha::date) - (:'dias' || ' days')::interval)::date AS desde,
          MAX(fecha::date)                                          AS hasta
  FROM hackaton_ventas
),
ventas_w AS (
  SELECT
    v.nit_colegio,
    v.colegio,
    v.usuario_identificacion,
    v.identificacion_padre,
    v.nombre_producto,
    (v.cantidad::numeric * v.precio::numeric) AS importe
  FROM hackaton_ventas v, ventana w
  WHERE v.fecha::date BETWEEN w.desde AND w.hasta
),
recargas_w AS (
  SELECT r.nit_colegio, r.valor
  FROM hackaton_recargas r, ventana w
  WHERE r.fecha BETWEEN w.desde AND w.hasta
)
SELECT
  v.nit_colegio,
  MAX(v.colegio)                                            AS colegio,
  COUNT(DISTINCT v.usuario_identificacion)                  AS estudiantes_activos,
  COUNT(DISTINCT v.identificacion_padre)
    FILTER (WHERE v.identificacion_padre IS NOT NULL
                  AND v.identificacion_padre <> '')         AS padres_identificados,
  COUNT(*)                                                  AS ventas,
  COUNT(DISTINCT v.nombre_producto)                         AS productos_distintos,
  ROUND(AVG(v.importe), 0)                                  AS ticket_promedio,
  COALESCE(
    (SELECT COUNT(*)        FROM recargas_w r WHERE r.nit_colegio = v.nit_colegio), 0
  )                                                         AS recargas,
  COALESCE(
    (SELECT ROUND(AVG(r.valor),0) FROM recargas_w r WHERE r.nit_colegio = v.nit_colegio), 0
  )                                                         AS recarga_promedio,
  ROUND(
    COUNT(*)::numeric / NULLIF(
      (SELECT COUNT(*) FROM recargas_w r WHERE r.nit_colegio = v.nit_colegio), 0
    ),
  1)                                                        AS ratio_ventas_recargas
FROM ventas_w v
GROUP BY v.nit_colegio
HAVING COUNT(DISTINCT v.usuario_identificacion) BETWEEN 30 AND 200
   AND COUNT(*) >= 500
ORDER BY estudiantes_activos DESC, ventas DESC
LIMIT 25;
