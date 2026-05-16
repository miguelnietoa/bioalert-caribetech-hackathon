# infra/

> **El `serverless.yml` vive en la raíz** (convención de Serverless Framework). Este folder queda como home de documentación de infra solamente.

Infraestructura como código con **Serverless Framework v4** (`../serverless.yml`).

Recursos definidos en el `serverless.yml` (un solo stack, sin microservicios):

- **functions:** cada Lambda de `lambdas/` con su rol IAM, env vars, layers, triggers
- **events:**
  - HTTP API (webhook entrante de Kapso) → `conversation-handler`
  - EventBridge schedules: 12PM (US-02), 7AM (US-05), domingos 6PM (EXT-2), lunes 7AM (EXT-3), cada 60s (US-03 polling)
- **resources** (CloudFormation puro embebido):
  - DynamoDB `conversations` con TTL 1h
  - S3 bucket + CloudFront distribution para `web/`
  - RDS Proxy contra la Biofood Global DB (o conexión directa si Proxy se vuelve fricción)
  - SSM Parameters (Claude API key, Kapso API key + webhook secret, DB creds — con plan de agregar Twilio creds si entra el fallback)

Empaquetado: esbuild built-in de Serverless v4 (`build.esbuild: true`) para compilar TS → ESM bundle por Lambda.

Comandos:

```
npx serverless deploy --stage hackathon
npx serverless deploy function -f conversation-handler --stage hackathon
npx serverless logs -f conversation-handler --tail --stage hackathon
```

Licencia: Serverless Framework v4 es gratis para hackathon. Si Biofood adopta post-evento y tiene >$2M USD ingresos, requiere licencia paga.
