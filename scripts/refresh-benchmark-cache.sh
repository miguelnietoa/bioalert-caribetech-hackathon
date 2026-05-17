#!/usr/bin/env bash
# Refresca bioalert.benchmark_nacional_cache con los valores actuales del benchmark
# nacional (todos los colegios excepto el piloto, últimos 7 días).
#
# Por qué existe: computar este benchmark on-the-fly en la Lambda excede 30s por
# bitmap heap scan sobre 60k rows. Lo cacheamos. Para hackathon basta corrida
# manual; post-hackathon esto debería ser un cron diario/horario.
#
# Uso: ./scripts/refresh-benchmark-cache.sh [NIT_PILOTO]
#   NIT_PILOTO default = 900000680

set -euo pipefail

NIT_PILOTO="${1:-900000680}"
AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"

export PGHOST=$(aws ssm get-parameter --name /bioalert/hackathon/db/host \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'Parameter.Value' --output text)
export PGUSER=bioalert_app
export PGDATABASE=bioalert
export PGPASSWORD=$(aws ssm get-parameter --name /bioalert/hackathon/db/password \
  --with-decryption --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query 'Parameter.Value' --output text)

echo "→ Refrescando benchmark cache (excluyendo NIT $NIT_PILOTO)..."
echo "  Esta query toma ~30s. No cancelar."

psql <<EOF
INSERT INTO bioalert.benchmark_nacional_cache (pct_fruta, ticket_promedio, skus_saludables)
SELECT
  COALESCE(ROUND(COUNT(*) FILTER (WHERE pn.category = 'fruta')::numeric * 100.0 / NULLIF(COUNT(*), 0))::int, 0),
  COALESCE(ROUND(AVG(v.importe))::int, 0),
  COUNT(DISTINCT v.nombre_producto) FILTER (WHERE pn.category IN ('fruta','lacteo','proteina'))::int
FROM reto.ventas v
LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
WHERE v.nit_colegio <> '$NIT_PILOTO'
  AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days';

-- Mantén solo las últimas 10 corridas
DELETE FROM bioalert.benchmark_nacional_cache
WHERE computed_at NOT IN (
  SELECT computed_at FROM bioalert.benchmark_nacional_cache ORDER BY computed_at DESC LIMIT 10
);

SELECT * FROM bioalert.benchmark_nacional_cache ORDER BY computed_at DESC LIMIT 3;
EOF

echo "✓ Cache actualizado"
