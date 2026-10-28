// Datos semilla de la demo. El reloj simulado arranca hoy a las 08:00.
export function seed() {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setHours(8, 0, 0, 0);
  const at = (dayOffset, h) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const ago = (days, h = 15) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };

  return {
    seq: 0,
    now: now.toISOString(),
    config: {
      reminderHours: [72, 24, 2], // cadencia de recordatorios
      followUpDays: 7,            // días sin siguiente sesión antes de dar seguimiento
      escalationFollowUps: 2,     // seguimientos sin respuesta antes de escalar a la asistente
    },
    patients: [
      { id: 'p1', name: 'María González', phone: '+52 55 1000 0001' },
      { id: 'p2', name: 'José Ramírez', phone: '+52 55 1000 0002' },
      { id: 'p3', name: 'Ana Torres', phone: '+52 55 1000 0003' },
      { id: 'p4', name: 'Carlos Méndez', phone: '+52 55 1000 0004' },
      { id: 'p5', name: 'Lucía Herrera', phone: '+52 55 1000 0005' },
      { id: 'p6', name: 'Pedro Salinas', phone: '+52 55 1000 0006' },
      { id: 'p7', name: 'Elena Ruiz', phone: '+52 55 1000 0007' },
      { id: 'p8', name: 'Jorge Villaseñor', phone: '+52 55 1000 0008' },
    ],
    appointments: [
      { id: 'a1', patientId: 'p1', start: at(0, 9), status: 'scheduled', treatmentId: null, reminders: {}, gcalId: 'gcal-a1' },
      { id: 'a2', patientId: 'p2', start: at(0, 11), status: 'confirmed', treatmentId: null, reminders: {}, gcalId: 'gcal-a2' },
      { id: 'a3', patientId: 'p3', start: at(1, 10), status: 'scheduled', treatmentId: null, reminders: {}, gcalId: 'gcal-a3' },
      { id: 'a4', patientId: 'p4', start: at(1, 16), status: 'scheduled', treatmentId: 't2', reminders: {}, gcalId: 'gcal-a4' },
      { id: 'a5', patientId: 'p5', start: at(4, 12), status: 'scheduled', treatmentId: null, reminders: {}, gcalId: 'gcal-a5' },
      // citas pasadas con resultado marcado, para que las métricas tengan datos
      { id: 'a6', patientId: 'p6', start: ago(2, 10), status: 'completed', treatmentId: null, reminders: {}, gcalId: 'gcal-a6' },
      { id: 'a7', patientId: 'p7', start: ago(2, 12), status: 'no_show', treatmentId: null, reminders: {}, gcalId: 'gcal-a7' },
      { id: 'a8', patientId: 'p1', start: ago(1, 9), status: 'completed', treatmentId: null, reminders: {}, gcalId: 'gcal-a8' },
      { id: 'a9', patientId: 'p3', start: ago(1, 17), status: 'no_show', treatmentId: null, reminders: {}, gcalId: 'gcal-a9' },
    ],
    treatments: [
      // sesión 1 hace 10 días y sin siguiente cita -> disparará seguimiento en el primer tick
      { id: 't1', patientId: 'p2', name: 'Endodoncia', totalSessions: 3, sessionsCompleted: 1, status: 'active', createdAt: ago(12), lastCompletedAt: ago(10), followUpCount: 0, lastFollowUpAt: null, escalated: false },
      { id: 't2', patientId: 'p4', name: 'Ortodoncia', totalSessions: 6, sessionsCompleted: 2, status: 'active', createdAt: ago(30), lastCompletedAt: ago(2), followUpCount: 0, lastFollowUpAt: null, escalated: false },
      { id: 't3', patientId: 'p6', name: 'Limpieza', totalSessions: 1, sessionsCompleted: 1, status: 'completed', createdAt: ago(40), lastCompletedAt: ago(2), followUpCount: 0, lastFollowUpAt: null, escalated: false },
    ],
    waitlist: [
      { id: 'w1', patientId: 'p7', note: 'Prefiere por la mañana', status: 'waiting' },
      { id: 'w2', patientId: 'p8', note: 'Cualquier horario', status: 'waiting' },
    ],
    messages: [],
    alerts: [],
  };
}
