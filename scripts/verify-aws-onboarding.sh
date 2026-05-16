#!/usr/bin/env bash
# Verifica que el onboarding de docs/aws-onboarding.md esté completo.
# Uso: ./scripts/verify-aws-onboarding.sh

set -euo pipefail

EXPECTED_ACCOUNT="642722971137"
PROFILE="${AWS_PROFILE:-biofood-hackathon}"
REGION="${AWS_REGION:-us-east-1}"

fail() {
  echo "❌ $1"
  exit 1
}

ok() {
  echo "✅ $1"
}

warn() {
  echo "⚠️  $1"
}

echo "BioAlert+ — verificación AWS onboarding"
echo "Profile: $PROFILE · Region: $REGION"
echo

command -v aws >/dev/null 2>&1 || fail "AWS CLI no instalado. Ver docs/aws-onboarding.md §2 (brew install awscli o PKG oficial)."

VERSION=$(aws --version 2>&1)
echo "$VERSION" | grep -q 'aws-cli/2' || warn "Se recomienda AWS CLI v2; tienes: $VERSION"

test -f "$HOME/.aws/credentials" || fail "No existe ~/.aws/credentials. Corré: aws configure --profile $PROFILE"

grep -q "\[$PROFILE\]" "$HOME/.aws/credentials" || fail "Profile [$PROFILE] no encontrado en ~/.aws/credentials"

if [[ "${AWS_PROFILE:-}" != "$PROFILE" ]]; then
  warn "AWS_PROFILE no está exportado en esta shell (valor actual: ${AWS_PROFILE:-<unset>}). Agregá export AWS_PROFILE=$PROFILE a ~/.zshrc"
else
  ok "AWS_PROFILE exportado en esta shell"
fi

IDENTITY=$(aws sts get-caller-identity --profile "$PROFILE" --output json 2>&1) || fail "get-caller-identity falló: $IDENTITY"

ACCOUNT=$(echo "$IDENTITY" | grep -o '"Account": "[0-9]*"' | cut -d'"' -f4)
[[ "$ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || fail "Account=$ACCOUNT (esperado $EXPECTED_ACCOUNT). Revisá credenciales y profile."

ok "Cuenta AWS correcta ($EXPECTED_ACCOUNT)"
echo "$IDENTITY" | python3 -m json.tool 2>/dev/null || echo "$IDENTITY"

command -v node >/dev/null 2>&1 || warn "Node.js no encontrado (Track C requiere Node 20+)"
command -v psql >/dev/null 2>&1 || warn "psql no encontrado (brew install postgresql @16)"

if git -C "$(dirname "$0")/.." check-ignore -q .env 2>/dev/null; then
  ok ".env está en .gitignore"
else
  warn ".env no está ignorado por git"
fi

echo
echo "Listo para Track C cuando todo arriba sea ✅ (sin ⚠️ críticos)."
