import fs from 'node:fs';
import { DATA_DIR, openDb } from './db.ts';
import { seed } from './seed.ts';

fs.rmSync(DATA_DIR, { recursive: true, force: true });
seed(openDb());
console.log(`Banco recriado com os casos de exemplo em ${DATA_DIR}`);
