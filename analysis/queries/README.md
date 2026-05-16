# analysis/queries/

Queries SQL pre-escritas contra la DB del reto (`biofooddb`). Pensadas para que Product Senior (o cualquiera con `psql` / DBeaver / Postico / TablePlus) las corra sin pelearse con sintaxis.

Conexión: ver `.env.example` en la raíz del repo (host, port, db, user, password — públicas, del reto).

- `01-schema-discovery.sql` — inspecciona qué tablas existen y sus columnas. Correr al inicio de cada sesión por si el reto agrega tablas nuevas.
- `02-colegios-candidatos.sql` — ranking goldilocks de colegios candidatos a piloto. Parámetro `:dias` (default 90).
- `03-mateos-candidatos.sql` — perfilamiento de estudiantes dentro de un colegio elegido. Parámetro `:nit_colegio` y `:dias`.

Convención: las queries son `SELECT` puros (read-only). Cualquier creación de tabla `bioalert_*` va en `data/fixtures/`, no acá.
