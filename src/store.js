import fs from 'node:fs';
import { seed } from './seed.js';

const FILE = new URL('../data.json', import.meta.url);

export function load() {
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

export function save(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function reset() {
  const db = seed();
  save(db);
  return db;
}
