import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import type { ConversationSession } from './types.js'

const STAGE = process.env.STAGE ?? 'hackathon'
const TABLE = `bioalert-conversations-${STAGE}`
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export async function getSession(
  phone_e164: string,
): Promise<ConversationSession | null> {
  const out = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { phone_e164 } }),
  )
  return (out.Item as ConversationSession | undefined) ?? null
}

export async function putSession(s: ConversationSession): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 60 * 60
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { ...s, expires_at: ttl },
    }),
  )
}
