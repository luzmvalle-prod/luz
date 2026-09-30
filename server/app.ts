import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { TIPOS_SINISTRO } from '../shared/domain.ts';
import { Casos, HttpError, type RegistroInput } from './casos.ts';
import { FROTA, consultarPosicao } from './plataforma.ts';

const MAX_MB = 25;

export function criarApp(db: DatabaseSync, opts: { estatico?: string } = {}) {
  const svc = new Casos(db);
  const app = express();
  const upload = multer({ dest: path.join(os.tmpdir(), 'sinistros-upload'), limits: { fileSize: MAX_MB * 1024 * 1024, files: 20 } });

  app.use(express.json({ limit: '1mb' }));

  // Usuário atual: sem autenticação no ambiente local, escolhido no seletor da interface.
  const user = (req: Request) => svc.usuario(req.header('x-usuario') ?? undefined);
  const nomeArquivo = (f: Express.Multer.File) => ({ ...f, originalname: Buffer.from(f.originalname, 'latin1').toString('utf8') });

  const r = express.Router();
  r.get('/usuarios', (_q, s) => s.json(svc.usuarios()));
  r.get('/frota', (_q, s) => s.json(FROTA));
  r.get('/tipos', (_q, s) => s.json(TIPOS_SINISTRO));
  r.get('/plataforma/posicao', (q, s) => {
    const p = consultarPosicao(String(q.query.placa ?? ''), String(q.query.dataHora ?? ''));
    if (!p) throw new HttpError(404, 'Veículo sem equipamento INFLEET');
    s.json(p);
  });

  r.get('/indicadores', (_q, s) => s.json(svc.indicadores()));
  r.get('/casos', (_q, s) => s.json(svc.listar()));
  r.get('/casos/:id', (q, s) => s.json(svc.obter(q.params.id)));

  const lerRegistro = (q: Request) => {
    try {
      return JSON.parse(String(q.body.dados ?? '{}')) as RegistroInput;
    } catch {
      throw new HttpError(400, 'Dados do registro inválidos');
    }
  };
  // rascunho=1 salva o registro rápido (só placa e horário obrigatórios).
  r.post('/casos', upload.array('anexos'), (q, s) => {
    const files = ((q.files as Express.Multer.File[]) ?? []).map(nomeArquivo);
    s.status(201).json(svc.registrar(lerRegistro(q), files, user(q), undefined, { rascunho: q.body.rascunho === '1' }));
  });
  r.put('/casos/:id/registro', upload.array('anexos'), (q, s) => {
    const files = ((q.files as Express.Multer.File[]) ?? []).map(nomeArquivo);
    s.json(svc.registrar(lerRegistro(q), files, user(q), undefined, { rascunho: q.body.rascunho === '1', id: q.params.id }));
  });
  r.patch('/casos/:id/envolvidos/:indice', (q, s) => s.json(svc.atualizarLesao(q.params.id, Number(q.params.indice), q.body.lesao, q.body.motivo, user(q))));
  r.post('/casos/:id/eventos/:eventoId/correcao', (q, s) => s.json(svc.corrigirEvento(q.params.id, q.params.eventoId, q.body.corrigido, q.body.motivo, user(q))));
  r.patch('/casos/:id/identificacao', (q, s) => s.json(svc.editarIdentificacao(q.params.id, q.body.patch ?? {}, q.body.motivo, user(q))));
  r.post('/casos/:id/envolvidos', (q, s) => s.json(svc.adicionarEnvolvido(q.params.id, q.body, user(q))));
  r.post('/casos/:id/anexos', upload.array('anexos'), (q, s) => {
    const ctx = q.body.contexto === 'investigacao' ? 'investigacao' : 'registro';
    s.json(svc.anexar(q.params.id, ctx, ((q.files as Express.Multer.File[]) ?? []).map(nomeArquivo), user(q)));
  });

  r.put('/casos/:id/classificacao', (q, s) => s.json(svc.salvarClassificacao(q.params.id, q.body, user(q), false)));
  r.post('/casos/:id/classificacao/confirmar', (q, s) => s.json(svc.salvarClassificacao(q.params.id, q.body, user(q), true)));

  r.put('/casos/:id/investigacao', (q, s) => s.json(svc.salvarInvestigacao(q.params.id, q.body, user(q))));
  r.post('/casos/:id/investigacao/concluir', (q, s) => s.json(svc.concluirInvestigacao(q.params.id, q.body, user(q))));

  r.post('/casos/:id/acoes', (q, s) => s.json(svc.criarAcao(q.params.id, q.body, user(q), q.body.motivo ?? null)));
  r.put('/acoes/:id', (q, s) => s.json(svc.editarAcao(q.params.id, q.body, user(q), q.body.motivo ?? null)));
  r.delete('/acoes/:id', (q, s) => s.json(svc.removerAcao(q.params.id)));
  r.post('/acoes/:id/evidencia', upload.single('arquivo'), (q, s) => s.json(svc.anexarEvidencia(q.params.id, q.file && nomeArquivo(q.file), user(q))));
  r.post('/acoes/:id/concluir', (q, s) => s.json(svc.concluirAcao(q.params.id, user(q))));

  r.post('/casos/:id/concluir', (q, s) => s.json(svc.concluirCaso(q.params.id, user(q))));
  r.post('/casos/:id/reabrir', (q, s) => s.json(svc.reabrir(q.params.id, q.body.motivo, user(q))));
  r.get('/casos/:id/cat', (q, s) => {
    s.setHeader('Content-Disposition', `attachment; filename="cat-${q.params.id}.json"`);
    s.json(svc.exportarCAT(q.params.id));
  });

  r.get('/anexos/:id', (q, s) => {
    const { anexo, caminho } = svc.arquivoDoAnexo(q.params.id);
    if (!fs.existsSync(caminho)) throw new HttpError(404, 'Arquivo não encontrado no disco');
    s.setHeader('Content-Type', anexo.mime);
    s.setHeader('Content-Disposition', `${q.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`);
    fs.createReadStream(caminho).pipe(s);
  });

  app.use('/api', r);
  app.use('/api', (_q, s) => s.status(404).json({ erro: 'Rota não encontrada' }));

  if (opts.estatico && fs.existsSync(opts.estatico)) {
    app.use(express.static(opts.estatico));
    app.get('*', (_q, s) => s.sendFile(path.join(opts.estatico!, 'index.html')));
  }

  app.use((err: unknown, _q: Request, s: Response, _n: NextFunction) => {
    if (err instanceof HttpError) return s.status(err.status).json({ erro: err.message, detalhes: err.detalhes });
    if (err instanceof multer.MulterError)
      return s.status(413).json({ erro: err.code === 'LIMIT_FILE_SIZE' ? `Arquivo acima de ${MAX_MB} MB` : err.message });
    console.error(err);
    s.status(500).json({ erro: 'Erro interno' });
  });

  return app;
}
