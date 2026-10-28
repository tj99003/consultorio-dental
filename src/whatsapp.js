// WhatsAppProvider: simula la WhatsApp Business Cloud API.
//
// Para conectar la API real:
//   - send() -> POST https://graph.facebook.com/v19.0/{phone_number_id}/messages
//     con una plantilla aprobada (recordatorio con botones de respuesta rápida).
//   - Los mensajes entrantes llegan por webhook; en esta demo entran por
//     POST /api/messages/inbound desde el simulador de teléfono de la UI.

const { nextId } = require('./store');

function send(db, patientId, body, actions = [], meta = {}) {
  const msg = {
    id: nextId(db, 'm'),
    patientId,
    dir: 'out',
    body,
    ts: db.now,
    actions, // [{type, label, payload}]
    meta,
  };
  db.messages.push(msg);
  return msg;
}

function receive(db, patientId, body) {
  const msg = {
    id: nextId(db, 'm'),
    patientId,
    dir: 'in',
    body,
    ts: db.now,
    actions: [],
    meta: {},
  };
  db.messages.push(msg);
  return msg;
}

module.exports = { send, receive };
