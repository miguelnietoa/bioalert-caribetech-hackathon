-- 01-schema-discovery.sql
-- Reproduce la inspección documentada en docs/db-schema.md.
-- Correr al inicio de cada sesión por si el reto agregó tablas o cambió columnas.
--
-- Uso (CLI):
--   PGPASSWORD='PasswordHackaton2026' psql -h 3.208.123.187 -p 5432 \
--     -U hackathon_dev -d biofooddb -f analysis/queries/01-schema-discovery.sql

\echo === Tablas en schema public ===
SELECT
  table_name,
  pg_size_pretty(pg_relation_size(quote_ident(table_name)::regclass)) AS size
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;

\echo === Columnas de hackaton_ventas ===
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='hackaton_ventas'
ORDER BY ordinal_position;

\echo === Columnas de hackaton_recargas ===
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='hackaton_recargas'
ORDER BY ordinal_position;

\echo === Conteo exacto de filas ===
SELECT 'hackaton_ventas'   AS tabla, COUNT(*) AS filas FROM hackaton_ventas
UNION ALL
SELECT 'hackaton_recargas',           COUNT(*)        FROM hackaton_recargas;

\echo === Cardinalidades ventas ===
SELECT
  COUNT(DISTINCT nit_colegio)            AS colegios,
  COUNT(DISTINCT usuario_identificacion) AS estudiantes,
  COUNT(DISTINCT identificacion_padre)
    FILTER (WHERE identificacion_padre IS NOT NULL AND identificacion_padre <> '')
                                         AS padres,
  COUNT(DISTINCT nombre_producto)        AS productos
FROM hackaton_ventas;

\echo === Rangos de fecha ===
SELECT 'ventas'   AS tabla, MIN(fecha::date) AS min, MAX(fecha::date) AS max FROM hackaton_ventas
UNION ALL
SELECT 'recargas',          MIN(fecha)       AS min, MAX(fecha)       AS max FROM hackaton_recargas;

\echo === Tablas bioalert_* (las nuestras, vacías al inicio) ===
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'bioalert_%'
ORDER BY 1;

\echo === Permisos del usuario actual ===
SELECT
  has_schema_privilege(current_user, 'public', 'CREATE')         AS can_create_in_public,
  has_table_privilege(current_user, 'hackaton_ventas', 'INSERT') AS can_modify_reto_tables;
