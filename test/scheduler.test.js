import test from 'node:test';
import assert from 'node:assert/strict';

import { seed } from '../src/seed.js';
import { tick, advance } from '../src/scheduler.js';
import * as bot from '../src/bot.js';
import { metrics } from '../src/metrics.js';

test('primer tick envía recordatorio de la ventana correcta y seguimiento de tratamiento vencido', () => {
  const db = seed(); // now = hoy 08:00; a1 a las 09:00 (diff 1h), a2 a las 11:00 (diff 3h)
  tick(db);

  const toP1 = db.messages.filter(m => m.patientId === 'p1');
  assert.equal(toP1.length, 1); // ventana de 2h
  assert.equal(toP1[0].meta.reminderWindow, 2);
  assert.equal(toP1[0].actions.length, 3);

  const toP2 = db.messages.filter(m => m.patientId === 'p2' && m.meta.reminderWindow);
  assert.equal(toP2.length, 1); // ventana de 24h (diff 3h), no duplica la de 72h
  assert.equal(toP2[0].meta.reminderWindow, 24);

  // t2 tiene cita futura (a4) -> NO se le manda seguimiento
  assert.equal(db.messages.filter(m => m.patientId === 'p4' && m.meta.followUp).length, 0);

  // t1: última sesión hace 10 días > followUpDays (7) -> seguimiento
  const follow = db.messages.filter(m => m.patientId === 'p2' && m.meta.followUp);
  assert.equal(follow.length, 1);
  assert.equal(follow[0].actions[0].type, 'book_session');
  assert.equal(db.treatments.find(t => t.id === 't1').followUpCount, 1);
});

test('los recordatorios no se duplican entre ticks', () => {
  const db = seed();
  tick(db);
  tick(db);
  const toP1 = db.messages.filter(m => m.patientId === 'p1' && m.meta.reminderWindow);
  assert.equal(toP1.length, 1);
});

test('confirmar por WhatsApp actualiza el estado de la cita', () => {
  const db = seed();
  tick(db);
  bot.handleAction(db, 'p1', { type: 'confirm', payload: { appointmentId: 'a1' } });
  assert.equal(db.appointments.find(a => a.id === 'a1').status, 'confirmed');
});

test('cancelar libera el horario y ofrece el espacio a la lista de espera', () => {
  const db = seed();
  tick(db);
  bot.handleAction(db, 'p1', { type: 'cancel', payload: { appointmentId: 'a1' } });
  assert.equal(db.appointments.find(a => a.id === 'a1').status, 'cancelled');
  const offers = db.messages.filter(m => m.actions.some(a => a.type === 'accept_slot'));
  assert.equal(offers.length, 2); // w1 y w2
});

test('lista de espera: el primero que acepta se queda con el espacio', () => {
  const db = seed();
  const start = db.appointments.find(a => a.id === 'a1').start;
  bot.handleAction(db, 'p1', { type: 'cancel', payload: { appointmentId: 'a1' } });
  bot.handleAction(db, 'p7', { type: 'accept_slot', payload: { start, waitlistId: 'w1' } });
  bot.handleAction(db, 'p8', { type: 'accept_slot', payload: { start, waitlistId: 'w2' } });

  assert.equal(db.waitlist.find(w => w.id === 'w1').status, 'scheduled');
  assert.ok(db.appointments.some(a => a.patientId === 'p7' && a.start === start && a.status === 'scheduled'));
  assert.ok(!db.appointments.some(a => a.patientId === 'p8' && a.start === start));
  assert.match(db.messages.filter(m => m.patientId === 'p8').at(-1).body, /ocupado|ocuparse/);
});

test('cita pasada sin confirmar se marca como inasistencia automática', () => {
  const db = seed();
  advance(db, 4); // 08:00 -> 12:00; a1 era a las 09:00 sin confirmar
  assert.equal(db.appointments.find(a => a.id === 'a1').status, 'no_show');
});

test('tratamiento sin respuesta escala a alerta tras N seguimientos', () => {
  const db = seed();
  advance(db, 48); // seguimiento en tick 1, otro a las ~24h -> escalado con 2
  const t = db.treatments.find(x => x.id === 't1');
  assert.equal(t.escalated, true);
  assert.ok(db.alerts.some(a => a.type === 'treatment_stalled' && !a.resolved));
});

test('completar una cita de tratamiento avanza sesiones y es idempotente', () => {
  const db = seed();
  bot.markOutcome(db, 'a4', 'completed'); // a4 pertenece a t2 (ortodoncia)
  const t = db.treatments.find(x => x.id === 't2');
  assert.equal(t.sessionsCompleted, 3);
  bot.markOutcome(db, 'a4', 'completed'); // idempotente: no vuelve a contar
  assert.equal(t.sessionsCompleted, 3);
});

test('métricas: tasa de inasistencia y finalización de tratamientos', () => {
  const db = seed();
  const m = metrics(db);
  // a6 completed, a7 no_show, a8 completed, a9 no_show -> 2/4 = 50%
  assert.equal(m.noShowRate, 0.5);
  // t3 completado de 3 -> 33%
  assert.ok(Math.abs(m.completionRate - 1 / 3) < 0.01);
});
