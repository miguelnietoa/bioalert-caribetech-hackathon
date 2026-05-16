# AWS onboarding — equipo BioAlert+

Setup de AWS CLI para Arcila y Maza. Compartimos un único IAM user en la cuenta sandbox de Miguel durante el hackathon.

- **Cuenta:** `642722971137` (sandbox personal de Miguel, Free Tier)
- **Región:** `us-east-1`
- **Profile local:** `biofood-hackathon`
- **IAM user compartido:** ver §1
- **Trade-off conocido:** una sola key para los 3 → si se filtra hay que rotar para todos, y CloudTrail no distingue quién hizo qué. Aceptable a 24h en cuenta sandbox.

---

## 1. Credenciales (las pasa Miguel por canal privado)

Miguel reparte por DM (1Password, Signal, Bitwarden Send). **Nunca por Slack público, commit, ni screenshot en zoom compartido.**

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=642722971137
AWS_PROFILE=biofood-hackathon
```

---

## 2. Setup en tu Mac (Arcila y Maza)

Prerrequisito:

```bash
brew install awscli
aws --version  # debería decir aws-cli/2.x
```

Configurá el profile:

```bash
aws configure --profile biofood-hackathon
# AWS Access Key ID:     <el que te pasó Miguel>
# AWS Secret Access Key: <el que te pasó Miguel>
# Default region name:   us-east-1
# Default output format: json
```

Exportá las env vars en tu `~/.zshrc` para que `serverless`, los scripts del repo y `aws` no necesiten flags:

```bash
echo '' >> ~/.zshrc
echo '# BioAlert+ hackathon' >> ~/.zshrc
echo 'export AWS_PROFILE=biofood-hackathon' >> ~/.zshrc
echo 'export AWS_REGION=us-east-1' >> ~/.zshrc
source ~/.zshrc
```

---

## 2b. Serverless Framework v4 (una vez por dev)

El deploy exige autenticación con Serverless (gratis para hackathon):

```bash
npx serverless login
```

Se abre el navegador; iniciá sesión (GitHub/Google). Alternativa para CI: `SERVERLESS_ACCESS_KEY` desde [app.serverless.com → Access Keys](https://app.serverless.com/settings/accessKeys).

Verificá:

```bash
npx serverless --version
```

---

## 3. Verificación obligatoria

Antes de codear nada:

```bash
aws sts get-caller-identity
```

Tiene que imprimir exactamente:

```json
{
    "UserId": "AIDA...",
    "Account": "642722971137",
    "Arn": "arn:aws:iam::642722971137:user/<nombre-del-user-compartido>"
}
```

Si `Account` no es `642722971137` → estás apuntando a otra cuenta. Revisá `AWS_PROFILE`.

---

## 4. Reglas de oro durante el hackathon

- **Nunca commitear `~/.aws/credentials` ni `.env`.** Confirmá con `git check-ignore .env`.
- **Region siempre `us-east-1`.** Ahí están RDS, DynamoDB, SSM, Lambdas, EventBridge.
- **Coordinen deploys.** Si los 3 corren `serverless deploy` al mismo tiempo sobre la misma stack, CloudFormation pelea. Regla simple:
  - H0–H+4: solo Maza (Track C) deploya infra base.
  - H+4 en adelante: cada uno deploya solo su Lambda con `serverless deploy function -f <name>` (no toca la stack completa).
- **No crear recursos manuales desde la consola** sin avisar — Serverless luego no los conoce y el `deploy` puede destrozarlos.
- **Si sospechás filtración** (commit accidental, screenshot, laptop perdida): avisá YA a Miguel. Él rota la key:
  ```bash
  aws iam create-access-key --user-name <user> --profile biofood-hackathon  # nueva
  aws iam delete-access-key --user-name <user> --access-key-id <vieja> --profile biofood-hackathon
  ```
  Los 3 reconfiguran (`aws configure --profile biofood-hackathon`) en 5 min.

---

## 5. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `Unable to locate credentials` | `AWS_PROFILE` no exportado o profile mal escrito | `echo $AWS_PROFILE` debe decir `biofood-hackathon`. Revisá `~/.aws/credentials`. |
| `The security token included in the request is invalid` | key vieja / rotada | Pedile la nueva a Miguel y volvé a correr `aws configure --profile biofood-hackathon`. |
| `Account` distinto a `642722971137` en `get-caller-identity` | tenés otro profile activo por env var | `unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY` y reexportá `AWS_PROFILE`. |
| `serverless deploy` falla con `AccessDenied` | el user no tiene `AdministratorAccess` (no debería pasar) | Avisá a Miguel para revisar policy adjunta. |

---

## 6. Post-hackathon (Miguel)

Cuando termine el evento:

```bash
# Borrar la access key compartida
aws iam list-access-keys --user-name <user> --profile biofood-hackathon
aws iam delete-access-key --user-name <user> --access-key-id <id> --profile biofood-hackathon

# Borrar el IAM user (después de detachear policies)
aws iam list-attached-user-policies --user-name <user> --profile biofood-hackathon
aws iam detach-user-policy --user-name <user> --policy-arn arn:aws:iam::aws:policy/AdministratorAccess --profile biofood-hackathon
aws iam delete-user --user-name <user> --profile biofood-hackathon

# Tear down de stacks
serverless remove --stage hackathon
```
