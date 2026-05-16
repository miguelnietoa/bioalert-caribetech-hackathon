import { execSync } from 'node:child_process'

const STAGE = process.env.STAGE ?? 'hackathon'
const PROFILE = process.env.AWS_PROFILE ?? 'biofood-hackathon'
const REGION = process.env.AWS_REGION ?? 'us-east-1'

export function ssm(name: string): string {
  return execSync(
    `aws ssm get-parameter --name /bioalert/${STAGE}/${name} --with-decryption ` +
      `--query Parameter.Value --output text --profile ${PROFILE} --region ${REGION}`,
    { encoding: 'utf8' },
  ).trim()
}

export function rdsConfig() {
  return {
    host: ssm('db/host'),
    port: parseInt(ssm('db/port'), 10),
    database: 'bioalert',
    user: 'bioalert_app',
    password: ssm('db/password'),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
  }
}

export const RETO_SOURCE = {
  host: process.env.RETO_PGHOST ?? '3.208.123.187',
  port: parseInt(process.env.RETO_PGPORT ?? '5432', 10),
  database: process.env.RETO_PGDATABASE ?? 'biofooddb',
  user: process.env.RETO_PGUSER ?? 'hackathon_dev',
  password: process.env.RETO_PGPASSWORD ?? 'PasswordHackaton2026',
  ssl: false as const,
  connectionTimeoutMillis: 30_000,
}
