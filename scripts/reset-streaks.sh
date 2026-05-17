#!/usr/bin/env bash
# Resetea bioalert.streaks para reproducir el demo de "Detector de rachas".
#
# Por qué existe: el detector tiene una guardia NOT EXISTS sobre filas con
# notified_at IS NOT NULL. Después de un primer run real, las rachas quedan
# "consumidas" y los runs siguientes ven hits=0 hasta que cambie la última
# fecha. Para el demo en vivo (o si querés re-dispararlo manualmente),
# truncá y volvé a invocar.
#
# Uso: ./scripts/reset-streaks.sh
#   - TRUNCA bioalert.streaks.
#   - Invoca la lambda en modo real solo para Diana (+573046002689).
#   - Imprime hits + estado final.

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ONLY_PHONE="${ONLY_PHONE:-+573046002689}"

export PGHOST=$(aws ssm get-parameter --name /bioalert/hackathon/db/host \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'Parameter.Value' --output text)
export PGUSER=bioalert_app
export PGDATABASE=bioalert
export PGPASSWORD=$(aws ssm get-parameter --name /bioalert/hackathon/db/password \
  --with-decryption --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query 'Parameter.Value' --output text)

echo "→ Truncando bioalert.streaks..."
psql -c "TRUNCATE bioalert.streaks RESTART IDENTITY"

echo "→ Invocando streak-detector para $ONLY_PHONE (modo real)..."
aws lambda invoke \
  --function-name bioalert-hackathon-streak-detector \
  --payload "{\"onlyPhone\": \"$ONLY_PHONE\"}" \
  --cli-binary-format raw-in-base64-out \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  /tmp/streak-detector-out.json > /dev/null

sleep 8

echo "→ Logs:"
aws logs tail /aws/lambda/bioalert-hackathon-streak-detector \
  --since 1m --format short --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  | grep -E "streak detector|error|send failed" | tail -5

echo
echo "→ Rachas activas:"
psql -c "SELECT usuario_identificacion, nombre_estudiante, category, days_in_streak FROM bioalert.streaks ORDER BY detected_at DESC"

echo
echo "✓ Listo. Diana debería haber recibido WhatsApp interactivo con botones."
