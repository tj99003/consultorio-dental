let S = null; // estado completo del servidor
let phonePatient = localStorage.getItem('phonePatient') || 'p1';
const USERS = {
  marcela: { name: 'Marcela', role: 'Asistente', avatar: '👩‍💼' },
  laura: { name: 'Dra. Laura', role: 'Dentista', avatar: '👩‍⚕️' },
};
const TITLES = {
  panel: 'Panel', agenda: 'Agenda', pacientes: 'Pacientes',
  tratamientos: 'Tratamientos', whatsapp: 'WhatsApp (paciente)', config: 'Configuración',
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDT = iso => new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtD = iso => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const pname = id => (S.patients.find(p => p.id === id) || {}).name || id;
const tname = id => (S.treatments.find(t => t.id === id) || {}).name || '';

const STATUS = {
  scheduled: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada',
  no_show: 'No llegó', cancelled: 'Cancelada', reschedule_requested: 'Reagendando',
};

/* ---------- login ---------- */
function doLogin(e) {
  e.preventDefault();
  const f = e.target;
  if (f.pass.value !== 'demo123') {
    $('login-error').textContent = 'Contraseña incorrecta (demo123)';
    return false;
  }
  const u = USERS[f.user.value];
  sessionStorage.setItem('user', f.user.value);
  $('who-name').textContent = u.name;
  $('who-role').textContent = u.role;
  $('who-avatar').textContent = u.avatar;
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  refresh();
  return false;
}
function doLogout() {
  sessionStorage.removeItem('user');
  location.reload();
}

/* ---------- api ---------- */
// Si hay backend (node server.js / túnel) se usa HTTP; si no (GitHub Pages)
// se usa el adaptador local que corre la misma lógica en el navegador.
let MODE; // 'server' | 'local'
let localApi;

async function api(path, body) {
  if (MODE === undefined) {
    try {
      const r = await fetch('/api/state');
      MODE = r.ok ? 'server' : 'local';
    } catch {
      MODE = 'local';
    }
    if (MODE === 'local') localApi = await import('./api-local.js');
  }
  if (MODE === 'local') {
    S = localApi.call(path, body);
    render();
    return;
  }
  const r = await fetch(path, body !== undefined
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : {});
  S = await r.json();
  render();
}
const refresh = () => api('/api/state');
const advance = h => api('/api/time/advance', { hours: h });
const resetDemo = () => confirm('¿Reiniciar los datos de la demo?') && api('/api/reset', {});
const markOutcome = (id, outcome) => api(`/api/appointments/${id}/outcome`, { outcome });
const resolveAlert = id => api(`/api/alerts/${id}/resolve`, {});
const sendAction = (patientId, action) => api('/api/messages/inbound', { patientId, action });
const sendText = () => {
  const t = $('free-text').value.trim();
  if (!t) return;
  $('free-text').value = '';
  api('/api/messages/inbound', { patientId: phonePatient, text: t });
};

function createAppointment(e) {
  e.preventDefault();
  const f = e.target;
  api('/api/appointments', {
    patientId: f.patientId.value,
    start: new Date(f.start.value).toISOString(),
    treatmentId: f.treatmentId.value || null,
  });
  f.reset();
  return false;
}
function addWaitlist(e) {
  e.preventDefault();
  const f = e.target;
  api('/api/waitlist', { patientId: f.patientId.value, note: f.note.value });
  f.reset();
  return false;
}
function createTreatment(e) {
  e.preventDefault();
  const f = e.target;
  api('/api/treatments', { patientId: f.patientId.value, name: f.name.value, totalSessions: f.totalSessions.value });
  f.reset();
  return false;
}
function saveConfig(e) {
  e.preventDefault();
  const f = e.target;
  api('/api/config', {
    reminderHours: f.reminderHours.value,
    followUpDays: f.followUpDays.value,
    escalationFollowUps: f.escalationFollowUps.value,
  }).then(() => { $('cfg-saved').textContent = 'Guardado ✓'; });
  return false;
}

/* ---------- render ---------- */
function apptCard(a) {
  const past = new Date(a.start) < new Date(S.now);
  const outcomeBtns = past && a.status === 'confirmed'
    ? `<span>
         <button class="ghost" onclick="markOutcome('${a.id}','completed')">Asistió</button>
         <button class="ghost" onclick="markOutcome('${a.id}','no_show')">No llegó</button>
       </span>` : '';
  return `<div class="card"><div class="row">
    <span><strong>${fmtDT(a.start)}</strong> — ${esc(pname(a.patientId))}
      ${a.treatmentId ? `<span class="sub">(${esc(tname(a.treatmentId))})</span>` : ''}</span>
    <span class="badge ${a.status}">${STATUS[a.status] || a.status}</span>
    ${outcomeBtns}
  </div></div>`;
}

function patientCard(p) {
  const next = S.appointments.find(a => a.patientId === p.id && ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start) > new Date(S.now));
  const tr = S.treatments.find(t => t.patientId === p.id && t.status === 'active');
  const msgs = S.messages.filter(m => m.patientId === p.id).length;
  return `<div class="card patient-card"><div class="row">
      <span class="avatar">🧑</span>
      <span style="flex:1"><span class="pname">${esc(p.name)}</span><div class="sub">${esc(p.phone)}</div></span>
    </div>
    <div class="sub" style="margin-top:8px">
      ${next ? `📅 Próxima cita: <strong>${fmtDT(next.start)}</strong>` : '📅 Sin cita próxima'}<br>
      ${tr ? `🦷 ${esc(tr.name)}: sesión ${tr.sessionsCompleted}/${tr.totalSessions}` : '🦷 Sin tratamiento activo'}<br>
      💬 ${msgs} mensaje(s)
    </div></div>`;
}

function render() {
  if (!S) return;
  $('clock-now').textContent = new Date(S.now).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' });

  const m = S.metrics;
  $('metrics').innerHTML = `
    <div class="metric ${m.noShowRate > 0.15 ? 'bad' : 'good'}">
      <div class="value">${(m.noShowRate * 100).toFixed(0)}%</div>
      <div class="label">Inasistencias (${m.noShows}/${m.decidedAppointments} citas)</div></div>
    <div class="metric good">
      <div class="value">${(m.completionRate * 100).toFixed(0)}%</div>
      <div class="label">Tratamientos terminados (${m.finishedTreatments}/${m.totalTreatments})</div></div>`;

  $('alerts').innerHTML = S.alerts.length
    ? S.alerts.map(a => `<div class="card alert"><div class="row"><span>⚠️ ${esc(a.text)}</span>
        <button class="ghost" onclick="resolveAlert('${a.id}')">Atendida</button></div></div>`).join('')
    : '<div class="empty">Sin alertas pendientes 🎉</div>';

  const todayStr = new Date(S.now).toDateString();
  const today = S.appointments.filter(a => new Date(a.start).toDateString() === todayStr);
  $('today').innerHTML = today.length ? today.map(apptCard).join('') : '<div class="empty">Sin citas hoy</div>';

  $('all-appointments').innerHTML = S.appointments.map(apptCard).join('');

  $('waitlist').innerHTML = S.waitlist.length
    ? S.waitlist.map(w => `<div class="card"><div class="row">
        <span>${esc(pname(w.patientId))} <span class="sub">${esc(w.note || '')}</span></span>
        <span class="badge ${w.status === 'waiting' ? 'scheduled' : 'confirmed'}">${w.status === 'waiting' ? 'En espera' : 'Agendado'}</span>
      </div></div>`).join('')
    : '<div class="empty">Vacía</div>';

  $('patient-list').innerHTML = S.patients.map(patientCard).join('');

  $('treatments').innerHTML = S.treatments.map(t => `
    <div class="card">
      <div class="row"><span><strong>${esc(t.name)}</strong> — ${esc(pname(t.patientId))}</span>
        <span class="badge ${t.status === 'active' ? 'active' : 'completed'}">${t.status === 'active' ? 'Activo' : 'Terminado'}</span></div>
      <div class="sub">Sesión ${t.sessionsCompleted}/${t.totalSessions}
        ${t.lastCompletedAt ? `· última: ${fmtD(t.lastCompletedAt)}` : ''}
        ${t.followUpCount ? `· ${t.followUpCount} seguimiento(s)` : ''}
        ${t.escalated ? '· <strong>escalado</strong>' : ''}</div>
      <div class="progress"><div style="width:${(t.sessionsCompleted / t.totalSessions) * 100}%"></div></div>
    </div>`).join('');

  // selects
  const opts = S.patients.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  document.querySelectorAll('#new-appt [name=patientId], #new-wait [name=patientId], #new-treat [name=patientId], #phone-patient')
    .forEach(sel => { const cur = sel.value; sel.innerHTML = opts; if (cur) sel.value = cur; });
  $('phone-patient').value = phonePatient;
  $('new-appt').treatmentId.innerHTML = '<option value="">— sin tratamiento —</option>' +
    S.treatments.filter(t => t.status === 'active')
      .map(t => `<option value="${t.id}">${esc(t.name)} — ${esc(pname(t.patientId))}</option>`).join('');

  // config
  if (!$('cfg').dataset.filled) {
    $('cfg').reminderHours.value = S.config.reminderHours.join(', ');
    $('cfg').followUpDays.value = S.config.followUpDays;
    $('cfg').escalationFollowUps.value = S.config.escalationFollowUps;
    $('cfg').dataset.filled = '1';
  }

  renderChat();
}

function renderChat() {
  if (!S) return;
  phonePatient = $('phone-patient').value || phonePatient;
  localStorage.setItem('phonePatient', phonePatient);
  const msgs = S.messages.filter(x => x.patientId === phonePatient);
  $('chat').innerHTML = msgs.length ? msgs.map(x => `
    <div class="msg ${x.dir}">${esc(x.body)}
      ${x.actions.length ? `<div class="actions">${x.actions.map(a =>
        `<button onclick='sendAction("${phonePatient}", ${JSON.stringify(a).replace(/'/g, '&#39;')})'>${esc(a.label)}</button>`).join('')}</div>` : ''}
      <span class="ts">${fmtDT(x.ts)}</span>
    </div>`).join('') : '<div class="empty">Sin mensajes todavía. Avanza el reloj para que salgan los recordatorios.</div>';
  $('chat').scrollTop = $('chat').scrollHeight;
}

/* ---------- navegación ---------- */
document.querySelectorAll('.menu-item').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.menu-item').forEach(x => x.classList.toggle('active', x === t));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === t.dataset.view));
  $('view-title').textContent = TITLES[t.dataset.view] || '';
  render();
}));

/* ---------- arranque ---------- */
if (sessionStorage.getItem('user')) {
  const u = USERS[sessionStorage.getItem('user')];
  $('who-name').textContent = u.name;
  $('who-role').textContent = u.role;
  $('who-avatar').textContent = u.avatar;
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  refresh();
}
setInterval(async () => {
  if (!sessionStorage.getItem('user')) return;
  if (MODE === 'local') {
    S = localApi.call('/api/state');
    render();
    return;
  }
  try {
    const r = await fetch('/api/state');
    if (r.ok) { S = await r.json(); render(); }
  } catch { /* servidor caído: reintenta en el siguiente ciclo */ }
}, 4000);
