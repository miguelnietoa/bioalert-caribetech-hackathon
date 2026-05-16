# data/

Fixtures SQL idempotentes para precargar tablas nuevas en la DB de pruebas.

- `fixtures/` — scripts SQL para `parent_phone_map`, `student_allergens`, `product_allergens`, `inventory`, `cafeteria_admins`, `product_nutrition`. **Bloqueador crítico H0-H2.**

La tabla `product_nutrition` (extensión nuestra para EXT-2/EXT-3) se llena con un **bootstrap script** que llama a Claude una sola vez con el catálogo de productos del piloto y le pide estimar calorías/azúcar/grasa/proteína/sodio por 100g para cada uno. Ver nota en `fixtures/README.md`. No cruzamos manualmente USDA/ICBF — no aporta diferencial y consume horas valiosas de Dev 4.
