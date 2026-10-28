// Motor que corre en cada tick del reloj simulado:
//   1. Recordatorios por ventana (72h/24h/2h, configurable)
//   2. No-show automático de citas pasadas que nunca se confirmaron
//   3. Seguimiento de tratamientos multi-sesión vencidos + escalado a la asistente

const wa = require('./whatsapp');
const { nextId } = require('./store');
const { ACTIVE } = require('./slots');

const HOUR = 3600000;
const DAY = 86400000;

const fmt = iso =>
  new Date(iso).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function patientName(db, id) {
  return (db.patients.find(p => p.id === id) || {}).name || 'paciente';
}

// Ventana que corresponde a `diffH`: la más pequeña configurada que la contiene.
// Así cada cita recibe un solo recordatorio por ventana, sin duplicar en catch-up.
function windowFor(diffH, windows) {
  return [...windows].sort((a, b) => a - b).find(w => diffH <= w);
}

function tick(db) {
  const now = new Date(db.now).getTime();

  // 1. Recordatorios
  for (const a of db.appointments) {
    if (!['scheduled', 'confirmed'].includes(a.status)) continue;
    const diffH = (new Date(a.start).getTime() - now) / HOUR;
    const h = diffH > 0 ? windowFor(diffH, db.config.reminderHours) : null;
    if (h && !a.reminders[h]) {
      a.reminders[h] = true;
      wa.send(
        db,
        a.patientId,
        `Hola ${patientName(db, a.patientId)}, te recordamos tu cita con la Dra. Laura el ${fmt(a.start)}. ¿Confirmas tu asistencia?`,
        [
          { type: 'confirm', label: '✅ Confirmar', payload: { appointmentId: a.id } },
          { type: 'reschedule', label: '📅 Reprogramar', payload: { appointmentId: a.id } },
          { type: 'cancel', label: '❌ Cancelar', payload: { appointmentId: a.id } },
        ],
        { appointmentId: a.id, reminderWindow: h }
      );
    }
    // 2. Cita pasada (>2h) que nunca confirmó -> inasistencia automática
    if (a.status === 'scheduled' && new Date(a.start).getTime() + 2 * HOUR < now) {
      a.status = 'no_show';
      a.autoNoShow = true;
    }
  }

  // 3. Seguimiento de tratamientos multi-sesión
  for (const t of db.treatments) {
    if (t.status !== 'active') continue;
    const hasFuture = db.appointments.some(
      a => a.treatmentId === t.id && ACTIVE.includes(a.status) && new Date(a.start).getTime() > now
    );
    if (hasFuture) {
      t.followUpCount = 0; // ya agendó: resetear escalamiento
      t.escalated = false;
      continue;
    }
    const ref = new Date(t.lastCompletedAt || t.createdAt).getTime();
    if (now - ref < db.config.followUpDays * DAY) continue;
    const gapOk = !t.lastFollowUpAt || now - new Date(t.lastFollowUpAt).getTime() >= DAY;
    if (!gapOk) continue;

    t.followUpCount += 1;
    t.lastFollowUpAt = db.now;
    if (t.followUpCount >= db.config.escalationFollowUps && !t.escalated) {
      t.escalated = true;
      db.alerts.push({
        id: nextId(db, 'al'),
        type: 'treatment_stalled',
        text: `${patientName(db, t.patientId)} no responde al seguimiento de "${t.name}" (sesión ${t.sessionsCompleted + 1}/${t.totalSessions}). Llamar por teléfono.`,
        ts: db.now,
        resolved: false,
        treatmentId: t.id,
      });
      wa.send(
        db,
        t.patientId,
        `${patientName(db, t.patientId)}, es importante continuar tu tratamiento de ${t.name}. La asistente te llamará para ayudarte a agendar.`,
        []
      );
    } else {
      wa.send(
        db,
        t.patientId,
        `Hola ${patientName(db, t.patientId)}, tu tratamiento de ${t.name} lleva ${t.sessionsCompleted} de ${t.totalSessions} sesiones. Para terminarlo a tiempo es momento de agendar la siguiente. ¿Te agendo?`,
        [{ type: 'book_session', label: '📅 Agendar siguiente sesión', payload: { treatmentId: t.id } }],
        { treatmentId: t.id, followUp: t.followUpCount }
      );
    }
  }
}

// Avanza el reloj simulado en pasos de 1h para respetar el orden de las ventanas.
function advance(db, hours) {
  for (let i = 0; i < hours; i++) {
    db.now = new Date(new Date(db.now).getTime() + HOUR).toISOString();
    tick(db);
  }
  return db.now;
}

module.exports = { tick, advance, patientName };
