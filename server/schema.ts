// Esquema do banco e utilitários sem dependência do Node: usados pelo servidor (node:sqlite)
// e pela demonstração no navegador (SQLite em WebAssembly).

/** O mínimo de um banco SQLite síncrono (node:sqlite DatabaseSync ou o adaptador do sql.js). */
export interface Db {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
}

export const SCHEMA = `
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

/** Ajustes em bancos criados por versões anteriores. */
export function migrar(db: Db) {
  const cols = new Set((db.prepare('PRAGMA table_info(casos)').all() as { name: string }[]).map((c) => c.name));
  if (!cols.has('tipo_outro')) db.exec("ALTER TABLE casos ADD COLUMN tipo_outro TEXT NOT NULL DEFAULT ''");
  if (!cols.has('correcoes')) db.exec("ALTER TABLE casos ADD COLUMN correcoes TEXT NOT NULL DEFAULT '[]'");
  for (const c of ['vinculo', 'rnc', 'bo', 'operacao']) if (!cols.has(c)) db.exec(`ALTER TABLE casos ADD COLUMN ${c} TEXT NOT NULL DEFAULT ''`);
  // "Frota" passou a se chamar "Nosso condutor" em responsabilidade legal.
  db.exec(`UPDATE casos SET investigacao = replace(investigacao, '"responsabilidade":"Frota"', '"responsabilidade":"Nosso condutor"')`);
}

export function tx<T>(db: Db, fn: () => T): T {
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
