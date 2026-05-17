// BioAlert+ POS mock — consume el endpoint pos-api y pinta sugerencias del padre.
const API = 'https://c8brdpdf03.execute-api.us-east-1.amazonaws.com';

const userIdInput   = document.getElementById('user-id-input');
const customerPanel = document.getElementById('customer-panel');
const alertsArea    = document.getElementById('alerts-area');
const ventaToggle   = document.getElementById('venta-directa-toggle');

if (ventaToggle) {
  ventaToggle.addEventListener('click', () => ventaToggle.classList.toggle('on'));
}

userIdInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const id = e.target.value.trim();
  if (!id) return;
  await loadStudent(id);
});

async function loadStudent(id) {
  alertsArea.innerHTML = '<div class="loading">Buscando estudiante…</div>';
  customerPanel.innerHTML = '';
  try {
    const res = await fetch(`${API}/pos/student/${encodeURIComponent(id)}/flags`);
    if (res.status === 404) {
      alertsArea.innerHTML = renderNotFound();
      customerPanel.innerHTML = renderEmptyCustomer();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    customerPanel.innerHTML = renderCustomer(data);
    alertsArea.innerHTML = renderAlerts(data.flags || []);
  } catch (err) {
    alertsArea.innerHTML = `<div class="error">Error al consultar: ${escapeHtml(err.message)}</div>`;
    customerPanel.innerHTML = renderEmptyCustomer();
  }
}

function renderCustomer(d) {
  const balance = typeof d.balance === 'number' ? d.balance : 0;
  const sign = balance < 0 ? 'negative' : (balance === 0 ? 'zero' : '');
  return `
    <div class="customer-name">${escapeHtml(d.student_name || 'Estudiante')}</div>
    <div class="customer-meta">${escapeHtml(d.school || '')}${d.school_nit ? ` · NIT ${escapeHtml(String(d.school_nit))}` : ''}</div>
    <table class="customer-table">
      <thead><tr><th>Nombre</th><th>Cantidad</th><th>Precio</th></tr></thead>
      <tbody><tr class="empty-row"><td colspan="3">— sin items —</td></tr></tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Nuevo Saldo</span><span class="${sign}">${formatCOP(balance)}</span></div>
      <div class="total-row"><span>Sub Total</span><span>$0</span></div>
    </div>
  `;
}

function renderEmptyCustomer() {
  return `
    <div class="empty-customer">pos 1</div>
    <table class="customer-table">
      <thead><tr><th>Nombre</th><th>Cantidad</th><th>Precio</th></tr></thead>
      <tbody><tr class="empty-row"><td colspan="3">— sin items —</td></tr></tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Nuevo Saldo</span><span>$0</span></div>
      <div class="total-row"><span>Sub Total</span><span>$0</span></div>
    </div>
  `;
}

function renderAlerts(flags) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return '<div class="ok-state">Sin sugerencias activas del padre. Procede con la venta normal.</div>';
  }
  return flags.map(renderAlertCard).join('');
}

function renderAlertCard(f) {
  const subs = Array.isArray(f.substitutes) ? f.substitutes : [];
  const expires = (f.expires_in_days === null || f.expires_in_days === undefined)
    ? 'Indefinida'
    : `Vigente ${f.expires_in_days} días más`;
  return `
    <div class="alert-card">
      <div class="alert-tag">
        🌿 Sugerencia del padre
        ${f.category ? `<span class="category">· ${escapeHtml(f.category)}</span>` : ''}
      </div>
      ${f.title ? `<div class="alert-message"><strong>${escapeHtml(f.title)}.</strong> ${escapeHtml(f.message || '')}</div>` : `<div class="alert-message">${escapeHtml(f.message || '')}</div>`}
      ${subs.length ? `
        <div class="substitutes">
          <div class="substitutes-title">Alternativas vendibles</div>
          <ul>
            ${subs.map(s => `<li><strong>${escapeHtml(s.name || '')}</strong>${s.pitch ? ` — ${escapeHtml(s.pitch)}` : ''}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="alert-fine">${escapeHtml(expires)}.</div>
    </div>
  `;
}

function renderNotFound() {
  return `
    <div class="not-found">
      <span style="font-size:18px;">⚠️</span>
      <span>Estudiante no encontrado. Verifica el código.</span>
    </div>
  `;
}

function formatCOP(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '$0';
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
  }
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Estado inicial: panel cliente vacío.
customerPanel.innerHTML = renderEmptyCustomer();
