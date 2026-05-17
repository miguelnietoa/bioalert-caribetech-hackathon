import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'

// Detecta estudiantes del colegio piloto cuyo saldo está por agotarse
// según su patrón de gasto de los últimos 7 días. Solo un mensaje por
// padre (el estudiante más activo, mismo criterio de [[multi-hijo]]).
const SQL = `
WITH estudiantes_piloto AS (
  SELECT
    v.usuario_identificacion,
    v.nombre_estudiante,
    v.identificacion_padre,
    ROW_NUMBER() OVER (
      PARTITION BY v.identificacion_padre
      ORDER BY COUNT(*) DESC, MAX(v.fecha) DESC, v.usuario_identificacion ASC
    ) AS rn_padre
  FROM reto.ventas v
  WHERE v.nit_colegio = $1
    AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '30 days'
  GROUP BY v.usuario_identificacion, v.nombre_estudiante, v.identificacion_padre
),
con_padre AS (
  SELECT ep.*, ppm.phone_e164
  FROM estudiantes_piloto ep
  JOIN bioalert.parent_phone_map ppm
    ON ppm.identificacion_padre = ep.identificacion_padre
  WHERE ep.rn_padre = 1
),
balances AS (
  SELECT
    cp.usuario_identificacion,
    cp.nombre_estudiante,
    cp.phone_e164,
    (
      COALESCE((SELECT SUM(r.valor) FROM reto.recargas r WHERE r.usuario_identificacion = cp.usuario_identificacion), 0)
      -
      COALESCE((SELECT SUM(v.importe) FROM reto.ventas v WHERE v.usuario_identificacion = cp.usuario_identificacion), 0)
    )::numeric AS balance_actual,
    (
      SELECT ROUND(SUM(v.importe) / NULLIF(COUNT(DISTINCT v.fecha), 0))::int
      FROM reto.ventas v
      WHERE v.usuario_identificacion = cp.usuario_identificacion
        AND v.fecha >= ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '7 days'
    ) AS gasto_diario_avg_7d
  FROM con_padre cp
)
SELECT
  usuario_identificacion,
  nombre_estudiante,
  phone_e164,
  ROUND(balance_actual)::int AS balance_actual,
  gasto_diario_avg_7d,
  CASE
    WHEN balance_actual <= 0 THEN 0
    ELSE ROUND(balance_actual / gasto_diario_avg_7d)::int
  END AS dias_restantes
FROM balances
WHERE gasto_diario_avg_7d IS NOT NULL
  AND gasto_diario_avg_7d > 0
  AND (
    balance_actual <= 0
    OR balance_actual / gasto_diario_avg_7d <= $2
  )
ORDER BY
  CASE WHEN balance_actual <= 0 THEN -1 ELSE balance_actual / gasto_diario_avg_7d END ASC;
`

const NIT_PILOTO = process.env.NIT_PILOTO ?? '900000680'
const UMBRAL_DIAS = Number(process.env.UMBRAL_DIAS ?? '2')

const fmtCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

export const handler: ScheduledHandler = async () => {
  const hits = await query<{
    usuario_identificacion: string
    nombre_estudiante: string | null
    phone_e164: string
    balance_actual: number
    gasto_diario_avg_7d: number
    dias_restantes: number
  }>(SQL, [NIT_PILOTO, UMBRAL_DIAS])

  logger.info('low balance check', { hits: hits.length, umbral_dias: UMBRAL_DIAS })

  for (const h of hits) {
    const nombre = h.nombre_estudiante ?? 'tu hijo'
    const dias = Number(h.dias_restantes)
    const saldo = Number(h.balance_actual)
    const gastoDia = Number(h.gasto_diario_avg_7d)

    const sobregiro = saldo < 0
    const saldoTxt = sobregiro
      ? `−${fmtCOP.format(Math.abs(saldo))} (sobregirado)`
      : fmtCOP.format(saldo)
    const cuandoSeAcaba = sobregiro
      ? 'ya está consumiendo por encima del saldo recargado'
      : dias <= 0
        ? 'el saldo ya está prácticamente agotado'
        : `el saldo le alcanza para ${dias} ${plural(dias, 'día', 'días')} más`

    const body =
      `💳 Saldo bajo en la cafetería\n\n` +
      `*${nombre}* ${cuandoSeAcaba}.\n\n` +
      `• Saldo actual: *${saldoTxt}*\n` +
      `• Gasto promedio: ${fmtCOP.format(gastoDia)}/día\n\n` +
      `Te aviso esto porque su patrón de los últimos 7 días así lo proyecta.\n\n` +
      `¿Quieres ver 3 opciones de recarga? Responde *"opciones"* y te las paso.`

    try {
      await sendText(h.phone_e164, body)
    } catch (e: any) {
      logger.error('send failed', {
        usuario_identificacion: h.usuario_identificacion,
        error: e.message,
      })
    }
    await new Promise(r => setTimeout(r, 250))
  }
}
