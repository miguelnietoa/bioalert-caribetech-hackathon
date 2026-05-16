type LogLevel = 'info' | 'warn' | 'error'

function log(
  level: LogLevel,
  msg: string,
  fields: Record<string, unknown> = {},
) {
  console.log(
    JSON.stringify({
      level,
      msg,
      ts: new Date().toISOString(),
      ...fields,
    }),
  )
}

export const logger = {
  info: (m: string, f?: Record<string, unknown>) => log('info', m, f),
  warn: (m: string, f?: Record<string, unknown>) => log('warn', m, f),
  error: (m: string, f?: Record<string, unknown>) => log('error', m, f),
}
