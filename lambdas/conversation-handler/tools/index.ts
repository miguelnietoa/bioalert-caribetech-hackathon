// Registry de las 15 tools del agente conversacional.
// La identidad del teléfono (padre o admin) determina cuáles están "disponibles" —
// el filtrado lo hace el handler en index.ts.

import type Anthropic from '@anthropic-ai/sdk'
import * as t1 from './get-student-consumption-today.js'
import * as t2 from './get-student-consumption-week.js'
import * as t3 from './get-nutrition-summary.js'
import * as t4 from './get-balance-projection.js'
import * as t5 from './get-recharge-recommendations.js'
import * as t6 from './compare-to-peers.js'
import * as t7 from './get-school-alerts.js'
import * as t8 from './get-cafeteria-benchmark.js'
import * as t9 from './generate-payment-link.js'
import * as t10 from './get-active-streaks.js'
import * as t11 from './acknowledge-streak.js'
import * as t12 from './activate-restriction.js'
import * as t13 from './list-restrictions.js'
import * as t14 from './remove-restriction.js'
import * as t15 from './get-substitutes.js'

type ToolHandler = (input: unknown, phone: string) => Promise<unknown>

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  [t1.def.name]: t1.handler,
  [t2.def.name]: t2.handler,
  [t3.def.name]: t3.handler,
  [t4.def.name]: t4.handler,
  [t5.def.name]: t5.handler,
  [t6.def.name]: t6.handler,
  [t7.def.name]: t7.handler,
  [t8.def.name]: t8.handler,
  [t9.def.name]: t9.handler,
  [t10.def.name]: t10.handler,
  [t11.def.name]: t11.handler,
  [t12.def.name]: t12.handler,
  [t13.def.name]: t13.handler,
  [t14.def.name]: t14.handler,
  [t15.def.name]: t15.handler,
}

export const ALL_TOOLS: Anthropic.Tool[] = [
  t1.def, t2.def, t3.def, t4.def, t5.def, t6.def, t7.def, t8.def, t9.def,
  t10.def, t11.def, t12.def, t13.def, t14.def, t15.def,
]

// Tools que SOLO un admin debería ver:
const ADMIN_ONLY_TOOL_NAMES = new Set([t7.def.name, t8.def.name])

// Tools que SOLO un padre debería ver:
const PARENT_ONLY_TOOL_NAMES = new Set([
  t1.def.name, t2.def.name, t3.def.name, t4.def.name, t5.def.name, t6.def.name, t9.def.name,
  t10.def.name, t11.def.name, t12.def.name, t13.def.name, t14.def.name, t15.def.name,
])

export function toolsFor(identity: 'parent' | 'admin'): Anthropic.Tool[] {
  if (identity === 'admin') {
    return ALL_TOOLS.filter(t => ADMIN_ONLY_TOOL_NAMES.has(t.name))
  }
  return ALL_TOOLS.filter(t => PARENT_ONLY_TOOL_NAMES.has(t.name))
}

export async function executeToolCall(name: string, input: unknown, phone: string): Promise<unknown> {
  const h = TOOL_HANDLERS[name]
  if (!h) return { error: `unknown_tool: ${name}` }
  try {
    return await h(input, phone)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { error: 'tool_execution_failed', message }
  }
}

// Nombres exportados para usar desde el handler.
export const TOOL_NAMES = {
  consumptionToday: t1.def.name,
  consumptionWeek: t2.def.name,
  nutritionSummary: t3.def.name,
  balanceProjection: t4.def.name,
  rechargeRecommendations: t5.def.name,
  compareToPeers: t6.def.name,
  schoolAlerts: t7.def.name,
  cafeteriaBenchmark: t8.def.name,
  generatePaymentLink: t9.def.name,
  activeStreaks: t10.def.name,
  acknowledgeStreak: t11.def.name,
  activateRestriction: t12.def.name,
  listRestrictions: t13.def.name,
  removeRestriction: t14.def.name,
  getSubstitutes: t15.def.name,
} as const
