#!/usr/bin/env bash
# Build + sync vistas web al bucket S3 (Task 13).
set -euo pipefail

STAGE="${STAGE:-hackathon}"
AWS_PROFILE="${AWS_PROFILE:-biofood-hackathon}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${ACCOUNT_ID:-642722971137}"
BUCKET="bioalert-web-${STAGE}-${ACCOUNT_ID}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Bucket: s3://$BUCKET"

aws s3 sync "$ROOT/web/nutrition-report/" "s3://$BUCKET/nutrition-report/" \
  --delete \
  --profile "$AWS_PROFILE" --region "$AWS_REGION"

echo "→ Build cafeteria-insights (Vite)..."
(cd "$ROOT/web/cafeteria-insights" && npm ci && npm run build)

aws s3 sync "$ROOT/web/cafeteria-insights/dist/" "s3://$BUCKET/cafeteria-insights/" \
  --delete \
  --profile "$AWS_PROFILE" --region "$AWS_REGION"

WEB_URL="http://${BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
echo
echo "✅ Web publicada:"
echo "   Nutrition:  ${WEB_URL}/nutrition-report/?student=0010204385"
echo "   Cafetería:  ${WEB_URL}/cafeteria-insights/"
echo
echo "Exportá para Lambdas: WEB_BASE_URL=${WEB_URL}"
