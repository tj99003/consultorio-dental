# Consultorio Dra. Laura — demo funcional

Reduce inasistencias (recordatorios automáticos por WhatsApp) y abandono de
tratamientos multi-sesión (seguimiento automático con escalado a la asistente).

## Correr

```bash
node server.js           # http://localhost:3000 (modo servidor, estado en data.json)
npm test                 # tests del motor de recordatorios/seguimiento
node scripts/reset.mjs   # regenerar datos de demo
```

Sin dependencias externas: Node 18+.

**Versión estática (GitHub Pages)**: la misma UI corre sin servidor — si
`/api/state` no responde, el frontend cambia a modo local y ejecuta la misma
lógica (`src/`) en el navegador, con el estado en `localStorage`. Basta abrir
`index.html` o publicar la raíz del repo en GitHub Pages.

## Cómo probar la demo

1. Abre la pestaña **Panel asistente** y pulsa `+1h`. Salen el recordatorio de la
   cita de las 9:00 y el seguimiento del tratamiento de endodoncia (10 días sin
   agendar la sesión 2/3).
2. En **WhatsApp (paciente)** elige un paciente y responde con los botones:
   confirmar, reprogramar o cancelar una cita; aceptar un espacio liberado;
   agendar la siguiente sesión de un tratamiento.
3. Cancela una cita: el sistema ofrece el hueco a la lista de espera; el primer
   paciente que acepta se lo queda.
4. Avanza `+24h` varias veces: la cita no confirmada se marca inasistencia, y el
   tratamiento sin respuesta escala a una **alerta** para que la asistente llame
   por teléfono (2 seguimientos sin respuesta, configurable).
5. Las tarjetas del panel muestran **tasa de inasistencia** y **tasa de
   finalización de tratamientos**.

## Arquitectura

```
public/            UI sin build: Panel asistente, simulador de WhatsApp, Agenda
server.js          HTTP + API REST; cada mutación persiste data.json
src/
  calendarProvider.js  Adaptador "Google Calendar" (listEvents/createEvent/updateEvent)
  whatsapp.js          Adaptador "WhatsApp Business API" (send/receive)
  scheduler.js         Motor por tick del reloj simulado: recordatorios por ventana
                       (72h/24h/2h), no-show automático, seguimiento de tratamientos,
                       escalado a alertas
  bot.js               Respuestas del paciente (botones) y reglas de negocio:
                       reprogramar, cancelar→lista de espera, agendar sesión
  slots.js             Horarios libres (L-S 9-18, citas de 1h)
  metrics.js           Tasa de inasistencia y de finalización
  seed.js / store.js   Datos de demo + persistencia JSON
data.json          Estado persistido (se genera solo)
test/              node:test del scheduler y el bot
```

**Reloj simulado**: el servidor mantiene `db.now` y `+1h/+24h` dispara el motor.
En producción sería un cron/cola de jobs (p. ej. Cloud Scheduler) llamando al
mismo `tick()`.

## Enchufar las integraciones reales

- **Google Calendar**: implementar `listEvents/createEvent/updateEvent` contra
  `calendar.events.list/insert/patch` (con `syncToken` para sync incremental).
  La agenda sigue siendo la fuente de verdad.
- **WhatsApp Business Cloud API**: `send()` → `POST graph.facebook.com/.../messages`
  con plantillas aprobadas (los botones se mapean a quick-replies); los mensajes
  entrantes llegarían por webhook a lo que hoy es `POST /api/messages/inbound`.

## Fuera de alcance (según el encargo)

Facturación, expediente clínico, apps instalables para el paciente.
