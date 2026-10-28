// CalendarProvider: adaptador que simula Google Calendar.
//
// Para conectar la API real implementar estos mismos métodos contra
// https://developers.google.com/calendar/api/v3/reference/events:
//   - listEvents()  -> calendar.events.list   (sync incremental con syncToken)
//   - createEvent() -> calendar.events.insert (guardar event.id en gcalId)
//   - updateEvent() -> calendar.events.patch
// La agenda en Google Calendar sigue siendo la fuente de verdad; este
// adaptador es el único lugar que la lee/escribe.

const { nextId } = require('./store');

function listEvents(db) {
  return db.appointments;
}

function createEvent(db, { patientId, start, treatmentId = null }) {
  const appt = {
    id: nextId(db, 'a'),
    patientId,
    start,
    status: 'scheduled',
    treatmentId,
    reminders: {},
    gcalId: 'gcal-' + nextId(db, 'g'), // en la API real: el id que devuelve Google
  };
  db.appointments.push(appt);
  return appt;
}

function updateEvent(db, id, patch) {
  const appt = db.appointments.find(a => a.id === id);
  if (!appt) return null;
  Object.assign(appt, patch);
  return appt;
}

module.exports = { listEvents, createEvent, updateEvent };
