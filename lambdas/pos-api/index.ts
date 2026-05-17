import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { query } from '../shared/db.js'
import { logger } from '../shared/logger.js'

function cors(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  }
}

const STUDENT_SQL = `
SELECT
  v.usuario_identificacion,
  MAX(v.nombre_estudiante) AS nombre_estudiante,
  MAX(v.colegio)           AS school,
  MAX(v.nit_colegio)       AS school_nit
FROM reto.ventas v
WHERE v.usuario_identificacion = $1
GROUP BY v.usuario_identificacion
`

const BALANCE_SQL = `
SELECT
  COALESCE((SELECT SUM(r.valor) FROM reto.recargas r WHERE r.usuario_identificacion = $1), 0)
  -
  COALESCE((SELECT SUM(v.importe) FROM reto.ventas v WHERE v.usuario_identificacion = $1), 0)
  AS balance
`

const FLAGS_SQL = `
SELECT
  r.category,
  r.type,
  r.cafeteria_message,
  r.expires_at,
  EXTRACT(DAY FROM (r.expires_at - now()))::int AS expires_in_days,
  (
    SELECT COALESCE(json_agg(json_build_object('name', cs.substitute_product, 'pitch', cs.pitch)), '[]'::json)
    FROM bioalert.category_substitutes cs
    WHERE cs.category_restricted = r.category
  ) AS substitutes
FROM bioalert.restrictions r
WHERE r.usuario_identificacion = $1
  AND r.active = true
  AND (r.expires_at IS NULL OR r.expires_at > now())
ORDER BY r.created_at DESC
`

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' }
  }
  const studentId = event.pathParameters?.studentId?.trim()
  if (!studentId) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'studentId required' }) }
  }
  try {
    const [studentRows, balanceRows, flagsRows] = await Promise.all([
      query<{ usuario_identificacion: string; nombre_estudiante: string | null; school: string | null; school_nit: string | null }>(STUDENT_SQL, [studentId]),
      query<{ balance: string | number }>(BALANCE_SQL, [studentId]),
      query<{
        category: string
        type: string
        cafeteria_message: string | null
        expires_at: string | null
        expires_in_days: number | null
        substitutes: Array<{ name: string; pitch: string }>
      }>(FLAGS_SQL, [studentId]),
    ])
    const student = studentRows[0]
    if (!student) {
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: 'student_not_found', student_id: studentId }),
      }
    }
    const payload = {
      student_id: student.usuario_identificacion,
      student_name: student.nombre_estudiante,
      school: student.school,
      school_nit: student.school_nit,
      balance: Math.round(Number(balanceRows[0]?.balance ?? 0)),
      flags: flagsRows.map(f => ({
        category: f.category,
        type: f.type,
        title: 'Sugerencia del padre',
        message: f.cafeteria_message ?? '',
        expires_in_days: f.expires_in_days,
        expires_at: f.expires_at,
        substitutes: f.substitutes ?? [],
      })),
    }
    return { statusCode: 200, headers: cors(), body: JSON.stringify(payload) }
  } catch (e: any) {
    logger.error('pos-api failed', { error: e.message, studentId })
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: 'internal_error', message: e.message }),
    }
  }
}
