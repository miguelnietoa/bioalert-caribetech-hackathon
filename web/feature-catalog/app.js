// web/feature-catalog/app.js
// Frontend del feature catalog. Vanilla JS (sin build step).
//
// ⚠️ Si agregás un feature en lambdas/shared/feature-manifest.ts también hay que
// replicarlo en el array FEATURES de abajo. Es duplicación deliberada — vanilla JS no
// puede importar TS sin un build pipeline.

// ─── Config ────────────────────────────────────────────────────────────────
// El TOKEN proviene de SSM /bioalert/hackathon/demo/trigger-token. Es un secret
// de demo (32 hex) que solo restringe acceso al endpoint público; no protege
// nada crítico (todas las acciones que dispara ya son funcionalidades públicas
// del bot). Para producción se reemplazaría por auth real.
const DEMO_TOKEN = '__INJECT_TOKEN_AT_DEPLOY__'
const TRIGGER_URL = 'https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/demo/trigger'
const VIEW_BASE = 'https://bioalert-web-hackathon-642722971137.s3.us-east-1.amazonaws.com/'
const SANDBOX_NUMBER = '__INJECT_SANDBOX_AT_DEPLOY__' // formato sin '+' para wa.me

// ─── Manifest de features (espejo de lambdas/shared/feature-manifest.ts) ───
const FEATURES = [
  // Conversacional · Padre
  {
    id: 'consumption_today', kind: 'conversational_parent',
    title: '¿Qué comió hoy?', cobertura: 'US-01',
    description: 'Lista de compras del estudiante hoy (timezone Bogotá), con hora, producto y monto.',
    whatsapp_text: '¿qué comió Mateo hoy?',
  },
  {
    id: 'consumption_week', kind: 'conversational_parent',
    title: 'Resumen de la semana', cobertura: 'US-01 ext',
    description: 'Top productos + número de compras + gasto total últimos 7 días.',
    whatsapp_text: '¿y esta semana cómo le fue?',
  },
  {
    id: 'nutrition_summary', kind: 'conversational_parent',
    title: 'Análisis nutricional', cobertura: 'EXT-2',
    description: 'Azúcar, calorías, grasa y sodio acumulados con peso por unidad real.',
    whatsapp_text: '¿está comiendo mucha azúcar Mateo?',
  },
  {
    id: 'compare_peers', kind: 'conversational_parent',
    title: 'Vs. compañeros', cobertura: 'EXT-2',
    description: 'Comparación con el promedio del colegio en ticket y % dulce.',
    whatsapp_text: '¿Mateo come más azúcar que sus compañeros?',
  },
  {
    id: 'balance_projection', kind: 'conversational_parent',
    title: 'Saldo + proyección', cobertura: 'US-04',
    description: 'Saldo actual y días estimados antes de agotamiento.',
    whatsapp_text: '¿cuánto saldo le queda a Mateo?',
  },
  {
    id: 'recharge_recommendations', kind: 'conversational_parent',
    title: '3 opciones de recarga', cobertura: 'EXT-1',
    description: 'Anchoring con Esencial / Equilibrada / Bienestar, narrativa data-driven.',
    whatsapp_text: '¿cuánto le recargo?',
  },
  {
    id: 'wompi_checkout', kind: 'conversational_parent',
    title: 'Confirmar recarga → Wompi', cobertura: 'EXT-1 + Wompi',
    description: 'El padre elige una opción y el bot envía link de pago Wompi (sandbox).',
    whatsapp_text: 'voy con la equilibrada',
    view_path: 'wompi-mock/index.html?plan=equilibrada&monto=150000&estudiante=Mateo&cobertura=mes%20completo',
  },

  // Conversacional · Admin cafetería
  {
    id: 'school_alerts', kind: 'conversational_admin',
    title: 'Stock crítico', cobertura: 'US-05',
    description: 'Lista de productos por debajo del mínimo configurado.',
    whatsapp_text: '¿qué tengo en stock crítico hoy?',
  },
  {
    id: 'cafeteria_benchmark', kind: 'conversational_admin',
    title: 'Benchmark vs otros colegios', cobertura: 'EXT-3',
    description: 'Comparación con promedio nacional + productos saludables faltantes.',
    whatsapp_text: '¿cómo voy vs otros colegios?',
    view_path: 'cafeteria-insights/index.html',
  },

  // Crons event-driven
  {
    id: 'allergen_polling', kind: 'cron',
    title: 'Alerta de alérgeno', cobertura: 'US-03',
    description: 'Cada 60s: detecta ventas nuevas con productos que contienen alérgenos del estudiante. <30s al padre.',
  },
  {
    id: 'absence_cron', kind: 'cron',
    title: 'Alerta de ausencia', cobertura: 'US-02',
    description: 'Diario 12 PM Bogotá: padres cuyos hijos no compraron hoy reciben aviso.',
  },
  {
    id: 'stock_cron', kind: 'cron',
    title: 'Stock crítico diario', cobertura: 'US-05',
    description: 'Diario 7 AM Bogotá: admin recibe consolidado de productos en stock crítico.',
  },
  {
    id: 'nutrition_weekly', kind: 'cron',
    title: 'Reporte nutricional semanal', cobertura: 'EXT-2',
    description: 'Domingos 6 PM Bogotá: padre recibe top productos + macros + comparativa peer + link a vista web.',
    view_path: 'nutrition-report/index.html',
  },
  {
    id: 'cafeteria_weekly', kind: 'cron',
    title: 'Reporte semanal cafetería + insight cruzado', cobertura: 'EXT-3 + EXT-5',
    description: 'Lunes 7 AM Bogotá: admin recibe benchmark + señales agregadas de padres (EXT-5) + recomendaciones accionables.',
    view_path: 'cafeteria-insights/index.html',
  },

  // Diferenciadores no demostrables como botón
  {
    id: 'explainability', kind: 'view_only',
    title: 'Explicabilidad obligatoria', cobertura: 'EXT-4',
    description: 'Cada respuesta del bot incluye "te aviso esto porque..." con justificación basada en data. Nunca caja negra.',
  },
  {
    id: 'multi_hijo', kind: 'view_only',
    title: 'Multi-hijo determinístico', cobertura: 'producto real',
    description: 'El bot maneja padres con varios hijos en el dataset eligiendo al más activo por COUNT(*) + ties por fecha.',
  },
  {
    id: 'timezone_bogota', kind: 'view_only',
    title: 'Timezone Bogotá nativo', cobertura: 'producto real',
    description: 'Todas las queries usan now() AT TIME ZONE America/Bogota — sin confusión con dataset que tiene fechas futuras.',
  },
]

// ─── Plumbing ──────────────────────────────────────────────────────────────
const SECTION_MAP = {
  conversational_parent: 'parent',
  conversational_admin: 'admin',
  cron: 'cron',
  view_only: 'view_only',
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v
    else if (k === 'onClick') node.addEventListener('click', v)
    else if (k === 'href') node.href = v
    else if (k === 'target') node.target = v
    else if (k === 'rel') node.rel = v
    else node.setAttribute(k, v)
  }
  for (const c of children) {
    if (c == null) continue
    if (typeof c === 'string') node.appendChild(document.createTextNode(c))
    else node.appendChild(c)
  }
  return node
}

async function triggerAws(featureId, statusEl, btn) {
  statusEl.textContent = '⏳ Enviando…'
  statusEl.className = 'card-status show'
  btn.disabled = true
  try {
    const res = await fetch(TRIGGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Demo-Token': DEMO_TOKEN,
      },
      body: JSON.stringify({ feature: featureId }),
    })
    const json = await res.json()
    if (res.ok) {
      const phone = json.details?.phone
      const lambda = json.details?.lambda
      if (phone) {
        statusEl.textContent = `✅ Webhook firmado y enviado. Mensaje a ${phone}. Revisá WhatsApp en ~5-10s.`
      } else if (lambda) {
        statusEl.textContent = `✅ Cron disparado (${lambda}). Resultado llega vía WhatsApp en ~5-15s.`
      } else {
        statusEl.textContent = '✅ OK'
      }
      statusEl.className = 'card-status show ok'
    } else {
      statusEl.textContent = `❌ Error ${res.status}: ${JSON.stringify(json)}`
      statusEl.className = 'card-status show err'
    }
  } catch (e) {
    statusEl.textContent = `❌ Network: ${e.message}`
    statusEl.className = 'card-status show err'
  } finally {
    setTimeout(() => { btn.disabled = false }, 1500)
  }
}

function renderCard(f) {
  const statusEl = el('div', { className: 'card-status' })
  const actions = el('div', { className: 'card-actions' })

  if (f.kind === 'conversational_parent' || f.kind === 'conversational_admin' || f.kind === 'cron') {
    const btn = el('button', { className: 'btn btn-aws', type: 'button' }, ['🤖 Disparar real'])
    btn.addEventListener('click', () => triggerAws(f.id, statusEl, btn))
    actions.appendChild(btn)
  }

  if (f.whatsapp_text) {
    const wa = `https://wa.me/${SANDBOX_NUMBER}?text=${encodeURIComponent(f.whatsapp_text)}`
    actions.appendChild(
      el('a', { className: 'btn btn-wa', href: wa, target: '_blank', rel: 'noopener noreferrer' },
        ['💬 Abrir WhatsApp'])
    )
  }

  if (f.view_path) {
    actions.appendChild(
      el('a', { className: 'btn btn-view', href: VIEW_BASE + f.view_path, target: '_blank', rel: 'noopener noreferrer' },
        ['🔗 Ver vista'])
    )
  }

  return el('div', { className: f.kind === 'view_only' ? 'card info-card' : 'card' }, [
    el('div', { className: 'card-head' }, [
      el('div', { className: 'card-title' }, [f.title]),
      el('span', { className: 'pill' }, [f.cobertura]),
    ]),
    el('div', { className: 'card-desc' }, [f.description]),
    statusEl,
    actions,
  ])
}

function main() {
  for (const f of FEATURES) {
    const section = SECTION_MAP[f.kind]
    if (!section) continue
    const grid = document.querySelector(`[data-section="${section}"]`)
    if (!grid) continue
    grid.appendChild(renderCard(f))
  }
}

main()
