import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { rdsConfig } from './lib/rds-from-ssm.js'

async function main() {
  const cfg = rdsConfig()
  console.log(`→ Conectando a ${cfg.host}...`)
  const client = new pg.Client(cfg)
  await client.connect()

  const raw = readFileSync(resolve('data/fixtures/00-schema.sql'), 'utf8')
  const sql = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('\\'))
    .join('\n')
  await client.query(sql)
  await client.end()
  console.log('✅ Schema aplicado.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
