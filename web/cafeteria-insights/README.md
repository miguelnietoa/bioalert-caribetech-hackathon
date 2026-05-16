# web/cafeteria-insights/

Vista del admin de cafetería — **EXT-3 + EXT-5**. Replica el layout de órdenes de Biofood (referencia visual) e incorpora un panel de **insights IA interactivos**:

- Benchmark vs. promedio nacional (mix saludable, ticket, SKUs)
- Productos sugeridos para **descontinuar** (con explicabilidad EXT-4)
- Productos similares para **agregar al menú** con % de éxito previsto
- Señales cruzadas padre↔cafetería (EXT-5)
- Stock crítico (US-05)

## Stack

React 19 + Vite 6 + TypeScript + Tailwind CSS 4. Sin login (sesión Biofood asumida).

## Desarrollo

```bash
cd web/cafeteria-insights
cp .env.example .env.local
npm install
npm run dev
```

Abre http://localhost:5174

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_BIOALERT_API_URL` | Base URL API Gateway. El cliente hace `GET {url}/cafeteria-insights?nit=...` |
| `VITE_USE_MOCK` | `true` fuerza datos demo aunque haya API |
| `VITE_SCHOOL_NIT` | NIT del colegio piloto |
| `VITE_SCHOOL_NAME` | Nombre mostrado en sidebar |

Sin `VITE_BIOALERT_API_URL` (o si la petición falla) se usa **mock** alineado con el caso demo Diana/Mateo y las extensiones del plan.

## Build estático (S3 + CloudFront)

```bash
npm run build
# Artefactos en dist/
```

## Contrato API esperado

`GET /cafeteria-insights?nit={nit}` → JSON con la forma de `src/types.ts` (`CafeteriaInsightsPayload`). Lo generará la Lambda `cafeteria-weekly` cuando esté desplegada.

## Demo

1. Panel IA arriba de filtros de órdenes — pestañas Agregar / Descontinuar / Señales padres.
2. Botones **Agregar a pedido proveedor**, **Descontinuar**, **Mantener** — acciones locales + log estructurado (listo para conectar al backend).
3. Badge amarillo indica mock; verde indica datos en vivo del bot.
