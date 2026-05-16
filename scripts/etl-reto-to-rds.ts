import { pipeline } from 'node:stream/promises'
import pg from 'pg'
import { from as copyFrom, to as copyTo } from 'pg-copy-streams'
import { rdsConfig, RETO_SOURCE } from './lib/rds-from-ssm.js'

async function pipeCopy(
  src: pg.Client,
  dst: pg.Client,
  label: string,
  selectSql: string,
  copyIntoSql: string,
): Promise<void> {
  console.log(`→ ETL ${label}...`)
  const started = Date.now()
  const srcStream = src.query(
    copyTo(`COPY (${selectSql}) TO STDOUT WITH (FORMAT csv)`),
  )
  const dstStream = dst.query(copyFrom(copyIntoSql))
  await pipeline(srcStream, dstStream)
  const sec = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`   ${label} listo en ${sec}s`)
}

async function main() {
  const dstCfg = rdsConfig()
  console.log(`→ RDS destino: ${dstCfg.host}`)

  const src = new pg.Client(RETO_SOURCE)
  const dst = new pg.Client(dstCfg)
  await src.connect()
  await dst.connect()

  console.log('→ TRUNCATE tablas destino...')
  await dst.query(
    'TRUNCATE reto.ventas RESTART IDENTITY; TRUNCATE reto.recargas RESTART IDENTITY;',
  )

  await pipeCopy(
    src,
    dst,
    'hackaton_ventas → reto.ventas (~4.26M filas)',
    `SELECT
      usuario_identificacion,
      nombre_estudiante,
      fecha::date,
      cantidad::int,
      LEAST(GREATEST(NULLIF(precio, '')::numeric, 0), 9999999999.99) AS precio,
      nombre_producto,
      NULLIF(identificacion_padre, '') AS identificacion_padre,
      NULLIF(nombre_padre, '') AS nombre_padre,
      colegio,
      nit_colegio
    FROM hackaton_ventas
    WHERE precio ~ '^[0-9]+(\\.[0-9]+)?$'
      AND NULLIF(precio, '')::numeric < 10000000000`,
    `COPY reto.ventas (
      usuario_identificacion,
      nombre_estudiante,
      fecha,
      cantidad,
      precio,
      nombre_producto,
      identificacion_padre,
      nombre_padre,
      colegio,
      nit_colegio
    ) FROM STDIN WITH (FORMAT csv)`,
  )

  await pipeCopy(
    src,
    dst,
    'hackaton_recargas → reto.recargas (~305k filas)',
    `SELECT
      usuario_identificacion,
      nombre_estudiante,
      fecha,
      valor,
      NULLIF(identificacion_padre, '') AS identificacion_padre,
      NULLIF(nombre_padre, '') AS nombre_padre,
      colegio,
      nit_colegio
    FROM hackaton_recargas`,
    `COPY reto.recargas (
      usuario_identificacion,
      nombre_estudiante,
      fecha,
      valor,
      identificacion_padre,
      nombre_padre,
      colegio,
      nit_colegio
    ) FROM STDIN WITH (FORMAT csv)`,
  )

  const counts = await dst.query<{ tabla: string; filas: string }>(`
    SELECT 'reto.ventas' AS tabla, COUNT(*)::text AS filas FROM reto.ventas
    UNION ALL
    SELECT 'reto.recargas', COUNT(*)::text FROM reto.recargas
  `)
  console.log('→ Verificación de conteos:')
  for (const row of counts.rows) {
    console.log(`   ${row.tabla}: ${row.filas}`)
  }

  await src.end()
  await dst.end()
  console.log('✅ ETL completo.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
