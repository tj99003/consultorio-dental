const fs = require('node:fs');
const path = require('node:path');
const { seed } = require('./seed');

const FILE = path.join(__dirname, '..', 'data.json');

function load() {
  if (fs.existsSync(FILE)) {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      // archivo corrupto: re-sembrar
    }
  }
  const db = seed();
  save(db);
  return db;
}

function save(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function reset() {
  const db = seed();
  save(db);
  return db;
}

function nextId(db, prefix) {
  db.seq = (db.seq || 100) + 1;
  return `${prefix}${db.seq}`;
}

module.exports = { load, save, reset, nextId };
