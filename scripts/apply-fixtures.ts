import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { rdsConfig } from './lib/rds-from-ssm.js'

function loadEnvFile(path: string) {
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

function phone(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k]?.trim()
    if (v) return v
  }
  throw new Error(
    `Falta teléfono E.164 en .env (${keys.join(' o ')}). ` +
      'Usá KAPSO_SANDBOX_NUMBER o DEMO_PHONE_* según caso-demo.md',
  )
}

async function runSql(client: pg.Client, file: string) {
  const sql = readFileSync(file, 'utf8')
  console.log(`→ ${file}`)
  await client.query(sql)
}

async function main() {
  loadEnvFile(resolve('.env'))

  const miguel = phone('DEMO_PHONE_MIGUEL', 'KAPSO_SANDBOX_NUMBER')
  const arcila = phone('DEMO_PHONE_ARCILA', 'KAPSO_SANDBOX_NUMBER')
  const maza = phone('DEMO_PHONE_MAZA', 'KAPSO_SANDBOX_NUMBER')

  const cfg = rdsConfig()
  const client = new pg.Client(cfg)
  await client.connect()

  console.log('→ parent_phone_map + cafeteria_admins')
  await client.query('TRUNCATE bioalert.parent_phone_map')

  const parents: Array<[string, string, string]> = [
    ['0090233965', miguel, 'Diana'],
    ['0090130841', arcila, 'Manuel Medina'],
    ['0090130797', maza, 'Kevin Ospina'],
  ]
  const uniquePhones = new Set(parents.map(([, p]) => p))
  if (uniquePhones.size < parents.length) {
    console.log(
      '   (un solo sandbox: solo Mateo/Diana en parent_phone_map; el resto cuando haya teléfonos distintos)',
    )
    await client.query(
      `INSERT INTO bioalert.parent_phone_map (identificacion_padre, phone_e164, nombre_padre)
       VALUES ($1, $2, $3)
       ON CONFLICT (identificacion_padre) DO UPDATE SET
         phone_e164 = EXCLUDED.phone_e164,
         nombre_padre = EXCLUDED.nombre_padre`,
      ['0090233965', miguel, 'Diana'],
    )
  } else {
    for (const [id, ph, name] of parents) {
      await client.query(
        `INSERT INTO bioalert.parent_phone_map (identificacion_padre, phone_e164, nombre_padre)
         VALUES ($1, $2, $3)
         ON CONFLICT (identificacion_padre) DO UPDATE SET
           phone_e164 = EXCLUDED.phone_e164,
           nombre_padre = EXCLUDED.nombre_padre`,
        [id, ph, name],
      )
    }
  }

  await client.query('TRUNCATE bioalert.cafeteria_admins')
  await client.query(
    `INSERT INTO bioalert.cafeteria_admins (phone_e164, nit_colegio, display_name)
     VALUES ($1, '900000680', 'Admin Cafetería DEMO 680')
     ON CONFLICT (phone_e164) DO UPDATE SET
       nit_colegio = EXCLUDED.nit_colegio,
       display_name = EXCLUDED.display_name`,
    [miguel],
  )

  const dir = resolve('data/fixtures')
  for (const name of readdirSync(dir).sort()) {
    if (!/^1[2-4]-.*\.sql$/.test(name)) continue
    await runSql(client, resolve(dir, name))
  }

  const counts = await client.query(`
    SELECT 'parent_phone_map' AS t, COUNT(*)::text FROM bioalert.parent_phone_map
    UNION ALL SELECT 'cafeteria_admins', COUNT(*)::text FROM bioalert.cafeteria_admins
    UNION ALL SELECT 'student_allergens', COUNT(*)::text FROM bioalert.student_allergens
    UNION ALL SELECT 'product_allergens', COUNT(*)::text FROM bioalert.product_allergens
    UNION ALL SELECT 'inventory', COUNT(*)::text FROM bioalert.inventory
    UNION ALL SELECT 'product_nutrition', COUNT(*)::text FROM bioalert.product_nutrition
  `)
  console.log('→ Conteos:')
  for (const row of counts.rows) {
    console.log(`   ${row.t}: ${row.count}`)
  }

  await client.end()
  console.log('✅ Fixtures aplicados.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
