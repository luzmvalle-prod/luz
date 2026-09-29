import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(import.meta.dirname, '..', 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_FILE = path.join(DATA_DIR, 'sinistros.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  setor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS veiculos (
  placa TEXT PRIMARY KEY,
  modelo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL,
  motorista TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS casos (
  id TEXT PRIMARY KEY,
  placa TEXT NOT NULL,
  modelo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL,
  propriedade TEXT NOT NULL CHECK (propriedade IN ('proprio','terceiro')),
  terceiro TEXT,
  motorista TEXT NOT NULL,
  data_hora TEXT NOT NULL,
  local TEXT NOT NULL,
  tipo TEXT NOT NULL,
  condicao_via TEXT NOT NULL,
  relato TEXT NOT NULL,
  envolvidos TEXT NOT NULL,
  etapa TEXT NOT NULL,
  nivel INTEGER NOT NULL,
  classificacao TEXT NOT NULL,
  investigacao TEXT NOT NULL,
  dados TEXT,
  registrado_por TEXT NOT NULL,
  registrado_em TEXT NOT NULL,
  concluido_por TEXT,
  concluido_em TEXT
);
CREATE TABLE IF NOT EXISTS anexos (
  id TEXT PRIMARY KEY,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  acao_id TEXT,
  contexto TEXT NOT NULL,
  nome TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  mime TEXT NOT NULL,
  arquivo TEXT NOT NULL,
  enviado_por TEXT NOT NULL,
  enviado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS acoes (
  id TEXT PRIMARY KEY,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  prazo TEXT NOT NULL,
  status TEXT NOT NULL,
  evidencia_id TEXT REFERENCES anexos(id),
  concluida_por TEXT,
  concluida_em TEXT
);
-- Histórico é só de inserção: nada é apagado.
CREATE TABLE IF NOT EXISTS historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  data TEXT NOT NULL,
  evento TEXT NOT NULL,
  autor TEXT NOT NULL,
  motivo TEXT
);
CREATE INDEX IF NOT EXISTS idx_acoes_caso ON acoes(caso_id);
CREATE INDEX IF NOT EXISTS idx_anexos_caso ON anexos(caso_id);
CREATE INDEX IF NOT EXISTS idx_hist_caso ON historico(caso_id);
`;

export function openDb(file = DB_FILE): DatabaseSync {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const TZ = process.env.TZ_SINISTROS ?? 'America/Recife';

/** Data e hora local no formato YYYY-MM-DDTHH:mm. */
export function agora(d = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const hoje = () => agora().slice(0, 10);
