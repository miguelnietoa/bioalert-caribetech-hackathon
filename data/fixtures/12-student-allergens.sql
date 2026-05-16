-- Mateo, Esteban, Valentina (caso demo — analysis/results/caso-demo.md)
TRUNCATE bioalert.student_allergens;
INSERT INTO bioalert.student_allergens (usuario_identificacion, allergen_name) VALUES
  ('0010204385', 'lactosa'),
  ('0010130700', 'gluten'),
  ('0010130672', 'mani');
