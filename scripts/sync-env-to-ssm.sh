#!/usr/bin/env bash
# Sube secrets del .env local a SSM (Task 2 paso 2).
# Las Lambdas leen SSM, NO .env.
#
# Uso: ./scripts/sync-env-to-ssm.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
STAGE="${STAGE:-hackathon}"
AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ No existe $ENV_FILE — copiá .env.example a .env y completalo."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

put() {
  local name="$1"
  local value="$2"
  if [[ -z "${value// }" ]]; then
    echo "⏭️  $name vacío en .env — omitido"
    return
  fi
  if [[ "$value" == "REPLACE_ME" || "$value" == "sk-ant-..." ]]; then
    echo "⏭️  $name parece placeholder — omitido"
    return
  fi
  aws ssm put-parameter \
    --name "/bioalert/$STAGE/$name" \
    --value "$value" \
    --type SecureString \
    --overwrite \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" >/dev/null
  echo "✅ /bioalert/$STAGE/$name"
}

echo "Sync .env → SSM (stage=$STAGE, profile=$AWS_PROFILE)"
echo

put "anthropic/api-key" "${ANTHROPIC_API_KEY:-}"
put "kapso/api-key" "${KAPSO_API_KEY:-}"
put "kapso/webhook-secret" "${KAPSO_WEBHOOK_SECRET:-}"
put "kapso/sandbox-number" "${KAPSO_SANDBOX_NUMBER:-}"

echo
echo "Listo. Verificá (sin mostrar valores):"
aws ssm get-parameters-by-path --path "/bioalert/$STAGE/" --recursive \
  --query 'Parameters[].Name' --output table \
  --profile "$AWS_PROFILE" --region "$AWS_REGION"
