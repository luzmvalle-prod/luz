import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sinistros-test-'));
const { openDb } = await import('./db.ts');
const { Casos, HttpError } = await import('./casos.ts');
const { seed, USUARIOS } = await import('./seed.ts');
const { nivelDoCaso, avaliarJornada, EMPTY_DANOS } = await import('../shared/domain.ts');

function novo() {
  const db = openDb(':memory:');
  seed(db);
  return new Casos(db);
}
const [ana, fernanda] = USUARIOS;
const arquivo = { originalname: 'evidencia.pdf', size: 3, mimetype: 'application/pdf', buffer: Buffer.from('pdf') };
const registro = {
  propriedade: 'proprio' as const,
  placa: 'MHL-8D32',
  dataHora: '2026-09-01T10:00',
  motorista: 'Severino Batista',
  local: 'BR-101',
  tipo: 'Tombamento',
};

test('seed reproduz os indicadores do protótipo', () => {
  const svc = novo();
  const casos = svc.listar();
  assert.equal(casos.length, 5);
  const i = svc.indicadores();
  assert.equal(i.abertos, 3);
  assert.equal(i.acoesSemEvidencia, 2);
  assert.deepEqual(i.abertosPorEtapa, { classificacao: 1, investigacao: 1, acompanhamento: 1 });
});

test('nível do caso é o maior entre real e potencial', () => {
  assert.equal(nivelDoCaso({ real: { ...EMPTY_DANOS, carga: 1 }, pot: { ...EMPTY_DANOS, pessoas: 3 } }), 3);
  assert.equal(nivelDoCaso({ real: EMPTY_DANOS, pot: EMPTY_DANOS }), 0);
});

test('jornada segue a Lei 13.103', () => {
  assert.equal(avaliarJornada({ inicio: '05:30', horasTrabalhadasMin: 132, direcaoContinuaMin: 132, interjornadaMin: 665 }).dentro, true);
  assert.equal(avaliarJornada({ inicio: '05:30', horasTrabalhadasMin: 132, direcaoContinuaMin: 400, interjornadaMin: 600 }).violacoes.length, 2);
});

test('registro de veículo próprio congela os dados da plataforma', () => {
  const svc = novo();
  const c = svc.registrar(registro, [], ana);
  assert.equal(c.etapa, 'classificacao');
  assert.ok(c.dados && c.dados.eventos.length > 0);
  assert.equal(c.historico.at(-1)?.evento, 'Sinistro registrado');
});

test('registro de terceiro não puxa dados e exige proprietário', () => {
  const svc = novo();
  assert.throws(() => svc.registrar({ ...registro, propriedade: 'terceiro', placa: 'PKD-3F18' }, [], ana), HttpError);
  const c = svc.registrar({ ...registro, propriedade: 'terceiro', placa: 'PKD-3F18', terceiro: { proprietario: 'Transportes Lima', documento: '', cnh: '' } }, [], ana);
  assert.equal(c.dados, null);
});

test('placa fora da frota é recusada para veículo próprio', () => {
  assert.throws(() => novo().registrar({ ...registro, placa: 'ZZZ-0000' }, [], ana), /frota/);
});

test('abaixo de Grave o caso é concluído sem investigação', () => {
  const svc = novo();
  const c = svc.registrar(registro, [], ana);
  const r = svc.salvarClassificacao(c.id, { real: { ...EMPTY_DANOS, carga: 1 }, pot: { ...EMPTY_DANOS, carga: 1 }, justificativa: '' }, ana, true);
  assert.equal(r.etapa, 'concluido_sem_investigacao');
});

test('potencial maior que o real exige justificativa', () => {
  const svc = novo();
  const c = svc.registrar(registro, [], ana);
  assert.throws(() => svc.salvarClassificacao(c.id, { real: EMPTY_DANOS, pot: { ...EMPTY_DANOS, pessoas: 3 }, justificativa: '' }, ana, true), /Justifique/);
});

test('fluxo completo: investigação → evidência → conclusão', () => {
  const svc = novo();
  const c = svc.registrar(registro, [], ana);
  let r = svc.salvarClassificacao(c.id, { real: EMPTY_DANOS, pot: { ...EMPTY_DANOS, pessoas: 3 }, justificativa: 'Risco de óbito' }, ana, true);
  assert.equal(r.etapa, 'investigacao');
  assert.ok(r.investigacao.comiteData, 'comitê sugerido para o dia seguinte');

  assert.throws(() => svc.concluirInvestigacao(c.id, undefined, fernanda), (e: InstanceType<typeof HttpError>) => e.status === 422 && (e.detalhes?.length ?? 0) > 0);

  svc.criarAcao(c.id, { titulo: 'Treinar', responsavel: 'Fernanda Alves · Qualidade', prazo: '2026-12-01' }, fernanda);
  r = svc.concluirInvestigacao(
    c.id,
    { participantes: ['Fernanda Alves · Qualidade'], causaRaiz: 'Distração', certeza: 'Provável', evitabilidade: 'Evitável', responsabilidade: 'Frota' },
    fernanda,
  );
  assert.equal(r.etapa, 'acompanhamento');

  const acao = r.acoes[0];
  assert.throws(() => svc.concluirAcao(acao.id, fernanda), /evidência/);
  assert.throws(() => svc.concluirCaso(c.id, fernanda), /todas as ações/);
  assert.throws(() => svc.removerAcao(acao.id), /indisponível/, 'nada é apagado após a investigação');

  svc.anexarEvidencia(acao.id, arquivo, fernanda);
  svc.concluirAcao(acao.id, fernanda);
  r = svc.concluirCaso(c.id, fernanda);
  assert.equal(r.etapa, 'concluido');
  assert.ok(r.concluidoEm);

  assert.throws(() => svc.reabrir(c.id, '', fernanda), /motivo/);
  r = svc.reabrir(c.id, 'Novo laudo', fernanda);
  assert.equal(r.etapa, 'investigacao');
  assert.equal(r.historico[0].motivo, 'Novo laudo');
});

test('mudança no plano após a investigação exige motivo e vai para o histórico', () => {
  const svc = novo();
  const rtb = svc.listar().find((c) => c.placa === 'RTB-4E21')!;
  const a = svc.obter(rtb.id).acoes[0];
  assert.throws(() => svc.editarAcao(a.id, { titulo: a.titulo, responsavel: a.responsavel, prazo: '2026-10-20' }, ana), /motivo/);
  const r = svc.editarAcao(a.id, { titulo: a.titulo, responsavel: a.responsavel, prazo: '2026-10-20' }, ana, 'Fornecedor atrasou');
  assert.match(r.historico[0].evento, /prazo 10\/10\/2026 → 20\/10\/2026/);
});
