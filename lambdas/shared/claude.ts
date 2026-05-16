import Anthropic from '@anthropic-ai/sdk'
import { getSecret } from './ssm.js'

let client: Anthropic | null = null

export async function getClaude(): Promise<Anthropic> {
  if (client) return client
  const apiKey = await getSecret('anthropic/api-key')
  client = new Anthropic({ apiKey })
  return client
}

export const MODEL_CONVERSATIONAL = 'claude-sonnet-4-6'
export const MODEL_BATCH = 'claude-haiku-4-5-20251001'

export async function chatWithTools(opts: {
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
  model?: string
  maxTokens?: number
}): Promise<Anthropic.Message> {
  const c = await getClaude()
  return c.messages.create({
    model: opts.model ?? MODEL_CONVERSATIONAL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.systemPrompt,
    tools: opts.tools,
    messages: opts.messages,
  })
}
