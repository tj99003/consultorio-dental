// Adaptador local: la misma lógica del servidor corriendo en el navegador
// (versión estática para GitHub Pages). El estado persiste en localStorage.

import { seed } from '../src/seed.js';
import * as scheduler from '../src/scheduler.js';
import * as bot from '../src/bot.js';
import * as cal from '../src/calendarProvider.js';
import { metrics } from '../src/metrics.js';
import { nextId } from '../src/ids.js';

const KEY = 'consultorio-db-v1';

let db;
try {
  db = JSON.parse(localStorage.getItem(KEY));
} catch {
  db = null;
}
if (!db || !db.patients) {
  db = seed();
  scheduler.tick(db);
  persist();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // localStorage lleno o no disponible: la demo sigue en memoria
  }
}

function state() {
  return {
    now: db.now,
    config: db.config,
    patients: db.patients,
    appointments: [...db.appointments].sort((a, b) => new Date(a.start) - new Date(b.start)),
    treatments: db.treatments,
    waitlist: db.waitlist,
    messages: db.messages,
    alerts: db.alerts.filter(a => !a.resolved),
    metrics: metrics(db),
  };
}

// Misma superficie que la API HTTP del server.js
export function call(path, body = {}) {
  let m;
  if (path === '/api/state') return state();
  if (path === '/api/time/advance') scheduler.advance(db, body.hours || 1);
  else if (path === '/api/reset') {
    db = seed();
    scheduler.tick(db);
  } else if (path === '/api/appointments') cal.createEvent(db, body);
  else if ((m = path.match(/^\/api\/appointments\/(\w+)\/outcome$/))) bot.markOutcome(db, m[1], body.outcome);
  else if ((m = path.match(/^\/api\/alerts\/(\w+)\/resolve$/))) {
    const a = db.alerts.find(x => x.id === m[1]);
    if (a) a.resolved = true;
  } else if (path === '/api/treatments') {
    db.treatments.push({
      id: nextId(db, 't'),
      patientId: body.patientId,
      name: body.name,
      totalSessions: Number(body.totalSessions) || 1,
      sessionsCompleted: 0,
      status: 'active',
      createdAt: db.now,
      lastCompletedAt: null,
      followUpCount: 0,
      lastFollowUpAt: null,
      escalated: false,
    });
  } else if (path === '/api/waitlist') {
    db.waitlist.push({ id: nextId(db, 'w'), patientId: body.patientId, note: body.note || '', status: 'waiting' });
  } else if (path === '/api/messages/inbound') {
    if (body.action) bot.handleAction(db, body.patientId, body.action);
    else bot.handleText(db, body.patientId, body.text || '');
  } else if (path === '/api/config') {
    if (body.followUpDays) db.config.followUpDays = Number(body.followUpDays);
    if (body.escalationFollowUps) db.config.escalationFollowUps = Number(body.escalationFollowUps);
    if (body.reminderHours) {
      const hrs = String(body.reminderHours).split(',').map(x => Number(x.trim())).filter(x => x > 0);
      if (hrs.length) db.config.reminderHours = hrs;
    }
  }
  persist();
  return state();
}
