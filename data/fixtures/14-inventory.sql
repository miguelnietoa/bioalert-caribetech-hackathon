-- data/fixtures/14-inventory.sql
-- Inventario sintético del colegio piloto 900000680.
-- Genera filas a partir de top productos + asigna stock aleatorio.
-- 5 productos forzados a stock crítico para el demo de US-05.

TRUNCATE bioalert.inventory;

INSERT INTO bioalert.inventory (nombre_producto, nit_colegio, current_stock, minimum_stock)
SELECT DISTINCT
  v.nombre_producto,
  '900000680',
  (RANDOM() * 80 + 25)::int  AS current_stock,   -- 25-105 unidades
  20                         AS minimum_stock
FROM reto.ventas v
WHERE v.nit_colegio = '900000680'
  AND v.fecha >= (SELECT MAX(fecha) FROM reto.ventas) - INTERVAL '7 days'
GROUP BY v.nombre_producto
ORDER BY COUNT(*) DESC
LIMIT 100
ON CONFLICT DO NOTHING;

-- Forzar exactamente 5 productos en stock crítico (< minimum) para la demo US-05
UPDATE bioalert.inventory
SET current_stock = (RANDOM() * 10 + 1)::int   -- 1-11 unidades (bajo mínimo de 20)
WHERE nombre_producto IN (
  SELECT nombre_producto FROM bioalert.inventory
  WHERE nit_colegio = '900000680'
  ORDER BY RANDOM()
  LIMIT 5
);
