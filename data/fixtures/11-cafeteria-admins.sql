-- data/fixtures/11-cafeteria-admins.sql
-- El admin demo usa el mismo número que Miguel (un número, dos roles para la demo)
TRUNCATE bioalert.cafeteria_admins;
INSERT INTO bioalert.cafeteria_admins (phone_e164, nit_colegio, display_name) VALUES
  ('+573046002689', '900000680', 'Admin Cafetería DEMO 680')
ON CONFLICT (phone_e164) DO UPDATE SET
  nit_colegio  = EXCLUDED.nit_colegio,
  display_name = EXCLUDED.display_name;
