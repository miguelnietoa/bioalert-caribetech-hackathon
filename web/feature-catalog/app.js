// web/feature-catalog/app.js
// Frontend del feature catalog. Vanilla JS (sin build step).
//
// ⚠️ Si agregás un feature en lambdas/shared/feature-manifest.ts también hay que
// replicarlo en el array FEATURES de abajo. Es duplicación deliberada — vanilla JS
// no puede importar TS sin un build pipeline.

// ─── Config ────────────────────────────────────────────────────────────────
// Token y sandbox se inyectan con sed al deploy desde SSM /bioalert/hackathon/...
// En el archivo committeado quedan como placeholders __INJECT_*_AT_DEPLOY__.
const DEMO_TOKEN = '__INJECT_TOKEN_AT_DEPLOY__'
const TRIGGER_URL = 'https://c8brdpdf03.execute-api.us-east-1.amazonaws.com/demo/trigger'
const VIEW_BASE = 'https://bioalert-web-hackathon-642722971137.s3.us-east-1.amazonaws.com/'
const SANDBOX_NUMBER = '__INJECT_SANDBOX_AT_DEPLOY__' // formato sin '+' para wa.me

// ─── Tagline humana por kind (reemplaza los códigos internos US-XX / EXT-X) ─
const KIND_TAGLINE = {
  conversational_parent: 'Diálogo con el padre',
  conversational_admin: 'Diálogo con la cafetería',
  cron: 'Acción automática',
  view_only: 'Decisión técnica',
}

const KIND_CHIP_CLASS = {
  conversational_parent: 'kind-parent',
  conversational_admin: 'kind-admin',
  cron: 'kind-cron',
  view_only: 'kind-view',
}

const KIND_ICON = {
  conversational_parent: '💬',
  conversational_admin: '🏫',
  cron: '⏱',
  view_only: '◆',
}

// ─── Features (espejo simplificado de lambdas/shared/feature-manifest.ts) ──
const FEATURES = [
  // Padre
  {
    id: 'consumption_today', kind: 'conversational_parent',
    title: '¿Qué comió hoy?',
    description: 'Lista de compras del estudiante hoy en zona horaria Bogotá, con hora, producto y monto.',
    whatsapp_text: '¿qué comió Mateo hoy?',
  },
  {
    id: 'consumption_week', kind: 'conversational_parent',
    title: 'Resumen de la semana',
    description: 'Top productos, número de compras y gasto total de los últimos 7 días.',
    whatsapp_text: '¿y esta semana cómo le fue?',
  },
  {
    id: 'nutrition_summary', kind: 'conversational_parent',
    title: 'Análisis nutricional',
    description: 'Azúcar, calorías, grasa y sodio acumulados con peso real por unidad — no aproximaciones.',
    whatsapp_text: '¿está comiendo mucha azúcar Mateo?',
  },
  {
    id: 'compare_peers', kind: 'conversational_parent',
    title: 'Comparación con compañeros',
    description: 'Mateo contra el promedio de su colegio en ticket y porcentaje de dulce.',
    whatsapp_text: '¿Mateo come más azúcar que sus compañeros?',
  },
  {
    id: 'balance_projection', kind: 'conversational_parent',
    title: 'Saldo y proyección',
    description: 'Saldo actual del estudiante y días estimados antes de agotamiento.',
    whatsapp_text: '¿cuánto saldo le queda a Mateo?',
  },
  {
    id: 'recharge_recommendations', kind: 'conversational_parent',
    title: 'Tres opciones de recarga',
    description: 'Anchoring con Esencial, Equilibrada y Bienestar — cada una con narrativa basada en el patrón real del estudiante.',
    whatsapp_text: '¿cuánto le recargo?',
  },
  {
    id: 'wompi_checkout', kind: 'conversational_parent',
    title: 'Confirmar y pagar con Wompi',
    description: 'El padre elige una opción y el bot devuelve link de pago Wompi sandbox.',
    whatsapp_text: 'voy con la equilibrada',
    view_path: 'wompi-mock/index.html?plan=equilibrada&monto=150000&estudiante=Mateo&cobertura=mes%20completo',
  },

  // Admin
  {
    id: 'school_alerts', kind: 'conversational_admin',
    title: 'Stock crítico',
    description: 'Lista de productos por debajo del mínimo configurado en la cafetería.',
    whatsapp_text: '¿qué tengo en stock crítico hoy?',
    view_path: 'cafeteria-insights/index.html',
  },
  {
    id: 'cafeteria_benchmark', kind: 'conversational_admin',
    title: 'Benchmark contra otros colegios',
    description: 'Comparación con el promedio nacional y productos saludables ausentes del menú actual.',
    whatsapp_text: '¿cómo voy vs otros colegios?',
    view_path: 'cafeteria-insights/index.html',
  },
  {
    id: 'pos_mock', kind: 'conversational_admin',
    title: 'POS con sugerencias del padre',
    description: 'Simulación del POS de Biofood. Ingresa un código estudiantil para ver saldo + sugerencias del padre. Casos: Mateo 0010204385 (gaseosa), Antonella 0010204361 (dulces), Valentina 0010130672 (sin restricción).',
    view_path: 'pos-mock/index.html',
  },

  // Crons
  {
    id: 'allergen_polling', kind: 'cron',
    title: 'Alerta de alérgeno',
    description: 'Cada 60 segundos detecta ventas nuevas con productos que contienen alérgenos registrados. El padre se entera en menos de medio minuto.',
  },
  {
    id: 'absence_cron', kind: 'cron',
    title: 'Alerta de ausencia',
    description: 'A las 12 PM Bogotá: padres cuyos hijos aún no han comprado nada reciben un aviso.',
  },
  {
    id: 'stock_cron', kind: 'cron',
    title: 'Stock crítico diario',
    description: 'A las 7 AM Bogotá la cafetería recibe un consolidado de los productos por debajo del mínimo.',
  },
  {
    id: 'balance_cron', kind: 'cron',
    title: 'Aviso de saldo bajo',
    description: 'A las 8 AM Bogotá detecta a los estudiantes cuyo saldo se acaba en 2 días o menos según su patrón de gasto. El padre recibe el saldo, la proyección y un CTA a las 3 opciones de recarga.',
  },
  {
    id: 'nutrition_weekly', kind: 'cron',
    title: 'Reporte nutricional semanal',
    description: 'Domingos a las 6 PM. Top productos, macros, comparativa con compañeros y link a vista web detallada.',
    view_path: 'nutrition-report/index.html',
  },
  {
    id: 'cafeteria_weekly', kind: 'cron',
    title: 'Reporte semanal con insight cruzado',
    description: 'Lunes 7 AM. La cafetería recibe benchmark más las señales agregadas que dejaron los padres durante la semana.',
    view_path: 'cafeteria-insights/index.html',
  },
  {
    id: 'streak_detector', kind: 'cron',
    title: 'Detector de rachas (3+ días)',
    description: 'Diario 7:30 AM Bogotá. Si un estudiante consume 3+ días la misma categoría, el padre recibe WhatsApp con 3 botones (alertar/restringir/alternativas). Demo: Mateo (0010204385) tiene rachas reales — al disparar, Diana recibe la alerta.',
  },

  // Diferenciadores info-only
  {
    id: 'explainability', kind: 'view_only',
    title: 'Explicabilidad obligatoria',
    description: 'Cada respuesta del bot incluye "te aviso esto porque..." con justificación basada en datos. Nunca caja negra.',
  },
  {
    id: 'multi_hijo', kind: 'view_only',
    title: 'Familias con varios hijos',
    description: 'Cuando un padre tiene varios estudiantes en el dataset, el bot elige al más activo de forma determinística.',
  },
  {
    id: 'timezone_bogota', kind: 'view_only',
    title: 'Zona horaria correcta',
    description: 'Las queries usan now() en America/Bogotá. Sin confusiones con un dataset que llega hasta fechas futuras.',
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
    else if (k === 'html') node.innerHTML = v
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
  statusEl.textContent = '› Enviando…'
  statusEl.className = 'feature-status show'
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
        statusEl.textContent = `✓ Webhook firmado. Mensaje en camino a ${phone} — revisa el WhatsApp del padre demo en 5-10 segundos.`
      } else if (lambda) {
        statusEl.textContent = `✓ Cron disparado (${lambda}). El resultado llega vía WhatsApp en 5-15 segundos.`
      } else {
        statusEl.textContent = '✓ OK'
      }
      statusEl.className = 'feature-status show ok'
    } else {
      statusEl.textContent = `✗ Error ${res.status}: ${JSON.stringify(json)}`
      statusEl.className = 'feature-status show err'
    }
  } catch (e) {
    statusEl.textContent = `✗ Network: ${e.message}`
    statusEl.className = 'feature-status show err'
  } finally {
    setTimeout(() => { btn.disabled = false }, 1800)
  }
}

const KIND_FEATURE_CLASS = {
  conversational_parent: 'kind-parent',
  conversational_admin: 'kind-admin',
  cron: 'kind-cron',
  view_only: 'kind-view',
}

function renderFeature(f) {
  const isView = f.kind === 'view_only'
  const isAdminConv = f.kind === 'conversational_admin'
  const showAwsBtn = !isView && !isAdminConv
  const showWaBtn = !!f.whatsapp_text && !isAdminConv
  const kindClass = KIND_FEATURE_CLASS[f.kind] ?? ''
  const icon = KIND_ICON[f.kind] ?? '◆'

  const statusEl = el('div', { className: 'feature-status' })
  const actions = el('div', { className: 'feature-actions' })

  if (showAwsBtn) {
    const btn = el('button', { className: 'btn btn-aws', type: 'button' }, [
      el('span', { className: 'btn-icon' }, ['▸']),
      'Disparar',
    ])
    btn.addEventListener('click', () => triggerAws(f.id, statusEl, btn))
    actions.appendChild(btn)
  }

  if (showWaBtn) {
    const wa = `https://wa.me/${SANDBOX_NUMBER}?text=${encodeURIComponent(f.whatsapp_text)}`
    actions.appendChild(
      el('a', { className: 'btn btn-wa', href: wa, target: '_blank', rel: 'noopener noreferrer' }, [
        el('span', { className: 'btn-icon' }, ['✓']),
        'WhatsApp',
      ])
    )
  }

  if (f.view_path) {
    actions.appendChild(
      el('a', { className: 'btn btn-view', href: VIEW_BASE + f.view_path, target: '_blank', rel: 'noopener noreferrer' }, [
        el('span', { className: 'btn-icon' }, ['↗']),
        'Ver vista',
      ])
    )
  }

  const children = [
    el('span', { className: 'feature-icon' }, [icon]),
    el('span', { className: 'feature-title' }, [f.title]),
    el('p', { className: 'feature-desc' }, [f.description]),
  ]
  if (actions.children.length > 0) children.push(actions)
  children.push(statusEl)

  return el('div', { className: `feature ${kindClass}` }, children)
}

function main() {
  const counts = { parent: 0, admin: 0, cron: 0, view_only: 0 }
  for (const f of FEATURES) {
    const section = SECTION_MAP[f.kind]
    if (!section) continue
    const container = document.querySelector(`[data-section="${section}"]`)
    if (!container) continue
    container.appendChild(renderFeature(f))
    counts[section]++
  }
  for (const [k, n] of Object.entries(counts)) {
    const chip = document.querySelector(`[data-count-for="${k}"]`)
    if (chip) chip.textContent = `${n} features`
  }
}

main()
