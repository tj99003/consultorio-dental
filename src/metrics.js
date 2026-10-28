// Métricas del prompt: tasa de inasistencia y tasa de finalización de tratamientos.
export function metrics(db) {
  const decided = db.appointments.filter(a => a.status === 'completed' || a.status === 'no_show');
  const noShows = decided.filter(a => a.status === 'no_show').length;
  const noShowRate = decided.length ? noShows / decided.length : 0;

  const total = db.treatments.length;
  const finished = db.treatments.filter(t => t.status === 'completed').length;
  const completionRate = total ? finished / total : 0;

  return {
    noShowRate,
    noShows,
    decidedAppointments: decided.length,
    completionRate,
    finishedTreatments: finished,
    totalTreatments: total,
  };
}
