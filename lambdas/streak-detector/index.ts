import type { ScheduledHandler } from 'aws-lambda'
import { query } from '../shared/db.js'
import { sendButtons, sendText } from '../shared/whatsapp.js'
import { logger } from '../shared/logger.js'

// Detecta rachas: para cada estudiante del piloto, identifica categorías
// que aparecen en 3+ días distintos durante los últimos 5 días hábiles.
// Si la racha no fue notificada antes, la inserta y dispara WhatsApp.
const DETECT_SQL = `
WITH dias_habiles_ventana AS (
  SELECT d FROM generate_series(
    ((now() AT TIME ZONE 'America/Bogota')::date) - INTERVAL '14 days',
    ((now() AT TIME ZONE 'America/Bogota')::date),
    INTERVAL '1 day'
  ) AS d
  WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
  ORDER BY d DESC
  LIMIT 5
),
ventas_categoria AS (
  SELECT
    v.usuario_identificacion,
    MAX(v.nombre_estudiante) AS nombre_estudiante,
    MAX(v.identificacion_padre) AS identificacion_padre,
    pn.category,
    COUNT(DISTINCT v.fecha) AS dias_con_compra,
    MAX(v.fecha) AS last_seen
  FROM reto.ventas v
  JOIN bioalert.product_nutrition pn ON pn.nombre_producto = v.nombre_producto
  WHERE v.nit_colegio = $1
    AND v.fecha IN (SELECT d FROM dias_habiles_ventana)
    AND pn.category IS NOT NULL
  GROUP BY v.usuario_identificacion, pn.category
  HAVING COUNT(DISTINCT v.fecha) >= 3
)
SELECT
  vc.usuario_identificacion,
  vc.nombre_estudiante,
  vc.category,
  vc.dias_con_compra,
  vc.last_seen,
  ppm.phone_e164
FROM ventas_categoria vc
JOIN bioalert.parent_phone_map ppm ON ppm.identificacion_padre = vc.identificacion_padre
WHERE NOT EXISTS (
  SELECT 1 FROM bioalert.streaks s
  WHERE s.usuario_identificacion = vc.usuario_identificacion
    AND s.category = vc.category
    AND s.last_seen_date = vc.last_seen
    AND s.notified_at IS NOT NULL
)
ORDER BY vc.dias_con_compra DESC
LIMIT 20
`

const INSERT_STREAK_SQL = `
INSERT INTO bioalert.streaks
  (usuario_identificacion, nombre_estudiante, category, days_in_streak, last_seen_date, notified_at)
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT (usuario_identificacion, category, last_seen_date) DO UPDATE
  SET notified_at = now(), days_in_streak = EXCLUDED.days_in_streak
RETURNING id
`

const NIT_PILOTO = process.env.NIT_PILOTO ?? '900000680'

const CATEGORY_LABEL: Record<string, string> = {
  bebida: 'bebidas azucaradas',
  dulce:  'dulces',
  snack:  'snacks ultraprocesados',
  comida: 'comidas pesadas',
  lacteo: 'lácteos azucarados',
}

interface DetectorRow {
  usuario_identificacion: string
  nombre_estudiante: string | null
  category: string
  dias_con_compra: number
  last_seen: string
  phone_e164: string
}

interface InvokeEvent {
  dryRun?: boolean
  onlyPhone?: string       // limita a un padre específico (e.g. demo)
  onlyCategory?: string    // limita a 1 categoría (e.g. 'dulce' para el caso Diana/Mateo)
  limit?: number           // limita la cantidad de mensajes (e.g. 1 mensaje para el demo)
}

export const handler: ScheduledHandler = async (event: any) => {
  const evt = (event ?? {}) as InvokeEvent
  const dryRun = !!evt.dryRun
  const onlyPhone = evt.onlyPhone
  const onlyCategory = evt.onlyCategory
  const maxHits = typeof evt.limit === 'number' && evt.limit > 0 ? evt.limit : undefined

  let rows = await query<DetectorRow>(DETECT_SQL, [NIT_PILOTO])

  if (onlyPhone) rows = rows.filter(r => r.phone_e164 === onlyPhone)
  if (onlyCategory) rows = rows.filter(r => r.category === onlyCategory)
  if (maxHits !== undefined) rows = rows.slice(0, maxHits)

  logger.info('streak detector', { hits: rows.length, dryRun, onlyPhone, onlyCategory, limit: maxHits })

  for (const r of rows) {
    try {
      if (dryRun) {
        // dryRun no debe tener efectos: NO insertamos la racha (eso marcaría
        // notified_at y bloquearía runs reales siguientes vía el NOT EXISTS).
        logger.info('dry run — skip insert + whatsapp', {
          phone: r.phone_e164, category: r.category, dias: r.dias_con_compra,
        })
        continue
      }

      await query(INSERT_STREAK_SQL, [
        r.usuario_identificacion,
        r.nombre_estudiante,
        r.category,
        r.dias_con_compra,
        r.last_seen,
      ])

      const nombre = r.nombre_estudiante ?? 'tu hijo'
      const catLabel = CATEGORY_LABEL[r.category] ?? r.category
      const dias = r.dias_con_compra

      const body =
        `🍎 *Patrón detectado*\n\n` +
        `*${nombre}* lleva *${dias} días* esta semana consumiendo *${catLabel}*.\n\n` +
        `¿Cómo lo manejamos?`

      const buttonId = `streak:${r.usuario_identificacion}:${r.category}`
      try {
        await sendButtons(r.phone_e164, body, [
          { id: `${buttonId}:alert_only`, title: '🔔 Solo alertar' },
          { id: `${buttonId}:restrict`,   title: '🚫 Restringir' },
          { id: `${buttonId}:substitutes`, title: '🌿 Alternativas' },
        ])
      } catch {
        // Fallback texto si Kapso rechaza los botones
        await sendText(r.phone_e164,
          body + `\n\nResponde:\n*alertar* · *restringir* · *alternativas*`)
      }
    } catch (e: any) {
      logger.error('streak processing failed', { row: r, error: e.message })
    }
    await new Promise(res => setTimeout(res, 250))
  }
}
