-- data/fixtures/10-parent-phone-map.sql
-- IDs reales del dataset (caso-demo.md)
-- Completar <TEL_*_E164> con los números reales del equipo
TRUNCATE bioalert.parent_phone_map;
INSERT INTO bioalert.parent_phone_map (identificacion_padre, phone_e164, nombre_padre) VALUES
  -- Diana (madre de Mateo, protagonista demo) → teléfono de Miguel
  ('0090233965', '+573046002689', 'Diana'),
  -- Padre de Esteban → teléfono de Jose Arcila
  ('0090130841', '+573016787050', 'Manuel Medina'),
  -- Padre de Valentina → teléfono de Jose Maza
  ('0090130797', '+573008420902', 'Kevin Ospina')
ON CONFLICT (identificacion_padre) DO UPDATE SET
  phone_e164   = EXCLUDED.phone_e164,
  nombre_padre = EXCLUDED.nombre_padre;
