# scripts/

Scripts de bootstrap y operaciones one-shot. **NO** son código que se ejecuta en Lambda — son utilidades que corren los devs desde su máquina o desde CI.

- `bootstrap-ssm.sh` — crea los SSM parameters necesarios para el primer `serverless deploy` (DB master password). Correr UNA VEZ por stage.
- `apply-schema.sh` — aplica `data/fixtures/00-schema.sql` contra la RDS recién aprovisionada.
- `etl-reto-to-rds.sh` — copia `hackaton_ventas` y `hackaton_recargas` del reto a nuestra RDS con tipos correctos. ~1-2 min para 4.5M filas vía pipeline `COPY TO STDOUT | COPY FROM STDIN`.
- `bootstrap-nutrition.ts` — *(pendiente)* llama a Claude con el catálogo top del colegio piloto y puebla `bioalert.product_nutrition`.

Convención: scripts shell para orquestación de tooling externo (psql, aws, etc.); scripts TS para lógica con tipos (llamadas a Claude API, transformaciones de data).
