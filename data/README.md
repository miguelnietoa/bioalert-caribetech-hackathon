# data/

Todo lo que NO es código de Lambda: fixtures SQL, fuentes externas, datos cruzados.

- `fixtures/` — scripts SQL para precargar tablas nuevas (parent_phone_map, student_allergens, product_allergens, inventory, cafeteria_admins, product_nutrition). **Bloqueador crítico H0-H2.**
- `nutrition-source/` — descargas raw de USDA FoodData Central o ICBF Colombia. No se versionan binarios grandes (ver `.gitignore`).
- `nutrition-mapped.csv` — tabla cruzada producto Biofood ↔ valores nutricionales. Este archivo SÍ se versiona porque es manual y crítico.
