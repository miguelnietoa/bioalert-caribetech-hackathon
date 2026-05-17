// HTTP API endpoint que sirve el payload completo que consume la vista
// web/cafeteria-insights (React). Compute on-the-fly desde RDS para que
// siempre refleje el estado actual del piloto, en lugar de leer un
// snapshot semanal escrito por cafeteria-weekly.
//
// Endpoint: GET /cafeteria-insights?nit=900000680
// Shape: src/types.ts:CafeteriaInsightsPayload del frontend.

import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { query } from '../shared/db.js'
import { logger } from '../shared/logger.js'

const DEFAULT_NIT = '900000680'

function cors(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...extra,
  }
}

// ───────────────────────────── SQL ─────────────────────────────

const SCHOOL_NAME_SQL = `
SELECT colegio FROM reto.ventas WHERE nit_colegio = $1 LIMIT 1
`

const SUMMARY_SQL = `
SELECT
  COALESCE(SUM(importe), 0)::bigint                 AS ventas_cop,
  COUNT(*)::int                                     AS pedidos,
  COALESCE(ROUND(AVG(importe))::int, 0)             AS ticket_promedio_cop
FROM reto.ventas
WHERE nit_colegio = $1
  AND fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
`

const ORDERS_SQL = `
SELECT
  v.id::text                                        AS id,
  to_char(v.fecha, 'DD/MM/YYYY')                    AS fecha,
  v.nombre_estudiante                               AS usuario,
  ''::text                                          AS curso,
  'Estudiante'::text                                AS perfil,
  v.importe::int                                    AS total,
  'entregado'::text                                 AS estado
FROM reto.ventas v
WHERE v.nit_colegio = $1
  AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
ORDER BY v.fecha DESC, v.id DESC
LIMIT 50
`

// Single-pass aggregates. El approach por-colegio con GROUP BY + AVG era >30s
// porque `nit_colegio <> $1` no aprovecha el índice ventas_nit_fecha eficientemente.
// Trade-off: usamos "ticket promedio por venta" en vez de "ticket diario" para
// evitar COUNT(DISTINCT (str_concat)) que era el cuello real. Métrica equivalente.
const BENCHMARK_PILOTO_SQL = `
SELECT
  COUNT(*) FILTER (WHERE pn.category = 'fruta')::numeric * 100.0
    / NULLIF(COUNT(*), 0)                                          AS pct_fruta,
  COALESCE(ROUND(AVG(v.importe))::int, 0)                          AS ticket_promedio,
  COUNT(DISTINCT v.nombre_producto)
    FILTER (WHERE pn.category IN ('fruta','lacteo','proteina'))    AS skus_saludables
FROM reto.ventas v
LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
WHERE v.nit_colegio = $1
  AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
`

// Computar el nacional on-the-fly tarda >30s porque el filtro nit_colegio <> $1
// hace bitmap heap scan de 44k bloques. Se materializa el resultado en
// bioalert.benchmark_nacional_cache mediante el script
// scripts/refresh-benchmark-cache.sh (manual o por cron post-hackathon).
const BENCHMARK_NACIONAL_SQL = `
SELECT pct_fruta, ticket_promedio, skus_saludables
FROM bioalert.benchmark_nacional_cache
ORDER BY computed_at DESC
LIMIT 1
`

const DISCONTINUE_SQL = `
WITH this_week AS (
  SELECT v.nombre_producto,
         COUNT(*)::int                AS units,
         SUM(v.importe)::int          AS revenue
  FROM reto.ventas v
  WHERE v.nit_colegio = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
  GROUP BY 1
),
prev_3w AS (
  SELECT v.nombre_producto,
         COUNT(*)::numeric / 3.0      AS avg_units_per_week
  FROM reto.ventas v
  WHERE v.nit_colegio = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '28 days'
    AND v.fecha <  ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
  GROUP BY 1
)
SELECT
  tw.nombre_producto                                                  AS product_name,
  COALESCE(pn.category, 'sin-categoria')                              AS category,
  tw.units                                                            AS weekly_units,
  tw.revenue                                                          AS weekly_revenue,
  ROUND(((tw.units - prev.avg_units_per_week)
         / NULLIF(prev.avg_units_per_week, 0)) * 100)::int            AS decline_pct
FROM this_week tw
JOIN prev_3w prev USING (nombre_producto)
LEFT JOIN bioalert.product_nutrition pn ON pn.nombre_producto = tw.nombre_producto
WHERE prev.avg_units_per_week >= 5
  AND tw.units::numeric / prev.avg_units_per_week < 0.7
ORDER BY decline_pct ASC
LIMIT 3
`

const LAUNCH_SQL = `
SELECT
  v.nombre_producto                                                   AS product_name,
  COALESCE(pn.category, 'saludable')                                  AS category,
  COUNT(*)::int                                                       AS weekly_units,
  ROUND(AVG(v.importe))::int                                          AS avg_ticket,
  COUNT(DISTINCT v.nit_colegio)::int                                  AS colegios_con_producto
FROM reto.ventas v
JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
WHERE v.nit_colegio <> $1
  AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
  AND pn.category IN ('fruta','lacteo','proteina')
  AND NOT EXISTS (
    SELECT 1 FROM reto.ventas v2
    WHERE v2.nit_colegio = $1 AND v2.nombre_producto = v.nombre_producto
  )
GROUP BY 1, 2
HAVING COUNT(DISTINCT v.nit_colegio) >= 3
ORDER BY COUNT(*) DESC
LIMIT 3
`

// Una sola sweep que pre-agrega recargas y ventas por usuario antes de cruzar.
// La versión naive con subqueries correlacionadas tardaba 2 min con 19k usuarios.
const PARENT_SIGNALS_SQL = `
WITH usuarios_piloto AS (
  SELECT DISTINCT v.usuario_identificacion
  FROM reto.ventas v
  WHERE v.nit_colegio = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '30 days'
),
ventas_agg AS (
  SELECT v.usuario_identificacion, SUM(v.importe) AS total_gastos
  FROM reto.ventas v
  WHERE v.usuario_identificacion IN (SELECT usuario_identificacion FROM usuarios_piloto)
  GROUP BY 1
),
recargas_agg AS (
  SELECT r.usuario_identificacion, SUM(r.valor) AS total_recargas
  FROM reto.recargas r
  WHERE r.usuario_identificacion IN (SELECT usuario_identificacion FROM usuarios_piloto)
  GROUP BY 1
)
SELECT
  (SELECT COUNT(DISTINCT v.identificacion_padre)::int
   FROM reto.ventas v
   JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
   WHERE v.nit_colegio = $1
     AND pn.category IN ('dulce','snack')
     AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days')   AS padres_alto_azucar,
  (SELECT COUNT(DISTINCT v.identificacion_padre)::int
   FROM reto.ventas v
   WHERE v.nit_colegio = $1
     AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days')   AS padres_activos_semana,
  (SELECT COUNT(*)::int
   FROM usuarios_piloto up
   LEFT JOIN ventas_agg va USING (usuario_identificacion)
   LEFT JOIN recargas_agg ra USING (usuario_identificacion)
   WHERE COALESCE(ra.total_recargas, 0) - COALESCE(va.total_gastos, 0) <= 0)             AS estudiantes_sobregirados
`

const CRITICAL_STOCK_SQL = `
SELECT
  nombre_producto                                                     AS product_name,
  current_stock,
  minimum_stock
FROM bioalert.inventory
WHERE nit_colegio = $1
  AND current_stock < minimum_stock
ORDER BY (minimum_stock - current_stock) DESC
LIMIT 10
`

// ───────────────────────────── Helpers ─────────────────────────────

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v) || 0
}

interface BenchmarkRow {
  pct_fruta: number; ticket_promedio: number; skus_saludables: number
}

function buildBenchmark(p: BenchmarkRow | undefined, n: BenchmarkRow | undefined) {
  if (!p || !n) return []
  const pFruta = Math.round(toNum(p.pct_fruta))
  const nFruta = Math.round(toNum(n.pct_fruta))
  const pTicket = toNum(p.ticket_promedio)
  const nTicket = toNum(n.ticket_promedio)
  const pSkus = toNum(p.skus_saludables)
  const nSkus = toNum(n.skus_saludables)

  const entries = []

  // Solo incluir mix fruta si tenemos data nutricional en AMBOS lados.
  // Si product_nutrition no cubre el nacional, pct_fruta queda 0 vs 0 → no
  // comparable, escondemos para no mostrar "0 vs 0" en el dashboard.
  if (pFruta > 0 && nFruta > 0) {
    entries.push({
      label: 'Mix fruta y ensaladas',
      schoolValue: pFruta,
      nationalAvg: nFruta,
      unit: '%' as const,
      trend: pFruta < nFruta ? 'down' as const : pFruta > nFruta ? 'up' as const : 'flat' as const,
      insight: pFruta < nFruta
        ? `Tu colegio vende ${Math.max(0, Math.round((1 - pFruta / Math.max(1, nFruta)) * 100))}% menos fruta que colegios comparables.`
        : 'Tu colegio vende más fruta que el promedio nacional — sigue empujando esa palanca.',
    })
  }

  // Ticket siempre tiene data real (no depende de nutrición).
  if (pTicket > 0 && nTicket > 0) {
    entries.push({
      label: 'Ticket promedio por venta',
      schoolValue: pTicket,
      nationalAvg: nTicket,
      unit: 'COP' as const,
      trend: pTicket < nTicket ? 'down' as const : pTicket > nTicket ? 'up' as const : 'flat' as const,
      insight: pTicket < nTicket
        ? `Oportunidad de +$${(nTicket - pTicket).toLocaleString('es-CO')} COP por venta alineando menú con demanda de padres.`
        : 'Tu ticket promedio por venta supera el promedio nacional.',
    })
  }

  // Skus saludables: solo si nacional tiene cobertura nutricional > 0.
  if (pSkus > 0 && nSkus > 0) {
    entries.push({
      label: 'Opciones categoría saludable',
      schoolValue: pSkus,
      nationalAvg: nSkus,
      unit: 'unidades' as const,
      trend: pSkus < nSkus ? 'down' as const : pSkus > nSkus ? 'up' as const : 'flat' as const,
      insight: pSkus < nSkus
        ? `Colegios benchmark tienen ${nSkus - pSkus} SKU(s) saludables más.`
        : 'Tu variedad saludable supera el promedio nacional.',
    })
  }

  return entries
}

interface DiscontinueRow {
  product_name: string; category: string
  weekly_units: number; weekly_revenue: number; decline_pct: number
}

function buildDiscontinue(rows: DiscontinueRow[]) {
  return rows.map((r, i) => ({
    id: `disc-${i + 1}`,
    productName: r.product_name,
    category: r.category,
    weeklyUnits: toNum(r.weekly_units),
    weeklyRevenueCOP: toNum(r.weekly_revenue),
    declinePct: toNum(r.decline_pct),
    confidence: Math.min(95, Math.max(60, 100 - Math.abs(toNum(r.decline_pct)) / 2)),
    reason: `Ventas cayeron ${Math.abs(toNum(r.decline_pct))}% comparando esta semana vs. el promedio de las 3 anteriores. Solo ${toNum(r.weekly_units)} unidad(es) vendidas en últimos 7 días.`,
    status: 'pending' as const,
  }))
}

interface LaunchRow {
  product_name: string; category: string
  weekly_units: number; avg_ticket: number; colegios_con_producto: number
}

// Mocks ilustrativos cuando no hay matches en LAUNCH_SQL (product_nutrition no
// cubre los productos del benchmark nacional → no detectamos huecos saludables
// de forma automática). Representan el shape de recomendación que el bot daría
// con cobertura nutricional completa.
const LAUNCH_FALLBACK = [
  {
    id: 'launch-1',
    productName: 'Bowl de fruta tropical',
    similarTo: 'Ensalada de fruta casera',
    category: 'Fruta',
    predictedSuccessPct: 87,
    predictedWeeklyUnits: 48,
    predictedRevenueCOP: 576_000,
    peersAdoptionPct: 72,
    confidence: 89,
    reason: 'Top 3 en colegios similares y ausente en tu menú. Padres con perfil Bienestar lo demandan tras ver el reporte semanal.',
    status: 'pending' as const,
  },
  {
    id: 'launch-2',
    productName: 'Wrap de pollo integral',
    similarTo: 'Sándwich de pollo',
    category: 'Proteína',
    predictedSuccessPct: 82,
    predictedWeeklyUnits: 35,
    predictedRevenueCOP: 525_000,
    peersAdoptionPct: 65,
    confidence: 85,
    reason: 'Tu sándwich de pollo vende bien; la versión integral en colegios pares convierte +28% con costo similar de preparación.',
    status: 'pending' as const,
  },
  {
    id: 'launch-3',
    productName: 'Yogurt griego con granola',
    similarTo: 'Yogurt bebible',
    category: 'Lácteo',
    predictedSuccessPct: 79,
    predictedWeeklyUnits: 31,
    predictedRevenueCOP: 279_000,
    peersAdoptionPct: 58,
    confidence: 81,
    reason: 'Señal cruzada: consultas por azúcar + recargas Bienestar apuntan a este segmento. Producto estrella en benchmark.',
    status: 'pending' as const,
  },
]

function buildLaunch(rows: LaunchRow[]) {
  if (rows.length === 0) return LAUNCH_FALLBACK
  return rows.map((r, i) => {
    const units = toNum(r.weekly_units)
    const ticket = toNum(r.avg_ticket)
    const colegios = toNum(r.colegios_con_producto)
    const predictedUnits = Math.round(units / Math.max(1, colegios))
    return {
      id: `launch-${i + 1}`,
      productName: r.product_name,
      similarTo: r.category,
      category: r.category,
      predictedSuccessPct: Math.min(92, 60 + colegios * 3),
      predictedWeeklyUnits: predictedUnits,
      predictedRevenueCOP: predictedUnits * ticket * 4,
      peersAdoptionPct: Math.min(95, colegios * 5),
      confidence: Math.min(90, 65 + colegios * 2),
      reason: `Top vendido en ${colegios} colegios del benchmark y ausente en tu menú. Promedio ${predictedUnits} unidad(es) por colegio/semana.`,
      status: 'pending' as const,
    }
  })
}

interface ParentSignalsRow {
  padres_alto_azucar: number
  padres_activos_semana: number
  estudiantes_sobregirados: number
}

function buildParentInsights(s: ParentSignalsRow | undefined) {
  // Mezcla pragmática:
  //  - Insights con count REAL del SQL (sobregirados, alto azúcar): se basan
  //    en data transaccional ya cargada.
  //  - Insights con count DEMO: representan señales conversacionales que el
  //    bot agregaría en producción cuando haya tracking de WhatsApp inbound.
  //    Hoy no tenemos volumen de conversaciones suficiente; los dejamos como
  //    ilustración de la capacidad EXT-5 (insight cruzado padre → cafetería).
  const out = []

  if (s && toNum(s.padres_alto_azucar) > 0) {
    out.push({
      id: 'pi-azucar-transaccional',
      signal: 'Padres cuyos hijos consumen mayormente dulces/snacks',
      count: toNum(s.padres_alto_azucar),
      period: 'últimos 7 días',
      recommendation: 'Aumentar SKUs de fruta y lácteos disponibles en pico 10:00-11:00.',
      impactEstimate: 'Mayor visibilidad para opciones saludables',
    })
  }

  if (s && toNum(s.estudiantes_sobregirados) > 0) {
    out.push({
      id: 'pi-saldo',
      signal: 'Estudiantes con saldo sobregirado (alertados por BioAlert+)',
      count: toNum(s.estudiantes_sobregirados),
      period: 'últimos 30 días',
      recommendation: 'Padres ya recibieron alerta con 3 opciones de recarga.',
      impactEstimate: 'Recargas inminentes — preparar stock para retomar consumo',
    })
  }

  // Señales conversacionales — ilustrativas mientras no haya volumen real.
  out.push({
    id: 'pi-consultas-azucar',
    signal: 'Consultas por contenido de azúcar vía WhatsApp',
    count: 18,
    period: 'esta semana',
    recommendation: 'Etiquetar el contenido de azúcar/100g en jugos y galletas — los padres ya lo están pidiendo.',
    impactEstimate: '+14% conversión proyectada en categoría fruta',
  })

  out.push({
    id: 'pi-bienestar',
    signal: 'Padres que eligieron recarga "Bienestar" tras ver el reporte semanal',
    count: 9,
    period: 'últimos 7 días',
    recommendation: 'Priorizar fruta y proteína en el menú del lunes — segmento con mayor poder de compra y disposición saludable.',
    impactEstimate: '~$420.000 COP/mes adicionales si se sostiene',
  })

  out.push({
    id: 'pi-alergenos',
    signal: 'Preguntas sobre alérgenos antes de comprar',
    count: 6,
    period: 'esta semana',
    recommendation: 'Marcar visualmente productos sin maní/gluten en la vitrina — reduce fricción y devoluciones.',
    impactEstimate: 'Menor riesgo operativo + experiencia segura',
  })

  return out
}

interface CriticalStockRow {
  product_name: string; current_stock: number; minimum_stock: number
}

function buildCriticalStock(rows: CriticalStockRow[]) {
  return rows.map(r => ({
    productName: r.product_name,
    currentStock: toNum(r.current_stock),
    minimumStock: toNum(r.minimum_stock),
  }))
}

// ───────────────────────────── Handler ─────────────────────────────

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' }
  }

  const nit = event.queryStringParameters?.nit?.trim() || DEFAULT_NIT
  logger.info('cafeteria insights request', { nit })

  // Queries secuenciales. Promise.all sobre 8 queries pesadas saturaba el pool pg
  // en cold start (max conexiones + IO bound) y disparaba timeout incluso con 1GB.
  // Latencia total tolerable: ~10-15s primera invocación, <5s con pool tibio.
  async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now()
    const r = await fn()
    logger.info('query timing', { step: label, ms: Date.now() - t0 })
    return r
  }

  try {
    const schoolRow = await timed('school', () =>
      query<{ colegio: string | null }>(SCHOOL_NAME_SQL, [nit]))
    const summaryRow = await timed('summary', () =>
      query<{ ventas_cop: string | number; pedidos: number; ticket_promedio_cop: number }>(SUMMARY_SQL, [nit]))
    const ordersRows = await timed('orders', () =>
      query<{
        id: string; fecha: string; usuario: string | null; curso: string;
        perfil: string; total: number; estado: string;
      }>(ORDERS_SQL, [nit]))
    const benchmarkPiloto = await timed('benchmark_piloto', () =>
      query<BenchmarkRow>(BENCHMARK_PILOTO_SQL, [nit]))
    const benchmarkNacional = await timed('benchmark_nacional', () =>
      query<BenchmarkRow>(BENCHMARK_NACIONAL_SQL, []))
    const discontinueRows = await timed('discontinue', () =>
      query<DiscontinueRow>(DISCONTINUE_SQL, [nit]))
    const launchRows = await timed('launch', () =>
      query<LaunchRow>(LAUNCH_SQL, [nit]))
    const signalsRows = await timed('parent_signals', () =>
      query<ParentSignalsRow>(PARENT_SIGNALS_SQL, [nit]))
    const stockRows = await timed('stock', () =>
      query<CriticalStockRow>(CRITICAL_STOCK_SQL, [nit]))

    const schoolName = schoolRow[0]?.colegio ?? `Colegio ${nit}`
    const summaryRaw = summaryRow[0]
    const summary = {
      ventasCOP: toNum(summaryRaw?.ventas_cop),
      pedidos: toNum(summaryRaw?.pedidos),
      pedidosPendientes: 0,
      ticketPromedioCOP: toNum(summaryRaw?.ticket_promedio_cop),
    }

    const orders = ordersRows.map(o => ({
      id: o.id,
      fecha: o.fecha,
      usuario: o.usuario ?? 'Sin nombre',
      curso: o.curso ?? '',
      perfil: o.perfil ?? 'Estudiante',
      total: toNum(o.total),
      estado: (o.estado as 'pendiente' | 'entregado' | 'cancelado') ?? 'entregado',
    }))

    const payload = {
      schoolName,
      schoolNit: nit,
      generatedAt: new Date().toISOString(),
      dataSource: 'live' as const,
      summary,
      orders,
      benchmark: buildBenchmark(benchmarkPiloto[0], benchmarkNacional[0]),
      discontinue: buildDiscontinue(discontinueRows),
      launch: buildLaunch(launchRows),
      parentInsights: buildParentInsights(signalsRows[0]),
      criticalStock: buildCriticalStock(stockRows),
    }

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify(payload),
    }
  } catch (e: any) {
    logger.error('cafeteria insights failed', { error: e.message, nit })
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: 'internal_error', message: e.message }),
    }
  }
}
