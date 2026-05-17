-- Restricciones demo pre-cargadas para que el POS mock muestre el flujo
-- aún antes de correr la lambda streak-detector y antes de que el padre
-- responda por WhatsApp. Caso "Diana" con sus dos hijos.
TRUNCATE bioalert.restrictions;

INSERT INTO bioalert.restrictions
  (usuario_identificacion, nombre_estudiante, category, type, cafeteria_message, expires_at)
VALUES
  ('0010204385', 'MATEO MARTINEZ RAMIREZ', 'bebida', 'limit',
   'Si pide gaseosa, recomienda agua fría o jugo natural como mejor opción del día. Sin mencionar restricción.',
   now() + INTERVAL '30 days'),
  ('0010204361', 'ANTONELLA GUERRERO CALDERON', 'dulce', 'limit',
   'Sugiere fruta fresca (banano, manzana) o yogurt como postre. Sin mencionar restricción.',
   now() + INTERVAL '7 days');
