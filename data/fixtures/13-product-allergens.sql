-- data/fixtures/13-product-allergens.sql
-- Mapeo de productos a alérgenos, basado en top productos del caso demo
-- y en la lógica de product_nutrition

TRUNCATE bioalert.product_allergens;

-- Lactosa: productos con queso, leche, chocolate con leche, yogurt, cereal con leche
INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name) VALUES
  ('CHOKIS CHOCOLATE',        'lactosa'),   -- Mateo compra esto (demo trigger)
  ('CHOKIS CHISPAS GALLETAS', 'lactosa'),
  ('CHOCOLATINA JET 12GR',    'lactosa'),
  ('CEREAL ALQUEMIX (FLIPS/MILO)', 'lactosa')
ON CONFLICT DO NOTHING;

-- Gluten: empanadas, pan, galletas, deditos, productos con harina de trigo
INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name)
SELECT nombre_producto, 'gluten'
FROM bioalert.product_nutrition
WHERE canonical_name LIKE '%dedito%'
   OR canonical_name LIKE '%pan%'
   OR canonical_name LIKE '%galleta%'
   OR canonical_name LIKE '%empanada%'
ON CONFLICT DO NOTHING;

-- Mani: productos con maní o nueces
INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name)
SELECT nombre_producto, 'mani'
FROM bioalert.product_nutrition
WHERE canonical_name LIKE '%mani%'
   OR canonical_name LIKE '%nube%'
   OR canonical_name LIKE '%snickers%'
ON CONFLICT DO NOTHING;
