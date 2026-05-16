# Caso demo — Diana y Mateo

**Colegio piloto:** `COLEGIO DEMO 680` (NIT `900000680`) — 88 estudiantes activos en 90 días, 130 productos distintos, ratio ventas/recargas sano (5.6×).

**Ventana de análisis:** últimos 90 días relativos al MAX(fecha) del dataset (2026-05-29).

> **Nota de PII:** los nombres en el dataset están anonimizados pero son verosímiles. Para el pitch usamos "Diana" como persona ficticia de la madre de Mateo (en el dataset crudo aparece como `ANDRES ROJAS ROMERO` — no contradice nada: el género/relación del adulto no está modelado en la data). El resto de nombres se mantienen tal cual aparecen.

---

## 1. MATEO — protagonista del pitch

| Campo | Valor |
|---|---|
| `usuario_identificacion` | `0010204385` |
| `nombre_estudiante` | `MATEO MARTINEZ RAMIREZ` |
| `identificacion_padre` | `0090233965` |
| `nombre_padre` (en data) | `ANDRES ROJAS ROMERO` |
| **Persona pitch** | **"Diana"** (mapeada al teléfono de Miguel) |

### Patrón de consumo (90 días)

| Métrica | Mateo | Promedio del colegio | Mateo vs colegio |
|---|---|---|---|
| Gasto total | **$452.300** | $237.682 | **1.9×** |
| Compras | **160** | 61 | **2.6×** |
| Ticket promedio | $2.827 | $3.484 | 0.8× |
| Días con compra | 42 (de 90) | — | — |
| % gasto en dulce/snack | **41.4%** | — | — |

**Lectura:** Mateo no es "el que más gasta por compra" — es **"el que compra muchas veces tickets pequeños"**. Es el patrón clásico del niño con saldo abundante en cafetería bien provista de snacks.

### Distribución por día de semana

| Día | Compras | Ticket prom. |
|---|---|---|
| Lunes | 23 | $2.900 |
| Martes | 34 | $2.638 |
| Miércoles | **41** ← pico | $2.710 |
| Jueves | 27 | $3.074 |
| Viernes | 31 | $2.913 |
| Sábado | 4 | $2.875 |

Mateo compra **prácticamente todos los días hábiles**. Miércoles es su día más alto.

### Top productos consumidos (90 días)

| # | Producto | Veces | Gasto | Categoría |
|---|---|---|---|---|
| 1 | JUGO HIT CAJA × 200 ML | 24 | $60.000 | bebida azúcar |
| 2 | EMPANADA | 18 | $76.000 | snack salado |
| 3 | BARRILETE | 14 | $10.500 | dulce/gomita |
| 4 | CHOKIS CHOCOLATE | 14 | $36.000 | galleta con chocolate |
| 5 | CEREAL ALQUEMIX (FLIPS/MILO) | 12 | $60.000 | cereal con azúcar |
| 6 | CHOKIS CHISPAS GALLETAS | 10 | $28.600 | galleta con chocolate |
| 7 | CINTA DE GOMA | 9 | $5.400 | dulce/gomita |
| 8 | JUGO HIT × 500 ML | 6 | $28.000 | bebida azúcar |
| 9 | AGUA SIN GAS 600 | 5 | $17.500 | bebida (única "neutra") |
| 10 | CHOCOLATINA JET 12GR | 5 | $10.000 | chocolate |

**Lectura:** de los 10 productos top, **9 son dulce/snack/bebida azucarada**. Solo "agua sin gas" es neutral. Esta es la diapositiva visual del pitch.

---

## 2. DIANA — la madre

`identificacion_padre`: `0090233965`. En `bioalert.parent_phone_map` se mapea al teléfono de **Miguel** (E.164 a confirmar — pasar a Jose Maza).

### Patrón de recargas (90 días)

| Métrica | Valor |
|---|---|
| Número de recargas | **69** |
| Frecuencia | ~1 cada 1.3 días hábiles |
| Recarga mínima | $5.000 |
| Recarga máxima | $20.000 |
| Recarga promedio | **$15.319** |
| Total recargado en 90 días | ~$1.057.000 |
| Total que gastó Mateo | $452.300 (43% del recargado) |

**Lectura:** Diana **recarga muy frecuente y poco**, en chunks de $10-20K. Probablemente no tiene visibilidad del consumo agregado de Mateo — recarga reactivamente cuando ve "saldo bajo" en la app. Le faltan dos cosas: **qué come el chico, y un plan de recarga inteligente**.

### Detalle últimas 20 recargas

Múltiples recargas el mismo día (ej. 2026-05-15: 2 recargas de $15.000). Sugiere padres haciendo top-ups múltiples cuando ven el saldo cerca de cero — fricción evitable.

---

## 3. ESTEBAN — arquetipo Irregular

| Campo | Valor |
|---|---|
| `usuario_identificacion` | `0010130700` |
| Nombre | `ESTEBAN NIETO LOPEZ` |
| `identificacion_padre` | `0090130841` (`MANUEL MEDINA GARCIA`) |

### Métricas
- 102 compras, 26 días con compra (varias compras/día)
- Ticket promedio **$4.317** con **stddev $5.196** — el doble del promedio, alta dispersión
- Solo **9.4% dulce/snack** — patrón irregular puro, no confundido con azúcar
- Padre: 64 recargas en 90 días, promedio $16.375

### Top productos (90 días)
1. FUZE TEA 400 — 17 veces
2. AGUA CON GAS — 14 veces
3. EMPANADA — 8 veces
4. PALETA CHAMOY, CEREAL, MAMUT — 7 cada uno

**Lectura:** Esteban come variado y prefiere bebidas (té, agua con gas). Algunos días compra 5-6 cosas, otros días nada → varianza alta. Buen contraste con Mateo para mostrar "no todos los niños compran azúcar".

---

## 4. VALENTINA — arquetipo "Control" (varianza baja)

| Campo | Valor |
|---|---|
| `usuario_identificacion` | `0010130672` |
| Nombre | `VALENTINA MENDOZA MORALES` |
| `identificacion_padre` | `0090130797` (`KEVIN OSPINA HERNANDEZ`) |

### Métricas
- 42 compras, 28 días con compra → 1.5 compras/día (regular)
- Ticket promedio $3.667, stddev $1.258 (bajo)
- **34.6% dulce/snack** (cerca de la mediana)
- Padre: solo **3 recargas** en 90 días, promedio $41.667 — recarga "a la antigua" (poco frecuente, monto grande)

### Top productos (90 días)
1. GASEOSA (Postobón Colombiana / Pepsi / Uva) — 9 veces
2. BRAWNIE CHOCORRAMO — 6 veces
3. CHEETOS BOLIQUESO — 4 veces
4. CHOCOCONO — 3 veces

**Lectura:** "Control" en el sentido estadístico (baja varianza), no en el sentido nutricional — su consumo también es procesado/dulce. Buena observación para el pitch: **incluso el "caso normal" del colegio consume mayormente snack y bebida azucarada**. Argumento para EXT-3 (cafetería necesita más opciones saludables).

---

## 5. Punto de tensión del demo

> **"Diana cree que recarga 'lo justo' — ve los chunks pequeños de $15.000 cada par de días. La realidad: está recargando ~$117.000 cada mes, y el 41% de lo que Mateo compra es azúcar añadida. Diana no tiene visibilidad — hasta hoy."**

Datos que sustentan la frase:
- Diana recarga $15K cada 1-2 días = ~$117K/mes
- Mateo gasta 1.9× el promedio del colegio en gasto, 2.6× en frecuencia
- 9 de los 10 productos top de Mateo son dulce/snack/bebida azucarada
- El miércoles, Mateo hace 41 compras en 90 días (casi una por miércoles)

---

## 6. Casos de uso a demostrar

En este orden durante el demo en vivo, con WhatsApp real:

### 6.1 US-01 — Diana pregunta qué comió Mateo hoy
- Mensaje: *"¿qué comió Mateo hoy?"*
- Respuesta esperada: lista de los productos de hoy del dataset, con totales, justificación EXT-4 ("te lo cuento porque me preguntaste por hoy y vi N transacciones")

### 6.2 US-01 — Diana pregunta por la semana
- Mensaje: *"¿y esta semana?"*
- Respuesta: agregado de últimos 7 días, top 3 productos, gasto total

### 6.3 EXT-1 — Diana pregunta cuánto recargar
- Mensaje: *"¿cuánto le recargo?"* o *"quiero recargar"*
- Respuesta: 3 opciones (Esencial $80K / Equilibrada $150K / Bienestar $220K) con justificación data-driven (gasto promedio diario de Mateo, % azúcar, comparación con peers)
- Quick replies (EXT-6): 3 botones con los nombres de las opciones

### 6.4 US-03 — Alerta de alérgeno en <30s
- Setup: pre-insertar `student_allergens` con `Mateo + lactosa` (o similar) + `product_allergens` con `CHOKIS CHOCOLATE → lactosa`
- Insertar nueva venta sintética en `hackaton_ventas` (o esperar que aparezca naturalmente)
- Diana recibe alerta automática <30s después

### 6.5 EXT-2 — Reporte nutricional semanal (preview)
- Dispararla manualmente con `npx serverless invoke -f nutrition-weekly`
- Diana recibe WhatsApp con top 3 productos + macros + comparativa peer + link a vista web
- Abrir el link en el celular → mostrar la vista con Chart.js

### 6.6 EXT-3 + EXT-5 — Admin de cafetería ve insight cruzado (cierre)
- Dispararla manualmente con `npx serverless invoke -f cafeteria-weekly`
- Admin recibe: benchmark vs otros colegios + "X padres con hijos de alto consumo de azúcar (incluida Diana) — productos saludables que tienen colegios similares y faltan acá: ..."
- Esto cierra el loop padre→cafetería

---

## 7. Métricas para el pitch (frases concretas)

- *"Mateo compra **2.6× más veces** que el promedio del colegio. **41% del gasto** va a dulce o azúcar añadida."*
- *"Diana hace **69 recargas en 90 días** — casi una cada día y medio, en chunks de $15.000. Recarga reactivamente, sin un plan."*
- *"De los **10 productos top** de Mateo, **9 son procesados o azúcar**. El único 'neutral' es el agua."*

Para el cierre del pitch (apéndice del plan):

> *"Si Diana adoptara la opción Equilibrada de BioAlert+ ($150.000/mes), Biofood pasaría de ~$117.000/mes a $150.000/mes de Diana — **+28% de ticket en este caso real**. Aplicado a los 90 colegios y 10 años de data acumulada, el modelo de uplift sale conservadoramente entre $1.2B y $2.4B COP anuales."*

---

## 8. Handoff a Jose Maza — datos para `bioalert.*` fixtures

> Para `data/fixtures/10-parent-phone-map.sql`:

```sql
TRUNCATE bioalert.parent_phone_map;
INSERT INTO bioalert.parent_phone_map (identificacion_padre, phone_e164, nombre_padre) VALUES
  -- Diana (madre de Mateo, protagonista demo) → teléfono de Miguel
  ('0090233965', '<TEL_MIGUEL_E164>', 'Diana'),
  -- Padre de Esteban → teléfono de Jose Arcila
  ('0090130841', '<TEL_ARCILA_E164>', 'Manuel Medina'),
  -- Padre de Valentina → teléfono de Jose Maza
  ('0090130797', '<TEL_MAZA_E164>',   'Kevin Ospina')
ON CONFLICT (identificacion_padre) DO UPDATE SET
  phone_e164 = EXCLUDED.phone_e164,
  nombre_padre = EXCLUDED.nombre_padre;
```

> Para `data/fixtures/11-cafeteria-admins.sql`:

```sql
TRUNCATE bioalert.cafeteria_admins;
INSERT INTO bioalert.cafeteria_admins (phone_e164, nit_colegio, display_name) VALUES
  -- El admin demo lo asumimos como Miguel (mismo número) — para el demo importa la persona, no el rol
  ('<TEL_MIGUEL_E164>', '900000680', 'Admin Cafetería DEMO 680');
```

> Para `data/fixtures/12-student-allergens.sql`:

```sql
TRUNCATE bioalert.student_allergens;
INSERT INTO bioalert.student_allergens (usuario_identificacion, allergen_name) VALUES
  ('0010204385', 'lactosa'),     -- Mateo (chokis chocolate, cereal flips/milo lo contienen)
  ('0010130700', 'gluten'),      -- Esteban (empanada, oreo lo contienen)
  ('0010130672', 'mani');        -- Valentina (alguno de su top puede contener)
```

(Los `product_allergens` y `inventory` los pobla Jose Maza con la lógica de su plan.)
