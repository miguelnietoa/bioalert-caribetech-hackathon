# docs/db-schema.md — Esquema real de la DB del reto

Inspección realizada **2026-05-16** sobre `biofooddb` (Postgres 14.22 en Ubuntu 22.04, `3.208.123.187:5432`), usuario `hackathon_dev`.

> **Verdad operativa:** las queries reales de las Lambdas viven en `lambdas/<lambda>/queries/*.sql` y deben usar las tablas reales de este documento. Lo que dice el PRD §05 sobre "tablas existentes en Biofood" describe el **modelo deseado**, no lo que el reto expone.

---

## 1. Tablas reales del reto

Solo dos tablas, en schema `public`, denormalizadas:

### `hackaton_ventas` (4,257,396 filas)

| Columna | Tipo | NULL | Notas |
|---|---|---|---|
| `usuario_identificacion` | `text` | sí | Cédula del estudiante. Convención: empieza con `001` |
| `nombre_estudiante` | `text` | sí | Nombre completo. Anonimizado pero verosímil |
| `fecha` | **`text`** | sí | Formato ISO `YYYY-MM-DD`. **Castear con `::date` en cada query** |
| `cantidad` | **`text`** | sí | Numérico como string. 92% son `1`; pueden ser hasta `33` (packs) |
| `precio` | **`text`** | sí | Numérico como string, COP, formato `4000.0` |
| `nombre_producto` | `text` | sí | Texto libre. **Catálogo no normalizado** — ver Anomalías |
| `identificacion_padre` | `text` | sí | Cédula del padre. Convención: empieza con `009`. **NULL/empty en 187,627 filas (4.4%)** |
| `nombre_padre` | `text` | sí | Nombre completo padre/madre |
| `colegio` | `text` | sí | Nombre del colegio, ej. `COLEGIO DEMO 680` |
| `nit_colegio` | `text` | sí | NIT del colegio, ej. `90000037` o `900000680` (longitud variable) |

**No tiene PK ni FKs.** Sin índices visibles (asumir que cualquier query sobre la tabla completa es expensive: 4.2M filas).

### `hackaton_recargas` (305,218 filas)

| Columna | Tipo | NULL | Notas |
|---|---|---|---|
| `id` | `bigint` | no | PK, autoincrement |
| `usuario_identificacion` | `varchar(20)` | sí | Cédula del estudiante |
| `nombre_estudiante` | `varchar(200)` | sí | |
| `fecha` | **`date`** | sí | Tipado correcto, distinto de ventas |
| `valor` | `numeric` | sí | Monto de recarga en COP |
| `identificacion_padre` | `varchar(20)` | sí | **Frecuentemente NULL** (≈80% de los casos en sample) |
| `nombre_padre` | `varchar(200)` | sí | NULL acompaña al anterior |
| `colegio` | `varchar(200)` | sí | |
| `nit_colegio` | `varchar(30)` | sí | |

Nota: `recargas.identificacion_padre` está vacío con frecuencia — probablemente las recargas hechas en efectivo en cafetería no traen padre asociado. **Para vincular padre↔estudiante usar `hackaton_ventas`, no `hackaton_recargas`.**

---

## 2. Permisos del usuario `hackathon_dev`

| Permiso | Estado |
|---|---|
| `CONNECT` a `biofooddb` | ✅ |
| `CREATE DATABASE` | ❌ |
| `CREATE` en schema `public` | ✅ — **podemos crear nuestras tablas aquí** |
| `USAGE` en schema `public` | ✅ |
| `SELECT` en `hackaton_*` | ✅ |
| `INSERT` / `UPDATE` / `DELETE` en `hackaton_*` | ❌ |

**Decisión:** todas las tablas BioAlert+ se crean en `public` con el prefijo **`bioalert_*`** para no chocar con las del reto y dejar claro el origen.

---

## 3. Cardinalidades (snapshot 2026-05-16)

| Métrica | Valor |
|---|---|
| Colegios distintos (`nit_colegio`) | 47 |
| Estudiantes distintos (`usuario_identificacion`) | 19,281 |
| Padres distintos (`identificacion_padre`) | 11,879 |
| Productos distintos (`nombre_producto`) | **6,783** (con duplicados — ver Anomalías) |
| Cantidades distintas | 118 |
| Rango ventas | 2024-01-08 → **2026-05-29** (13 días en el "futuro" relativo a hoy) |
| Rango recargas | 2024-01-07 → 2026-05-15 |

---

## 4. Anomalías y gotchas

### 4.1 Catálogo de productos no normalizado

El campo `nombre_producto` es texto libre. Ejemplo: **siete variantes** del mismo producto en el top 15:

- `DEDITO QUESO`
- `DEDITO DE QUESO HORNEADO`
- `DEDITOS DE QUESO HORNEADOS MARIATERE`
- `DEDITO DE HOJALDRE`
- `DEDITOS HORNEADOS`
- `DEDITO FRITO`
- `DEDITO HORNEADO`

**Implicación:** para EXT-2 (nutrición) y EXT-3 (benchmark) necesitamos consolidar. Estrategia para hackathon:
- Limitar `product_nutrition` solo al **top N productos del colegio piloto** (~50-150 productos, no los 6,783 globales)
- Pedirle a Claude que devuelva tanto `nombre_canonico` como el `nutrition`, agrupando variantes ortográficas en el mismo grupo
- Mantener el `nombre_producto` original en `bioalert_product_nutrition.original_name` para joins con `hackaton_ventas`

### 4.2 Corrupción UTF-8/Latin1

Algunos productos tienen mojibake: `LIMONADA FRAPPÃ` (de `FRAPPÉ`), `TEQUEÃO` (de `TEQUEÑO`), `AGUA BRISA PEQUEÃA` (de `PEQUEÑA`). Origen: pipeline de ingesta. **No filtrar por igualdad de string** — usar `LOWER(unaccent(nombre_producto))` o regex tolerante.

### 4.3 Padres NULL en ventas

4.4% de las ventas no tienen `identificacion_padre`. Para flujos de "alertar al padre" hay que skip esas filas o vincular por estudiante a otra venta del mismo estudiante que sí tenga padre.

### 4.4 Recargas vs ventas — ratio inestable

Ratio ventas:recargas por colegio en últimos 90 días varía de 5x a 2,269x. Probable que muchas recargas se hagan por canales no capturados (efectivo en cafetería sin registrar, transferencias bancarias, etc.). **Implicación para US-04 (proyección de saldo):** el balance real no se puede calcular como `sum(recargas) - sum(ventas*precio)` si el sistema no captura todas las recargas. Para el demo: elegir colegios con ratio sano (ver §5) o pre-precargar saldos sintéticos para los estudiantes demo.

### 4.5 Cantidades anómalas

Hay ventas con `cantidad = 33`, `32`, `10` — pueden ser packs reales o errores de captura. Para el cálculo de importe total usar `cantidad::numeric * precio::numeric` con guardia para outliers en el EDA.

### 4.6 Sin grado / sección

El PRD habla de `students.grade` pero el dataset no lo trae. **EXT-2 "comparación con compañeros de grado" se degrada a "compañeros del mismo colegio"** — sigue siendo un benchmark útil.

### 4.7 Sin inventario

El PRD asume `inventory(product_id, school_id, current_stock, minimum_stock)`. No existe. Para US-05 vamos a **simular** stock: fixture `bioalert_inventory` con datos plausibles para el colegio piloto, refrescado periódicamente o estático para la demo.

---

## 5. Mejor colegio candidato a piloto (90 días)

Top 5 según query goldilocks (estudiantes activos 30-200, ventas ≥500):

| NIT | Colegio | Est. activos | Padres ident. | Ventas 90d | Productos | Ticket avg | Recargas 90d | Recarga avg |
|---|---|---|---|---|---|---|---|---|
| `900000680` | COLEGIO DEMO 680 | 88 | 62 (70%) | 5,466 | **130** | **$3,866** | **971** | $18,781 |
| `900000703` | COLEGIO DEMO 703 | 194 | 170 (88%) | 9,169 | 79 | $2,524 | 110 | $20,330 |
| `900000695` | COLEGIO DEMO 695 | 127 | 97 (76%) | 5,873 | 70 | $2,862 | 29 | $16,535 |
| `900000649` | COLEGIO DEMO 649 | 199 | 162 (81%) | 13,615 | 203 | $2,672 | 6 | $9,550 |
| `900000121` | COLEGIO DEMO 121 | 146 | 118 (81%) | 9,718 | 73 | $2,878 | 1 (outlier $400k) | — |

**Recomendación: `COLEGIO DEMO 680` (NIT 900000680).** Razones:
- Tamaño manejable (88 estudiantes — no abruma la demo, suficiente diversidad)
- Mejor catálogo (130 productos distintos → mejor data para EXT-3 benchmark)
- Ticket promedio más alto ($3,866 vs ~$2,500-2,900) — padres comprometidos
- Ratio ventas:recargas = 5.6x (sano; significa que las recargas del sistema reflejan la realidad — US-04 va a funcionar)
- 70% de ventas tienen padre identificado (no perdemos demasiados estudiantes en EXT-1/EXT-2)

Alternativa: `COLEGIO DEMO 703` si Product Senior prefiere más volumen (194 estudiantes) a costa de menor diversidad de productos y engagement aparentemente más bajo.

---

## 6. Modelo de datos derivado (lo que las Lambdas asumen)

El PRD §05 lista tablas que no existen. Para no reescribir todo el agente, mapeamos así:

| Entidad PRD | Cómo la obtenemos |
|---|---|
| `students` | `SELECT DISTINCT usuario_identificacion AS id, nombre_estudiante AS name, nit_colegio AS school_id FROM hackaton_ventas` (potencialmente vía VIEW) |
| `transactions` | `hackaton_ventas` directo (renombrar columnas en queries) |
| `products` | `SELECT DISTINCT nombre_producto AS name FROM hackaton_ventas` (denormalizado, sin id estable) |
| `student_balance` | Computado: `SUM(recargas.valor) - SUM(ventas.cantidad * ventas.precio)` por `usuario_identificacion` |

### Tablas nuevas (todas con prefijo `bioalert_`)

Creadas por scripts en `data/fixtures/`. Permiso `CREATE` confirmado en `public`.

```sql
bioalert_parent_phone_map (
  identificacion_padre  text PRIMARY KEY,
  phone_e164            text NOT NULL UNIQUE
)

bioalert_cafeteria_admins (
  phone_e164  text PRIMARY KEY,
  nit_colegio text NOT NULL
)

bioalert_student_allergens (
  usuario_identificacion text,
  allergen_name          text,
  PRIMARY KEY (usuario_identificacion, allergen_name)
)

bioalert_product_allergens (
  nombre_producto text,
  allergen_name   text,
  PRIMARY KEY (nombre_producto, allergen_name)
)

bioalert_inventory (
  nombre_producto text,
  nit_colegio     text,
  current_stock   int,
  minimum_stock   int,
  PRIMARY KEY (nombre_producto, nit_colegio)
)

bioalert_product_nutrition (
  nombre_producto      text PRIMARY KEY, -- original (no canonical)
  canonical_name       text,             -- "dedito queso" normalizado
  calories_100g        numeric,
  sugar_g              numeric,
  fat_g                numeric,
  protein_g            numeric,
  sodium_mg            numeric,
  estimated_by         text DEFAULT 'claude-haiku-4-5-20251001',
  estimated_at         timestamptz DEFAULT now()
)
```

DynamoDB `bioalert_conversations` queda como está en el PRD (phone_e164, session_json, updated_at, TTL 1h).

---

## 7. Queries pre-escritas

Ver `analysis/queries/`:

- `01-schema-discovery.sql` — reproduce esta inspección
- `02-colegios-candidatos.sql` — ranking goldilocks (parametrizable por ventana de días)
- `03-mateos-candidatos.sql` — perfilamiento de candidatos dentro de un colegio elegido

---

## 8. TODOs y open questions

- [ ] Confirmar que el dataset se refresca durante el hackathon (max date hoy = 2026-05-29, ¿se mueve?). Si es estático: para el demo usar `MAX(fecha)` como "hoy", no `CURRENT_DATE`.
- [ ] Definir si el agente conversacional (US-01) usa la "fecha de hoy real" o "fecha de la última actividad" — afecta storytelling.
- [ ] Decidir si las VIEWs sintéticas (`bioalert_students`, etc.) aportan claridad o agregan latencia innecesaria. Default: queries directas contra `hackaton_*`.
- [ ] Detectar si hay alguna otra tabla del reto que se agregue después (¿`hackaton_inventario`? ¿`hackaton_productos`?). Re-correr `01-schema-discovery.sql` al inicio de cada sesión.
- [ ] Verificar encoding del cliente: `SHOW client_encoding` y considerar fijar `client_encoding=UTF8` en la connection string.
