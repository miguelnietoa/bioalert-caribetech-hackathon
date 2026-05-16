import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm'

const STAGE = process.env.STAGE ?? 'hackathon'
const REGION = process.env.AWS_REGION ?? 'us-east-1'
const client = new SSMClient({ region: REGION })

let cache: Record<string, string> | null = null

export async function getSecret(name: string): Promise<string> {
  if (!cache) {
    const out = await client.send(
      new GetParametersByPathCommand({
        Path: `/bioalert/${STAGE}/`,
        Recursive: true,
        WithDecryption: true,
      }),
    )
    cache = {}
    for (const p of out.Parameters ?? []) {
      if (p.Name && p.Value) {
        const key = p.Name.replace(`/bioalert/${STAGE}/`, '')
        cache[key] = p.Value
      }
    }
  }
  const value = cache[name]
  if (!value) throw new Error(`SSM secret missing: ${name}`)
  return value
}
