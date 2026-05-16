-- data/fixtures/12-student-allergens.sql
-- IDs reales del dataset (caso-demo.md)
-- Mateo → lactosa (CHOKIS CHOCOLATE y CEREAL ALQUEMIX lo contienen)
-- Esteban → gluten (EMPANADA lo contiene)
-- Valentina → mani
TRUNCATE bioalert.student_allergens;
INSERT INTO bioalert.student_allergens (usuario_identificacion, allergen_name) VALUES
  ('0010204385', 'lactosa'),   -- Mateo Martinez Ramirez
  ('0010130700', 'gluten'),    -- Esteban Nieto Lopez
  ('0010130672', 'mani');      -- Valentina Mendoza Morales
