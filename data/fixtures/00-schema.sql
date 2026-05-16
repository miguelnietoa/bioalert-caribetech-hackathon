-- 00-schema.sql
-- Crea los schemas `reto` (clones tipados del reto) y `bioalert` (nuestras tablas)
-- en la RDS bioalert. Idempotente. Correr UNA VEZ después de que serverless deploy
-- termine de aprovisionar la RDS.
--
-- Uso (CLI):
--   PGPASSWORD="$RDS_PASSWORD" psql -h "$RDS_HOST" -U bioalert_app -d bioalert \
--     -f data/fixtures/00-schema.sql

-- ============================================================
-- Schema reto: clones tipados de las 2 tablas del reto.
-- En vez de all-text como `hackaton_*`, acá los tipos son correctos.
-- `importe` se computa automáticamente.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS reto;

CREATE TABLE IF NOT EXISTS reto.ventas (
  id                       bigserial      PRIMARY KEY,
  usuario_identificacion   text,
  nombre_estudiante        text,
  fecha                    date,
  cantidad                 int,
  precio                   numeric(12,2),
  importe                  numeric(14,2) GENERATED ALWAYS AS (cantidad * precio) STORED,
  nombre_producto          text,
  identificacion_padre     text,
  nombre_padre             text,
  colegio                  text,
  nit_colegio              text
);

CREATE INDEX IF NOT EXISTS ventas_nit_fecha     ON reto.ventas (nit_colegio, fecha);
CREATE INDEX IF NOT EXISTS ventas_usuario_fecha ON reto.ventas (usuario_identificacion, fecha);
CREATE INDEX IF NOT EXISTS ventas_producto      ON reto.ventas (nombre_producto);
CREATE INDEX IF NOT EXISTS ventas_padre         ON reto.ventas (identificacion_padre);

CREATE TABLE IF NOT EXISTS reto.recargas (
  id                       bigserial      PRIMARY KEY,
  usuario_identificacion   varchar(20),
  nombre_estudiante        varchar(200),
  fecha                    date,
  valor                    numeric(14,2),
  identificacion_padre     varchar(20),
  nombre_padre             varchar(200),
  colegio                  varchar(200),
  nit_colegio              varchar(30)
);

CREATE INDEX IF NOT EXISTS recargas_usuario_fecha ON reto.recargas (usuario_identificacion, fecha);
CREATE INDEX IF NOT EXISTS recargas_nit_fecha     ON reto.recargas (nit_colegio, fecha);

-- ============================================================
-- Schema bioalert: fixtures y data nuestra
-- ============================================================
CREATE SCHEMA IF NOT EXISTS bioalert;

-- Mapeo identificacion_padre del reto -> teléfono E.164 que opt-inneó al sandbox de Kapso
CREATE TABLE IF NOT EXISTS bioalert.parent_phone_map (
  identificacion_padre  text         PRIMARY KEY,
  phone_e164            text         NOT NULL UNIQUE,
  nombre_padre          text,
  created_at            timestamptz  DEFAULT now()
);

-- Admins de cafetería (también opt-in al sandbox)
CREATE TABLE IF NOT EXISTS bioalert.cafeteria_admins (
  phone_e164            text         PRIMARY KEY,
  nit_colegio           text         NOT NULL,
  display_name          text,
  created_at            timestamptz  DEFAULT now()
);

-- Alergias por estudiante (PRD US-03)
CREATE TABLE IF NOT EXISTS bioalert.student_allergens (
  usuario_identificacion  text,
  allergen_name           text,
  PRIMARY KEY (usuario_identificacion, allergen_name)
);

-- Alérgenos por producto (PRD US-03). `nombre_producto` no normalizado — usar canonical_name de product_nutrition para joins inteligentes.
CREATE TABLE IF NOT EXISTS bioalert.product_allergens (
  nombre_producto        text,
  allergen_name          text,
  PRIMARY KEY (nombre_producto, allergen_name)
);

-- Inventario simulado para el colegio piloto (PRD US-05). El reto no expone stock real.
CREATE TABLE IF NOT EXISTS bioalert.inventory (
  nombre_producto        text,
  nit_colegio            text,
  current_stock          int          NOT NULL,
  minimum_stock          int          NOT NULL,
  updated_at             timestamptz  DEFAULT now(),
  PRIMARY KEY (nombre_producto, nit_colegio)
);

-- Nutrición estimada por Claude (EXT-2 / EXT-3). canonical_name consolida variantes ortográficas.
CREATE TABLE IF NOT EXISTS bioalert.product_nutrition (
  nombre_producto        text         PRIMARY KEY,
  canonical_name         text,
  category               text,        -- 'snack' | 'bebida' | 'dulce' | 'fruta' | 'comida' | etc.
  calories_100g          numeric(8,2),
  sugar_g                numeric(8,2),
  fat_g                  numeric(8,2),
  protein_g              numeric(8,2),
  sodium_mg              numeric(8,2),
  estimated_by           text         DEFAULT 'claude-haiku-4-5-20251001',
  estimated_at           timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_nutrition_canonical ON bioalert.product_nutrition (canonical_name);
CREATE INDEX IF NOT EXISTS product_nutrition_category  ON bioalert.product_nutrition (category);

-- ============================================================
-- Verificación rápida
-- ============================================================
\echo '=== Schemas creados ==='
SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('reto', 'bioalert') ORDER BY 1;

\echo '=== Tablas en reto ==='
SELECT table_name FROM information_schema.tables WHERE table_schema = 'reto' ORDER BY 1;

\echo '=== Tablas en bioalert ==='
SELECT table_name FROM information_schema.tables WHERE table_schema = 'bioalert' ORDER BY 1;
