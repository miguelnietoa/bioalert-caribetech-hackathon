# infra/

Plantillas de infraestructura como código (CloudFormation o CDK — decisión pendiente).

Recursos esperados:

- `lambdas.yaml` — definiciones de cada Lambda con su rol IAM, env vars, layers
- `api-gateway.yaml` — HTTP API con el webhook de WhatsApp
- `eventbridge.yaml` — crons: 12PM ausencia (US-02), 7AM stock (US-05), dom 6PM nutrición (EXT-2), lun 7AM cafetería (EXT-3)
- `dynamodb.yaml` — tabla `conversations` con TTL 1h
- `rds-proxy.yaml` — proxy contra la Biofood Global DB
- `s3-cloudfront.yaml` — bucket + distribución para `web/`
- `ssm.yaml` — parámetros (Claude API key, WhatsApp tokens, DB creds)

Nada de microservicios. Una sola stack si es viable.
