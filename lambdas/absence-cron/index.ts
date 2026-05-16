import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'

const SQL = `
-- Estudiantes activos del colegio piloto que NO compraron "hoy" (= max fecha del dataset)
WITH today AS (SELECT MAX(fecha) AS d FROM reto.ventas)
SELECT
  s.usuario_identificacion,
  s.nombre_estudiante,
  ppm.phone_e164,
  ppm.nombre_padre
FROM (
  SELECT DISTINCT v.usuario_identificacion, v.nombre_estudiante, v.identificacion_padre
  FROM reto.ventas v, today
  WHERE v.nit_colegio = $1
    AND v.fecha >= today.d - INTERVAL '30 days'
) s
JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = s.identificacion_padre
WHERE NOT EXISTS (
  SELECT 1 FROM reto.ventas v2, today
  WHERE v2.usuario_identificacion = s.usuario_identificacion
    AND v2.fecha = today.d
);
`

const NIT_PILOTO = process.env.NIT_PILOTO ?? '900000680'

export const handler: ScheduledHandler = async () => {
  const hits = await query<{
    usuario_identificacion: string
    nombre_estudiante: string | null
    phone_e164: string
    nombre_padre: string | null
  }>(SQL, [NIT_PILOTO])

  logger.info('absence check', { hits: hits.length })

  for (const h of hits) {
    const body =
      `ℹ️ Notificación de ausencia de consumo\n\n` +
      `Aún no se registran compras hoy para *${h.nombre_estudiante}*.\n\n` +
      `Te aviso esto porque típicamente compra antes de las 11 AM según su patrón habitual.`
    try {
      await sendText(h.phone_e164, body)
    } catch (e: any) {
      logger.error('send failed', { usuario_identificacion: h.usuario_identificacion, error: e.message })
    }
    await new Promise(r => setTimeout(r, 250))  // throttle 4/s
  }
}
