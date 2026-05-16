TRUNCATE bioalert.product_allergens;

INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name)
SELECT nombre_producto, 'gluten'
FROM bioalert.product_nutrition
WHERE canonical_name LIKE '%dedito%'
   OR canonical_name LIKE '%pan%'
   OR canonical_name LIKE '%galleta%'
   OR canonical_name LIKE '%empanada%'
   OR canonical_name LIKE '%oreo%';

INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name)
SELECT nombre_producto, 'lactosa'
FROM bioalert.product_nutrition
WHERE canonical_name LIKE '%queso%'
   OR canonical_name LIKE '%leche%'
   OR canonical_name LIKE '%yogurt%'
   OR canonical_name LIKE '%chokis%'
   OR canonical_name LIKE '%chocolate%'
   OR canonical_name LIKE '%cereal%';

INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name)
SELECT nombre_producto, 'mani'
FROM bioalert.product_nutrition
WHERE canonical_name LIKE '%mani%'
   OR canonical_name LIKE '%cacahuate%';

-- Demo US-03: CHOKIS explícito para alerta con Mateo (lactosa)
INSERT INTO bioalert.product_allergens (nombre_producto, allergen_name) VALUES
  ('CHOKIS CHOCOLATE', 'lactosa'),
  ('CHOKIS CHISPAS GALLETAS', 'lactosa')
ON CONFLICT DO NOTHING;
