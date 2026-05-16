#!/usr/bin/env bash
# etl-reto-to-rds.sh
# ETL: copia hackaton_ventas y hackaton_recargas del reto (3.208.123.187) a nuestra
# RDS de bioalert, con tipos correctos (fecha::date, cantidad::int, precio::numeric).
#
# Estrategia: `psql COPY ... TO STDOUT | psql COPY ... FROM STDIN`. Cero almacenamiento
# intermedio, ~1-2 min para 4.5M filas dependiendo del bandwidth.
#
# Pre-requisitos:
#   - serverless deploy ya corrió (RDS existe)
#   - apply-schema.sh ya corrió (tablas reto.ventas, reto.recargas existen vacías)
#
# Re-correr este script: trunca primero las tablas destino, luego rellena. Idempotente.

set -euo pipefail

STAGE="${STAGE:-hackathon}"
AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Source: reto (público)
SRC_HOST="3.208.123.187"
SRC_PORT="5432"
SRC_DB="biofooddb"
SRC_USER="hackathon_dev"
SRC_PASSWORD="PasswordHackaton2026"

# Destination: nuestra RDS (via SSM)
echo "→ Resolviendo endpoint y credenciales de RDS destino..."
DST_HOST=$(aws ssm get-parameter \
  --name "/bioalert/$STAGE/db/host" \
  --query Parameter.Value --output text \
  --profile "$AWS_PROFILE" --region "$AWS_REGION")

DST_PASSWORD=$(aws ssm get-parameter \
  --name "/bioalert/$STAGE/db/password" --with-decryption \
  --query Parameter.Value --output text \
  --profile "$AWS_PROFILE" --region "$AWS_REGION")

DST_DB="bioalert"
DST_USER="bioalert_app"

echo "→ Verificando conexión RDS destino..."
PGSSLMODE=require PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -U "$DST_USER" -d "$DST_DB" -tAc "SELECT 1" >/dev/null

echo "→ TRUNCATE tablas destino (idempotencia)..."
PGSSLMODE=require PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -U "$DST_USER" -d "$DST_DB" -v ON_ERROR_STOP=1 \
  -c "TRUNCATE reto.ventas RESTART IDENTITY; TRUNCATE reto.recargas RESTART IDENTITY;"

echo "→ ETL hackaton_ventas → reto.ventas (~4.26M filas, esto va a tardar)..."
time PGPASSWORD="$SRC_PASSWORD" psql -h "$SRC_HOST" -U "$SRC_USER" -d "$SRC_DB" -v ON_ERROR_STOP=1 \
  -c "COPY (
        SELECT
          usuario_identificacion,
          nombre_estudiante,
          fecha::date,
          cantidad::int,
          LEAST(GREATEST(NULLIF(precio, '')::numeric, 0), 9999999999.99) AS precio,
          nombre_producto,
          NULLIF(identificacion_padre, '') AS identificacion_padre,
          NULLIF(nombre_padre, '')         AS nombre_padre,
          colegio,
          nit_colegio
        FROM hackaton_ventas
        WHERE precio ~ '^[0-9]+(\.[0-9]+)?$'
          AND NULLIF(precio, '')::numeric < 10000000000
      ) TO STDOUT WITH (FORMAT csv)" \
  | PGSSLMODE=require PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -U "$DST_USER" -d "$DST_DB" -v ON_ERROR_STOP=1 \
      -c "COPY reto.ventas (
            usuario_identificacion,
            nombre_estudiante,
            fecha,
            cantidad,
            precio,
            nombre_producto,
            identificacion_padre,
            nombre_padre,
            colegio,
            nit_colegio
          ) FROM STDIN WITH (FORMAT csv)"

echo "→ ETL hackaton_recargas → reto.recargas (~305k filas)..."
time PGPASSWORD="$SRC_PASSWORD" psql -h "$SRC_HOST" -U "$SRC_USER" -d "$SRC_DB" -v ON_ERROR_STOP=1 \
  -c "COPY (
        SELECT
          usuario_identificacion,
          nombre_estudiante,
          fecha,
          valor,
          NULLIF(identificacion_padre, '') AS identificacion_padre,
          NULLIF(nombre_padre, '')         AS nombre_padre,
          colegio,
          nit_colegio
        FROM hackaton_recargas
      ) TO STDOUT WITH (FORMAT csv)" \
  | PGSSLMODE=require PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -U "$DST_USER" -d "$DST_DB" -v ON_ERROR_STOP=1 \
      -c "COPY reto.recargas (
            usuario_identificacion,
            nombre_estudiante,
            fecha,
            valor,
            identificacion_padre,
            nombre_padre,
            colegio,
            nit_colegio
          ) FROM STDIN WITH (FORMAT csv)"

echo "→ Verificación de conteos..."
PGSSLMODE=require PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -U "$DST_USER" -d "$DST_DB" -v ON_ERROR_STOP=1 \
  -c "SELECT 'reto.ventas' AS tabla, COUNT(*) AS filas FROM reto.ventas
      UNION ALL
      SELECT 'reto.recargas', COUNT(*) FROM reto.recargas;"

echo "✅ ETL completo."
