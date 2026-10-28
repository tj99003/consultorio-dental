// Regenera data.json con los datos semilla: `node scripts/reset.mjs`
import { writeFileSync } from 'node:fs';
import { seed } from '../src/seed.js';

writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(seed(), null, 2));
console.log('data.json regenerado');
