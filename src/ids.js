export function nextId(db, prefix) {
  db.seq = (db.seq || 100) + 1;
  return `${prefix}${db.seq}`;
}
