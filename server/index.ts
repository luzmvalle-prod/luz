import path from 'node:path';
import { criarApp } from './app.ts';
import { DB_FILE, openDb } from './db.ts';
import { seed } from './seed.ts';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3789);
const prod = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';

const db = openDb();
if (seed(db)) console.log('[api] banco criado com os casos de exemplo');

const app = criarApp(db, { estatico: prod ? path.resolve(import.meta.dirname, '..', 'dist') : undefined });
const server = app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}/api  ·  banco: ${DB_FILE}`);
  console.log(prod ? `[app] abra http://localhost:${PORT}` : '[app] abra http://localhost:5173');
});
server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') console.error(`[api] A porta ${PORT} já está em uso. Feche o outro processo ou rode com API_PORT=3790.`);
  else console.error('[api] Não foi possível iniciar:', e.message);
  process.exit(1);
});
