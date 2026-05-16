TRUNCATE bioalert.inventory;

INSERT INTO bioalert.inventory (nombre_producto, nit_colegio, current_stock, minimum_stock)
SELECT
  nombre_producto,
  '900000680',
  (RANDOM() * 100)::int,
  20
FROM (
  SELECT v.nombre_producto
  FROM reto.ventas v
  WHERE v.nit_colegio = '900000680'
    AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '90 days'
  GROUP BY v.nombre_producto
  ORDER BY COUNT(*) DESC
  LIMIT 100
) top_products;

UPDATE bioalert.inventory SET current_stock = 5
WHERE nombre_producto IN (
  SELECT nombre_producto FROM bioalert.inventory ORDER BY RANDOM() LIMIT 5
);
