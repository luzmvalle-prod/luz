import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA, migrar } from './schema.ts';

export { tx } from './schema.ts';
export { agora, hoje } from './tempo.ts';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(import.meta.dirname, '..', 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_FILE = path.join(DATA_DIR, 'sinistros.db');

export function openDb(file = DB_FILE): DatabaseSync {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrar(db);
  return db;
}
