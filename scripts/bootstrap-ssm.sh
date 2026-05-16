#!/usr/bin/env bash
# bootstrap-ssm.sh
# Crea los SSM parameters necesarios ANTES del primer `serverless deploy`.
# Idempotente: si el parámetro ya existe, no lo sobrescribe (a menos que pases --force).
#
# Uso:
#   ./scripts/bootstrap-ssm.sh             # crea solo lo faltante
#   ./scripts/bootstrap-ssm.sh --force     # sobreescribe (CUIDADO: rota password de RDS)

set -euo pipefail

STAGE="${STAGE:-hackathon}"
AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"
FORCE="${1:-}"

put_secure() {
  local name="$1"
  local value="$2"
  local description="$3"

  if [[ "$FORCE" == "--force" ]]; then
    aws ssm put-parameter \
      --name "$name" --value "$value" --type SecureString \
      --description "$description" --overwrite \
      --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null
    echo "✏️  overwrote $name"
  elif aws ssm get-parameter --name "$name" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "⏭️  $name already exists (use --force to overwrite)"
  else
    aws ssm put-parameter \
      --name "$name" --value "$value" --type SecureString \
      --description "$description" \
      --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null
    echo "✅ created $name"
  fi
}

echo "Stage: $STAGE · Profile: $AWS_PROFILE · Region: $AWS_REGION"
echo

# DB master password — generado random
DB_PASSWORD=$(openssl rand -hex 24)
put_secure \
  "/bioalert/$STAGE/db/password" \
  "$DB_PASSWORD" \
  "RDS bioalert master password (auto-generated)"

# Placeholders para creds externas — el equipo los pisa con --force cuando tenga los valores reales
put_secure "/bioalert/$STAGE/anthropic/api-key"    "REPLACE_ME" "Anthropic API key"
put_secure "/bioalert/$STAGE/kapso/api-key"        "REPLACE_ME" "Kapso API key"
put_secure "/bioalert/$STAGE/kapso/webhook-secret" "REPLACE_ME" "Kapso webhook HMAC secret"
put_secure "/bioalert/$STAGE/kapso/sandbox-number" "REPLACE_ME" "Kapso WhatsApp sandbox number (E.164)"

echo
echo "Listos los SSM parameters. Para meter los valores reales de Kapso/Anthropic:"
echo "  aws ssm put-parameter --name /bioalert/$STAGE/anthropic/api-key \\"
echo "    --value 'sk-ant-...' --type SecureString --overwrite \\"
echo "    --profile $AWS_PROFILE --region $AWS_REGION"
