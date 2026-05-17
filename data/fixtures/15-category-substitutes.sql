-- Mapa hardcoded: cuando padre restringe X, ofrece estas alternativas.
-- Sustitutos del catálogo real (top productos del piloto).
TRUNCATE bioalert.category_substitutes;

INSERT INTO bioalert.category_substitutes (category_restricted, substitute_product, substitute_category, pitch) VALUES
  ('bebida', 'AGUA SIN GAS 600',                  'bebida', 'Top hidratación, cero azúcar'),
  ('bebida', 'JUGO HIT CAJA * 200 ML',            'bebida', 'Más fruta, menos azúcar añadida'),
  ('bebida', 'AVENA PRO AUTENTICA VASO 220 GRS',  'bebida', 'Lácteo nutritivo en lugar de gaseosa'),
  ('dulce',  'BANANO',                            'fruta',  'Energía natural, dulzura real'),
  ('dulce',  'YOGURT GRIEGO',                     'lacteo', 'Dulce y rico en proteína'),
  ('dulce',  'MANZANA',                           'fruta',  'Snack saludable de bolsillo'),
  ('snack',  'PLATANITOS',                        'snack',  'Crocante natural, menos sodio'),
  ('snack',  'BARRA DE CEREAL',                   'snack',  'Carbohidrato saludable con fibra');
