// Lógica de respuesta a lo que el paciente contesta por WhatsApp.
// Cada action viene de un botón del mensaje saliente; el texto libre se
// escala a la asistente en lugar de intentar interpretarlo.

import * as wa from './whatsapp.js';
import * as cal from './calendarProvider.js';
import { freeSlots, isFree } from './slots.js';
import { nextId } from './ids.js';
import { patientName } from './scheduler.js';

const fmt = iso =>
  new Date(iso).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function offerFreedSlot(db, start) {
  // Se ofrece a todos en lista de espera; el primero que acepta se queda con el hueco.
  let offered = 0;
  for (const w of db.waitlist) {
    if (w.status !== 'waiting') continue;
    wa.send(
      db,
      w.patientId,
      `${patientName(db, w.patientId)}, se liberó un espacio el ${fmt(start)}. ¿Lo quieres? El primero en responder se lo queda.`,
      [{ type: 'accept_slot', label: '🙋 Lo quiero', payload: { start, waitlistId: w.id } }]
    );
    offered++;
  }
  return offered;
}

function offerSlots(db, patientId, intro, extraPayload) {
  const slots = freeSlots(db, 3);
  if (!slots.length) {
    wa.send(db, patientId, `${intro} Por ahora no hay horarios libres; la asistente te contactará.`, []);
    return;
  }
  wa.send(
    db,
    patientId,
    `${intro} Estos horarios están disponibles:`,
    slots.map(s => ({
      type: 'pick_slot',
      label: fmt(s),
      payload: { start: s, ...extraPayload },
    }))
  );
}

function bookAppointment(db, patientId, start, treatmentId) {
  const appt = cal.createEvent(db, { patientId, start, treatmentId });
  const t = treatmentId && db.treatments.find(x => x.id === treatmentId);
  wa.send(
    db,
    patientId,
    `Listo, ${patientName(db, patientId)}. Tu cita${t ? ` de ${t.name}` : ''} quedó para el ${fmt(start)}. Te enviaremos recordatorio.`
  );
  return appt;
}

// Maneja una action (botón) del simulador de teléfono.
export function handleAction(db, patientId, action) {
  const { type, payload = {} } = action;
  const appt = payload.appointmentId && db.appointments.find(a => a.id === payload.appointmentId);

  switch (type) {
    case 'confirm':
      if (!appt) return;
      appt.status = 'confirmed';
      wa.send(db, patientId, `¡Gracias, ${patientName(db, patientId)}! Tu cita del ${fmt(appt.start)} quedó confirmada.`);
      break;

    case 'cancel':
      if (!appt) return;
      appt.status = 'cancelled';
      appt.cancelledAt = db.now;
      wa.send(db, patientId, `Entendido, cancelamos tu cita del ${fmt(appt.start)}. Cuando quieras reagendar, escríbenos.`);
      offerFreedSlot(db, appt.start);
      break;

    case 'reschedule':
      if (!appt) return;
      appt.status = 'reschedule_requested';
      offerSlots(db, patientId, `Sin problema, movemos tu cita del ${fmt(appt.start)}.`, {
        reschedulingFrom: appt.id,
        treatmentId: appt.treatmentId,
      });
      break;

    case 'pick_slot': {
      const { start, reschedulingFrom, treatmentId } = payload;
      if (!isFree(db, start)) {
        wa.send(db, patientId, 'Ese horario acaba de ocuparse. Te muestro otros:');
        offerSlots(db, patientId, 'Horarios disponibles:', { reschedulingFrom, treatmentId });
        return;
      }
      bookAppointment(db, patientId, start, treatmentId || null);
      if (reschedulingFrom) {
        const old = db.appointments.find(a => a.id === reschedulingFrom);
        if (old && old.status === 'reschedule_requested') old.status = 'cancelled';
      }
      break;
    }

    case 'book_session':
      offerSlots(db, patientId, `Perfecto, agendemos tu siguiente sesión.`, { treatmentId: payload.treatmentId });
      break;

    case 'accept_slot': {
      const w = db.waitlist.find(x => x.id === payload.waitlistId);
      if (!isFree(db, payload.start)) {
        wa.send(db, patientId, 'Lo sentimos, ese espacio acaba de ocuparse. Te avisamos del siguiente.');
        return;
      }
      bookAppointment(db, patientId, payload.start, null);
      if (w) w.status = 'scheduled';
      break;
    }
  }
}

// Texto libre: acuse al paciente + alerta para que la asistente responda.
export function handleText(db, patientId, text) {
  wa.receive(db, patientId, text);
  wa.send(db, patientId, `Gracias por escribirnos, ${patientName(db, patientId)}. La asistente revisará tu mensaje y te responde a la brevedad.`);
  db.alerts.push({
    id: nextId(db, 'al'),
    type: 'patient_message',
    text: `${patientName(db, patientId)} escribió por WhatsApp: "${text}"`,
    ts: db.now,
    resolved: false,
    patientId,
  });
}

// La asistente marca el resultado de una cita ya pasada. Idempotente: marcar
// 'completed' dos veces no vuelve a contar la sesión.
export function markOutcome(db, appointmentId, outcome) {
  const a = db.appointments.find(x => x.id === appointmentId);
  if (!a) return null;
  const wasCounted = a.status === 'completed';
  a.status = outcome; // 'completed' | 'no_show'
  if (outcome === 'completed' && !wasCounted && a.treatmentId) {
    const t = db.treatments.find(x => x.id === a.treatmentId);
    if (t && t.status === 'active') {
      t.sessionsCompleted += 1;
      t.lastCompletedAt = db.now;
      t.followUpCount = 0;
      if (t.sessionsCompleted >= t.totalSessions) {
        t.status = 'completed';
        wa.send(db, t.patientId, `¡Felicidades, ${patientName(db, t.patientId)}! Terminaste tu tratamiento de ${t.name}. 🎉`);
      }
    }
  }
  return a;
}
