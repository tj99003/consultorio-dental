const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const store = require('./src/store');
const scheduler = require('./src/scheduler');
const bot = require('./src/bot');
const cal = require('./src/calendarProvider');
const { metrics } = require('./src/metrics');
const { nextId } = require('./src/store');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

let db = store.load();
scheduler.tick(db); // tick inicial: dispara recordatorios/seguimientos ya vencidos
store.save(db);

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const routes = {
  'POST /api/time/advance': body => ({ now: scheduler.advance(db, body.hours || 1) }),
  'POST /api/reset': () => {
    db = store.reset();
    scheduler.tick(db); // mismo comportamiento que el arranque
    return { ok: true };
  },
  'POST /api/appointments': body => cal.createEvent(db, body),
  'POST /api/treatments': body => {
    const t = {
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
    };
    db.treatments.push(t);
    return t;
  },
  'POST /api/waitlist': body => {
    const w = { id: nextId(db, 'w'), patientId: body.patientId, note: body.note || '', status: 'waiting' };
    db.waitlist.push(w);
    return w;
  },
  'POST /api/config': body => {
    if (body.followUpDays) db.config.followUpDays = Number(body.followUpDays);
    if (body.escalationFollowUps) db.config.escalationFollowUps = Number(body.escalationFollowUps);
    if (body.reminderHours) {
      const hrs = String(body.reminderHours).split(',').map(x => Number(x.trim())).filter(x => x > 0);
      if (hrs.length) db.config.reminderHours = hrs;
    }
    return db.config;
  },
  'POST /api/messages/inbound': body => {
    if (body.action) bot.handleAction(db, body.patientId, body.action);
    else bot.handleText(db, body.patientId, body.text || '');
    return { ok: true };
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(state());

    // rutas con parámetro
    let m;
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/appointments\/(\w+)\/outcome$/))) {
      const body = await readBody(req);
      const r = bot.markOutcome(db, m[1], body.outcome);
      store.save(db);
      return r ? json(state()) : json({ error: 'not found' }, 404);
    }
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/alerts\/(\w+)\/resolve$/))) {
      const a = db.alerts.find(x => x.id === m[1]);
      if (a) a.resolved = true;
      store.save(db);
      return json(state());
    }

    const route = routes[`${req.method} ${url.pathname}`];
    if (route) {
      const body = await readBody(req);
      route(body);
      store.save(db);
      return json(state());
    }

    // estáticos
    if (req.method === 'GET') {
      const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
      if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        return res.end(fs.readFileSync(file));
      }
    }
    json({ error: 'not found' }, 404);
  } catch (e) {
    json({ error: String(e) }, 500);
  }
});

server.listen(PORT, () => console.log(`Consultorio dental — demo en http://localhost:${PORT}`));
