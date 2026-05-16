# data/fixtures/

Scripts SQL idempotentes para precargar tablas nuevas en la DB de pruebas.

Cantidades mínimas (PRD §06):

- `parent_phone_map.sql` — mínimo 10 registros (`phone_e164`, `student_id`)
- `student_allergens.sql` — mínimo 3 estudiantes con alergias
- `product_allergens.sql` — mínimo 5 productos mapeados
- `inventory.sql` — todos los productos del colegio piloto con `current_stock` y `minimum_stock`
- `cafeteria_admins.sql` — al menos 1 admin del colegio piloto
- `product_nutrition.sql` — extensión nuestra, generado desde `data/nutrition-mapped.csv`

Idempotencia: usar `ON CONFLICT DO NOTHING` o `TRUNCATE + INSERT` según el caso. Documentar qué hace cada script en su cabecera.
