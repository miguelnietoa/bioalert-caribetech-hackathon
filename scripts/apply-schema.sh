#!/usr/bin/env bash
# apply-schema.sh
# Aplica data/fixtures/00-schema.sql contra la RDS bioalert.
# Resuelve host y password desde SSM. Corre cuando RDS está aprovisionada y vacía.

set -euo pipefail

STAGE="${STAGE:-hackathon}"
AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "→ Resolviendo endpoint y credenciales de RDS desde SSM..."
RDS_HOST=$(aws ssm get-parameter \
  --name "/bioalert/$STAGE/db/host" \
  --query Parameter.Value --output text \
  --profile "$AWS_PROFILE" --region "$AWS_REGION")

RDS_PASSWORD=$(aws ssm get-parameter \
  --name "/bioalert/$STAGE/db/password" --with-decryption \
  --query Parameter.Value --output text \
  --profile "$AWS_PROFILE" --region "$AWS_REGION")

echo "→ Conectando a $RDS_HOST..."
PGPASSWORD="$RDS_PASSWORD" PGSSLMODE=require psql \
  -h "$RDS_HOST" -p 5432 -U bioalert_app -d bioalert \
  -v ON_ERROR_STOP=1 \
  -f data/fixtures/00-schema.sql

echo "✅ Schema aplicado."
