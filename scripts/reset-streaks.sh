#!/usr/bin/env bash
# Resetea bioalert.streaks + bioalert.restrictions para que el siguiente
# click en "Disparar" desde el feature catalog vuelva a mandar el mensaje
# de racha (Mateo · dulce). NO invoca la lambda — solo limpia. El mensaje
# se dispara después con el click del catalog.
#
# Uso: ./scripts/reset-streaks.sh
#   (sin argumentos, sin efectos secundarios fuera de la DB)

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"

export PGHOST=$(aws ssm get-parameter --name /bioalert/hackathon/db/host \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'Parameter.Value' --output text)
export PGUSER=bioalert_app
export PGDATABASE=bioalert
export PGPASSWORD=$(aws ssm get-parameter --name /bioalert/hackathon/db/password \
  --with-decryption --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query 'Parameter.Value' --output text)

echo "→ Truncando bioalert.streaks y bioalert.restrictions..."
psql -c "TRUNCATE bioalert.streaks RESTART IDENTITY; TRUNCATE bioalert.restrictions RESTART IDENTITY;"

echo
echo "→ Estado final:"
psql -c "SELECT 'streaks' AS t, COUNT(*) FROM bioalert.streaks UNION ALL SELECT 'restrictions', COUNT(*) FROM bioalert.restrictions"

echo
echo "✓ DB limpia. Ahora hacé clic en 'Disparar' del feature 'Detector de rachas' en el catalog."
echo "  Diana recibirá UN mensaje (Mateo · dulce). No re-corras este script entre clicks o vas a interrumpir."
