// Generación de horarios libres: consultorio abierto L-S, 9:00-18:00, citas de 1h.
export const ACTIVE = ['scheduled', 'confirmed', 'reschedule_requested'];

export function isFree(db, startISO) {
  const start = new Date(startISO).getTime();
  return !db.appointments.some(a => ACTIVE.includes(a.status) && new Date(a.start).getTime() === start);
}

export function freeSlots(db, n = 3) {
  const now = new Date(db.now);
  const slots = [];
  for (let day = 0; day < 14 && slots.length < n; day++) {
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    if (d.getDay() === 0) continue; // domingo cerrado
    for (let h = 9; h < 18 && slots.length < n; h++) {
      const s = new Date(d);
      s.setHours(h, 0, 0, 0);
      if (s <= now) continue;
      if (isFree(db, s.toISOString())) slots.push(s.toISOString());
    }
  }
  return slots;
}
