# Prompt v3 — Consultorio dental (refinado tras iteración de UI)

Tu tarea: construye una aplicación funcional que reduzca las inasistencias de
pacientes y asegure que terminen sus tratamientos de varias sesiones en un
consultorio dental pequeño. Debe correr con un solo comando, sin depender de
servicios externos, y poder probarse de extremo a extremo.

Contexto: la Dra. Laura atiende un consultorio con una asistente. Las citas se
agendan en Google Calendar y eso funciona bien — la agenda se queda ahí. Cerca
del 30% de los pacientes no llega a su cita y esos espacios se pierden. Además,
los tratamientos de varias sesiones (endodoncias, ortodoncia) se abandonan a la
mitad porque el paciente deja de sentir dolor y nadie le da seguimiento. Hoy la
asistente invierte buena parte de la mañana enviando recordatorios por WhatsApp
uno por uno.

## Requisitos funcionales

1. Leer las citas de Google Calendar (fuente de verdad; no se reemplaza). Si no
   hay acceso a la API real, abstráela detrás de un adaptador simulado que deje
   claro dónde se conectaría la integración real. Lo mismo para WhatsApp.
2. Enviar recordatorios por WhatsApp con cadencia configurable (p. ej. 72h, 24h
   y 2h antes). Cada cita recibe un solo recordatorio por ventana. El paciente
   responde con botones — confirmar, reprogramar o cancelar — y su respuesta
   actualiza el estado de la cita.
3. "Reprogramar" muestra los siguientes horarios libres para que el paciente
   elija uno.
4. Al cancelarse una cita, el horario liberado se ofrece a la lista de espera;
   el primer paciente en aceptar se lo queda.
5. Tratamientos multi-sesión: registrar el plan (nombre, total de sesiones).
   Si pasan N días (configurable, p. ej. 7) desde la última sesión sin que el
   paciente agende la siguiente, enviarle seguimiento por WhatsApp. Tras 2
   seguimientos sin respuesta (configurable), crear una alerta para que la
   asistente llame por teléfono.
6. La asistente marca el resultado de cada cita (asistió / no llegó). Las
   citas vencidas que nunca se confirmaron cuentan como inasistencia.
7. Panel de la asistente: citas del día con su estado, tratamientos con su
   avance (sesión x de n), alertas pendientes y las dos métricas de abajo.

## Interfaz

La app la usará el personal del consultorio, no técnicos. La interfaz debe
verse como un sistema real y amigable:

- Pantalla de login con perfiles (asistente y doctora). Para la demo basta una
  contraseña fija visible en pantalla — no hace falta auth real.
- Navegación por secciones con menú visible (panel, agenda, pacientes,
  tratamientos, configuración), no una sola pantalla con todo amontonado.
- Estética cuidada: paleta sobria y acogedora (tipo clínica, no dashboard
  genérico), tipografía legible, tarjetas y estados visuales claros para cada
  estado de cita.
- La cadencia de recordatorios y los umbrales de seguimiento se editan desde
  la vista de configuración.

## Cómo se demuestra (obligatorio)

- Incluye un mecanismo para avanzar el tiempo (reloj simulado o equivalente) de
  modo que los recordatorios y seguimientos se disparen sin esperar horas reales.
- Incluye una vista que simule el teléfono del paciente, donde se vean los
  mensajes enviados y se pueda responder con los botones.
- Incluye datos semilla que ejerciten todos los flujos: citas de hoy, una cita
  a punto de vencer, un tratamiento con seguimiento vencido y una lista de
  espera con pacientes.

## Criterios de aceptación y su verificación

- Agendar una cita dispara los recordatorios sin intervención manual (se verifica
  avanzando el reloj simulado).
- Responder por el teléfono simulado actualiza el estado visible en el panel.
- Cancelar ofrece el hueco a la lista de espera y solo el primero en aceptar lo
  ocupa.
- Un tratamiento sin siguiente sesión genera seguimiento automático; 2
  seguimientos sin respuesta generan la alerta en el panel.
- El panel reporta con datos reales: tasa de inasistencia y tasa de
  finalización de tratamientos.

## Restricciones

- Los pacientes interactúan solo por WhatsApp; no instalan ninguna app.
- Solución para un solo consultorio con dos usuarias internas.
- Fuera de alcance: facturación y expediente clínico.

## Entrega

Código de la app + README con cómo correrla y una breve descripción de la
arquitectura, indicando dónde se conectarían las APIs reales de WhatsApp y
Google Calendar.
