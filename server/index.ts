import path from 'node:path';
import { criarApp } from './app.ts';
import { DB_FILE, openDb } from './db.ts';
import { seed } from './seed.ts';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const prod = process.env.NODE_ENV === 'production';

const db = openDb();
if (seed(db)) console.log('[api] banco criado com os casos de exemplo');

const app = criarApp(db, { estatico: prod ? path.resolve(import.meta.dirname, '..', 'dist') : undefined });
app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}/api  ·  banco: ${DB_FILE}`);
  if (prod) console.log(`[app] http://localhost:${PORT}`);
});
