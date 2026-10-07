// API da demonstração: as mesmas regras do servidor (server/casos.ts) rodando no navegador,
// sobre um SQLite em WebAssembly (sql.js), com os dados de exemplo. Substitui web/src/api.ts
// no build `npm run build:demo` (alias em vite.config.ts). Nada sai do navegador.

import initSqlJs, { type Database } from 'sql.js';
import wasmBase64 from 'virtual:sql-wasm';
import type { Caso, CasoResumo, Indicadores, Usuario } from '../../../shared/domain.ts';
import { Casos, HttpError, type ArquivoRecebido, type Arquivos, type RegistroInput } from '../../../server/casos.ts';
import { FROTA, consultarPosicao } from '../../../server/plataforma.ts';
import { SCHEMA, migrar, type Db } from '../../../server/schema.ts';
import { seed } from '../../../server/seed.ts';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detalhes: string[] = [],
  ) {
    super(message);
  }
}

const CHAVE_BANCO = 'sinistros-demo-v2';
const CHAVE_USUARIO = 'usuario';
const MAX_ARQUIVO = 2 * 1024 * 1024;

const ler = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const gravar = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* sem storage: a demonstração segue só em memória */
  }
};

let usuarioAtual = ler(CHAVE_USUARIO) ?? 'ana';
export const getUsuarioId = () => usuarioAtual;
export function setUsuarioId(id: string) {
  usuarioAtual = id;
  gravar(CHAVE_USUARIO, id);
}
export const SEM_API = 'A demonstração não conseguiu iniciar o banco local. Recarregue a página.';

// ---------------------------------------------------------------- banco no navegador

/** Adapta o sql.js à interface síncrona usada pelo serviço (a mesma do node:sqlite). */
function adaptar(raw: Database): Db {
  const norm = (p: unknown[]) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)) as (string | number | null | Uint8Array)[];
  return {
    exec: (sql) => raw.exec(sql),
    prepare: (sql) => {
      const all = (...p: unknown[]) => {
        const st = raw.prepare(sql);
        st.bind(norm(p));
        const rows: unknown[] = [];
        while (st.step()) rows.push(st.getAsObject());
        st.free();
        return rows;
      };
      return { all, get: (...p) => all(...p)[0], run: (...p) => raw.run(sql, norm(p)) };
    },
  };
}

const base64 = {
  de: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
  para: (b: Uint8Array) => {
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(s);
  },
};

interface Estado {
  raw: Database;
  db: Db;
  svc: Casos;
}

const arquivosNoBanco = (db: () => Db): Arquivos => ({
  salvar(arquivo, f) {
    db().prepare('INSERT INTO demo_arquivos (arquivo, dados) VALUES (?, ?)').run(arquivo, f.buffer ?? new Uint8Array());
  },
});

async function iniciar(): Promise<Estado> {
  const SQL = await initSqlJs({ wasmBinary: base64.de(wasmBase64).buffer as ArrayBuffer });
  const salvo = ler(CHAVE_BANCO);
  let raw: Database;
  try {
    raw = salvo ? new SQL.Database(base64.de(salvo)) : new SQL.Database();
  } catch {
    raw = new SQL.Database();
  }
  const db = adaptar(raw);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  db.exec('CREATE TABLE IF NOT EXISTS demo_arquivos (arquivo TEXT PRIMARY KEY, dados BLOB NOT NULL)');
  migrar(db);
  let estado: Estado | null = null;
  const arquivos = arquivosNoBanco(() => estado!.db);
  estado = { raw, db, svc: new Casos(db, arquivos) };
  if (seed(db, arquivos)) persistir(estado);
  estadoAtual = estado;
  return estado;
}

function persistir(e: Estado) {
  gravar(CHAVE_BANCO, base64.para(e.raw.export()));
}

let estadoAtual: Estado | null = null;
let pronto = iniciar();

/** Apaga o que foi feito na demonstração e volta aos casos de exemplo. */
export async function reiniciarDemo() {
  gravar(CHAVE_BANCO, null);
  pronto = iniciar();
  await pronto;
}

async function chamar<T>(fn: (svc: Casos) => T, muda = false): Promise<T> {
  const e = await pronto.catch(() => {
    throw new ApiError(SEM_API, 0);
  });
  try {
    const r = fn(e.svc);
    if (muda) persistir(e);
    // Cópia profunda, como uma resposta HTTP: a interface nunca segura referências do banco.
    return structuredClone(r);
  } catch (err) {
    if (err instanceof HttpError) throw new ApiError(err.message, err.status, err.detalhes ?? []);
    throw new ApiError(err instanceof Error ? err.message : 'Erro inesperado', 500);
  }
}

const usuario = (svc: Casos) => svc.usuario(usuarioAtual);

async function receber(files: File[]): Promise<ArquivoRecebido[]> {
  for (const f of files) if (f.size > MAX_ARQUIVO) throw new ApiError(`Na demonstração, cada arquivo pode ter até 2 MB (${f.name})`, 413);
  return Promise.all(files.map(async (f) => ({ originalname: f.name, size: f.size, mimetype: f.type || 'application/octet-stream', buffer: new Uint8Array(await f.arrayBuffer()) })));
}

async function registroDe(fd: FormData) {
  const dados = JSON.parse(String(fd.get('dados') ?? '{}')) as RegistroInput;
  const arquivos = await receber(fd.getAll('anexos').filter((x): x is File => x instanceof File));
  return { dados, arquivos, rascunho: fd.get('rascunho') === '1' };
}

// ---------------------------------------------------------------- mesma interface de web/src/api.ts

export const api = {
  usuarios: () => chamar<Usuario[]>((s) => s.usuarios()),
  frota: () => Promise.resolve(FROTA.map(({ placa, modelo, unidade, motorista }) => ({ placa, modelo, unidade, motorista }))),
  posicao: (placa: string, dataHora: string) => {
    const p = consultarPosicao(placa, dataHora);
    return p ? Promise.resolve(p) : Promise.reject(new ApiError('Veículo sem equipamento INFLEET', 404));
  },
  indicadores: () => chamar<Indicadores>((s) => s.indicadores()),
  casos: () => chamar<CasoResumo[]>((s) => s.listar()),
  caso: (id: string) => chamar<Caso>((s) => s.obter(id)),
  registrar: async (fd: FormData) => {
    const r = await registroDe(fd);
    return chamar<Caso>((s) => s.registrar(r.dados, r.arquivos, usuario(s), undefined, { rascunho: r.rascunho }), true);
  },
  salvarRegistro: async (id: string, fd: FormData) => {
    const r = await registroDe(fd);
    return chamar<Caso>((s) => s.registrar(r.dados, r.arquivos, usuario(s), undefined, { rascunho: r.rascunho, id }), true);
  },
  atualizarLesao: (id: string, indice: number, lesao: string, motivo: string) => chamar<Caso>((s) => s.atualizarLesao(id, indice, lesao, motivo, usuario(s)), true),
  corrigirEvento: (id: string, eventoId: string, corrigido: string, motivo: string) => chamar<Caso>((s) => s.corrigirEvento(id, eventoId, corrigido, motivo, usuario(s)), true),
  editarIdentificacao: (id: string, patch: object, motivo: string) => chamar<Caso>((s) => s.editarIdentificacao(id, patch, motivo, usuario(s)), true),
  adicionarEnvolvido: (id: string, env: object) => chamar<Caso>((s) => s.adicionarEnvolvido(id, env as never, usuario(s)), true),
  anexar: async (id: string, contexto: 'registro' | 'investigacao', files: File[]) => {
    const arqs = await receber(files);
    return chamar<Caso>((s) => s.anexar(id, contexto, arqs, usuario(s)), true);
  },
  salvarClassificacao: (id: string, c: object) => chamar<Caso>((s) => s.salvarClassificacao(id, c as never, usuario(s), false), true),
  confirmarClassificacao: (id: string, c: object) => chamar<Caso>((s) => s.salvarClassificacao(id, c as never, usuario(s), true), true),
  salvarInvestigacao: (id: string, inv: object) => chamar<Caso>((s) => s.salvarInvestigacao(id, inv, usuario(s)), true),
  concluirInvestigacao: (id: string, inv: object) => chamar<Caso>((s) => s.concluirInvestigacao(id, inv, usuario(s)), true),
  criarAcao: (id: string, a: object) => chamar<Caso>((s) => s.criarAcao(id, a as never, usuario(s), (a as { motivo?: string }).motivo ?? null), true),
  editarAcao: (acaoId: string, a: object) => chamar<Caso>((s) => s.editarAcao(acaoId, a as never, usuario(s), (a as { motivo?: string }).motivo ?? null), true),
  removerAcao: (acaoId: string) => chamar<Caso>((s) => s.removerAcao(acaoId), true),
  anexarEvidencia: async (acaoId: string, f: File) => {
    const [arq] = await receber([f]);
    return chamar<Caso>((s) => s.anexarEvidencia(acaoId, arq, usuario(s)), true);
  },
  concluirAcao: (acaoId: string) => chamar<Caso>((s) => s.concluirAcao(acaoId, usuario(s)), true),
  concluirCaso: (id: string) => chamar<Caso>((s) => s.concluirCaso(id, usuario(s)), true),
  reabrir: (id: string, motivo: string) => chamar<Caso>((s) => s.reabrir(id, motivo, usuario(s)), true),
  cat: (id: string) => chamar<object>((s) => s.exportarCAT(id)),
};

const urls = new Map<string, string>();
/** Anexos da demonstração viram links blob: gerados a partir do banco local. */
export const urlAnexo = (id: string) => {
  if (urls.has(id)) return urls.get(id)!;
  const e = estadoAtual;
  if (!e) return '#';
  try {
    const { anexo, arquivo } = e.svc.arquivoDoAnexo(id);
    const row = e.db.prepare('SELECT dados FROM demo_arquivos WHERE arquivo = ?').get(arquivo) as { dados: Uint8Array } | undefined;
    if (!row) return '#';
    const url = URL.createObjectURL(new Blob([row.dados as BlobPart], { type: anexo.mime }));
    urls.set(id, url);
    return url;
  } catch {
    return '#';
  }
};
