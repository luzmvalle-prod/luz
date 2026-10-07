import fs from 'node:fs';
import { DATA_DIR, openDb } from './db.ts';
import { seed } from './seed.ts';
import { arquivosEmDisco } from './arquivos-disco.ts';

fs.rmSync(DATA_DIR, { recursive: true, force: true });
seed(openDb(), arquivosEmDisco);
console.log(`Banco recriado com os casos de exemplo em ${DATA_DIR}`);
