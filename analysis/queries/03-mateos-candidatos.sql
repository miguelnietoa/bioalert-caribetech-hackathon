-- 03-mateos-candidatos.sql
-- Perfilamiento de estudiantes dentro de un colegio elegido.
-- Devuelve tres archetipos:
--   (a) Alto consumo / ticket alto
--   (b) Irregular: alta varianza de gasto día a día
--   (c) Balanceado: cerca de la mediana en todo
--
-- "Categoría dulce" se detecta por regex sobre nombre_producto (heurística temporal —
-- mejorar con clasificación de Claude sobre el top N del colegio una vez se elija piloto).
--
-- Uso (CLI):
--   PGPASSWORD='PasswordHackaton2026' psql -h 3.208.123.187 -p 5432 \
--     -U hackathon_dev -d biofooddb \
--     -v nit_colegio="'900000680'" -v dias=90 \
--     -f analysis/queries/03-mateos-candidatos.sql
--
-- Notar las comillas en el valor: `-v nit_colegio="'900000680'"`.

\if :{?nit_colegio}
\else
  \echo Falta parámetro :nit_colegio (ej. -v nit_colegio="'900000680'")
  \quit
\endif

\if :{?dias}
\else
  \set dias 90
\endif

\echo Colegio: :nit_colegio · Ventana: :dias días relativos al MAX(fecha)

WITH ventana AS (
  SELECT (MAX(fecha::date) - (:'dias' || ' days')::interval)::date AS desde,
          MAX(fecha::date)                                          AS hasta
  FROM hackaton_ventas
),
ventas_w AS (
  SELECT
    v.usuario_identificacion,
    v.nombre_estudiante,
    v.identificacion_padre,
    v.nombre_padre,
    v.fecha::date                                AS fecha,
    v.nombre_producto,
    (v.cantidad::numeric * v.precio::numeric)    AS importe,
    -- Heurística "dulce": chocolate, bombón, caramelo, gaseosa, helado, postre, azúcar.
    -- Refinar con clasificación de Claude sobre el top productos del colegio.
    CASE
      WHEN v.nombre_producto ~* '(chocolat|bombom|bombón|caramelo|gomita|gaseosa|cola|jugo|helado|postre|azucar|azúcar|galleta|dulce|brownie|chocoramo|bom\s*bom|chupeta)'
        THEN 1 ELSE 0
    END                                          AS es_dulce
  FROM hackaton_ventas v, ventana w
  WHERE v.fecha::date BETWEEN w.desde AND w.hasta
    AND v.nit_colegio = :nit_colegio
),
por_estudiante AS (
  SELECT
    usuario_identificacion,
    MAX(nombre_estudiante)                                   AS nombre_estudiante,
    MAX(identificacion_padre) FILTER (WHERE identificacion_padre IS NOT NULL
                                        AND identificacion_padre <> '') AS identificacion_padre,
    MAX(nombre_padre)         FILTER (WHERE nombre_padre IS NOT NULL
                                        AND nombre_padre <> '')         AS nombre_padre,
    COUNT(*)                                                 AS ventas,
    COUNT(DISTINCT fecha)                                    AS dias_con_compra,
    SUM(importe)                                             AS gasto_total,
    AVG(importe)                                             AS ticket_promedio,
    STDDEV(importe)                                          AS ticket_stddev,
    SUM(importe) FILTER (WHERE es_dulce=1)                   AS gasto_dulce,
    SUM(importe) FILTER (WHERE es_dulce=1) * 100.0
      / NULLIF(SUM(importe),0)                               AS pct_dulce
  FROM ventas_w
  GROUP BY usuario_identificacion
  HAVING COUNT(*) >= 5
),
percentiles AS (
  SELECT
    PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY gasto_total)     AS p50_gasto,
    PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY ticket_promedio) AS p50_ticket,
    PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY pct_dulce)       AS p90_dulce,
    PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY ticket_stddev)   AS p90_stddev,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ticket_stddev)   AS p25_stddev
  FROM por_estudiante
)
SELECT
  CASE
    WHEN p.pct_dulce >= q.p90_dulce              THEN 'A — Alto azúcar'
    WHEN p.ticket_stddev >= q.p90_stddev         THEN 'B — Irregular'
    WHEN p.ticket_stddev <= q.p25_stddev
         AND p.gasto_total BETWEEN q.p50_gasto * 0.8 AND q.p50_gasto * 1.2
                                                 THEN 'C — Balanceado (control)'
    ELSE 'otro'
  END                                            AS archetipo,
  p.usuario_identificacion,
  p.nombre_estudiante,
  p.identificacion_padre,
  p.nombre_padre,
  p.ventas,
  p.dias_con_compra,
  ROUND(p.gasto_total, 0)                        AS gasto_total,
  ROUND(p.ticket_promedio, 0)                    AS ticket_promedio,
  ROUND(p.ticket_stddev, 0)                      AS ticket_stddev,
  ROUND(p.pct_dulce, 1)                          AS pct_dulce
FROM por_estudiante p, percentiles q
WHERE
  p.pct_dulce >= q.p90_dulce
  OR p.ticket_stddev >= q.p90_stddev
  OR (p.ticket_stddev <= q.p25_stddev
      AND p.gasto_total BETWEEN q.p50_gasto * 0.8 AND q.p50_gasto * 1.2)
ORDER BY archetipo, gasto_total DESC
LIMIT 30;
