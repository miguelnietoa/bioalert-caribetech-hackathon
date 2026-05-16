import pg from 'pg'
import { getSecret } from './ssm.js'

let pool: pg.Pool | null = null

export async function getDbPool(): Promise<pg.Pool> {
  if (pool) return pool
  const host = await getSecret('db/host')
  const port = await getSecret('db/port')
  const password = await getSecret('db/password')
  pool = new pg.Pool({
    host,
    port: parseInt(port, 10),
    database: 'bioalert',
    user: 'bioalert_app',
    password,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
  return pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const p = await getDbPool()
  const { rows } = await p.query<T>(sql, params)
  return rows
}
