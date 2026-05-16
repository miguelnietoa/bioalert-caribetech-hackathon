# data/fixtures/

Scripts SQL idempotentes para precargar tablas nuevas en la DB de pruebas.

Cantidades mínimas (PRD §06):

- `parent_phone_map.sql` — mínimo 10 registros (`phone_e164`, `student_id`)
- `student_allergens.sql` — mínimo 3 estudiantes con alergias
- `product_allergens.sql` — mínimo 5 productos mapeados
- `inventory.sql` — todos los productos del colegio piloto con `current_stock` y `minimum_stock`
- `cafeteria_admins.sql` — al menos 1 admin del colegio piloto
- `product_nutrition.sql` — **generado** por un bootstrap script (TS) que toma el catálogo `products` del piloto, llama a Claude (`claude-sonnet-4-6` o `claude-haiku-4-5`) pidiendo estimación nutricional por 100g (calorías, azúcar, grasa, proteína, sodio) y emite los `INSERT` correspondientes. El script vive en el repo (ubicación a definir cuando se escriba: `scripts/bootstrap-nutrition.ts` o dentro de `lambdas/cron/`); el SQL resultante se versiona aquí.

Idempotencia: usar `ON CONFLICT DO NOTHING` o `TRUNCATE + INSERT` según el caso. Documentar qué hace cada script en su cabecera.

Para los teléfonos en `parent_phone_map` y `cafeteria_admins`: usar números **reales** del equipo y de "padres demo" para poder probar y demostrar. Cada uno tiene que haber hecho el opt-in con el sandbox del canal elegido (Kapso o Twilio) antes del demo.
