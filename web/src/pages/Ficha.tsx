import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CONDICOES_VIA, DIMENSOES, ETAPA_LABEL, LESOES, NIVEIS, TIPOS_SINISTRO, diasDesde, nivelPelasLesoes, origemDoNivel, tipoLabel, type Caso } from '../../../shared/domain.ts';
import { EventosTabela, HistoricoMotoristaTabela, VeiculoBloco } from '../components/eventos.tsx';
import { api } from '../api.ts';
import { CasoGate, CasoHeader, useCaso, useMutacao } from '../components/caso.tsx';
import { AnexoItem, Card, Field, Modal, useToast } from '../components/ui.tsx';
import { fmtData, fmtDataHora, rotaDaEtapa } from '../format.ts';
import { StatusAcao } from './Acompanhamento.tsx';
import { ReabrirModal, exportarCAT } from './Conclusao.tsx';
import { JornadaTabela } from './Investigacao.tsx';
import { EnvolvidoModal } from './Registro.tsx';

const TABS = [
  ['resumo', 'Resumo'],
  ['dados', 'Dados coletados'],
  ['invest', 'Investigação'],
  ['plano', 'Plano de ação'],
  ['hist', 'Histórico'],
] as const;
type Tab = (typeof TABS)[number][0];

export function Ficha() {
  const { caso, setCaso, erro } = useCaso();
  return (
    <CasoGate caso={caso} erro={erro} etapas={['classificacao', 'investigacao', 'acompanhamento', 'concluido', 'concluido_sem_investigacao']}>
      {(c) => <Tela caso={c} setCaso={setCaso} />}
    </CasoGate>
  );
}

function Tela({ caso, setCaso }: { caso: Caso; setCaso: (c: Caso) => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('resumo');
  const [editar, setEditar] = useState(false);
  const [envModal, setEnvModal] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const [lesaoIdx, setLesaoIdx] = useState<number | null>(null);
  const { run } = useMutacao(setCaso);
  const aberto = !caso.etapa.startsWith('concluido');

  return (
    <>
      <CasoHeader
        caso={caso}
        eyebrow="Ficha do caso"
        titulo={tipoLabel(caso)}
        semFicha
        actions={
          <>
            <Link className="btn outline" to={`/sinistros/${caso.id}/relatorio`}>
              Exportar PDF
            </Link>
            <button className="btn outline" onClick={() => exportarCAT(caso, toast)}>
              Dados da CAT
            </button>
            {!aberto && (
              <button className="btn outline" onClick={() => setReabrir(true)}>
                Reabrir caso
              </button>
            )}
          </>
        }
      />
      <div className="content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {aberto && (
          <div className="next-step">
            <span>
              <span className="hint" style={{ color: 'var(--muted)' }}>
                Próximo passo ·{' '}
              </span>
              <strong>{caso.proximoPasso}</strong> <span className="hint">({ETAPA_LABEL[caso.etapa]})</span>
            </span>
            <Link className="btn sm" to={rotaDaEtapa(caso.id, caso.etapa)}>
              {caso.etapa === 'acompanhamento' ? 'Ir para ações' : `Ir para ${ETAPA_LABEL[caso.etapa].toLowerCase()}`}
            </Link>
          </div>
        )}

        <div className="tabs inline" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
              {k === 'hist' && <span className="count">{caso.historico.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'resumo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <Card
              title="Identificação"
              right={
                aberto && (
                  <button className="btn ghost sm" onClick={() => setEditar(true)}>
                    Corrigir dados
                  </button>
                )
              }
            >
              <dl className="kv">
                <dt>Caso</dt>
                <dd>{caso.id}</dd>
                <dt>Data e hora</dt>
                <dd>{fmtDataHora(caso.dataHora)}</dd>
                <dt>Local</dt>
                <dd>{caso.local}</dd>
                <dt>Veículo</dt>
                <dd>
                  {caso.placa} · {caso.modelo} · {caso.categoria}
                </dd>
                <dt>Motorista</dt>
                <dd>{caso.motorista}</dd>
                <dt>Propriedade</dt>
                <dd>{caso.propriedade === 'proprio' ? 'Própria da frota' : 'De terceiro'}</dd>
                {caso.terceiro && (
                  <>
                    <dt>Proprietário</dt>
                    <dd>
                      {caso.terceiro.proprietario} {caso.terceiro.documento && `· ${caso.terceiro.documento}`}
                    </dd>
                    <dt>CNH do motorista</dt>
                    <dd>{caso.terceiro.cnh || '—'}</dd>
                  </>
                )}
                <dt>Tipo</dt>
                <dd>{tipoLabel(caso)}</dd>
                <dt>Condição da via</dt>
                <dd>{caso.condicaoVia}</dd>
                <dt>Relato do motorista</dt>
                <dd>{caso.relato || '—'}</dd>
                <dt>Registrado por</dt>
                <dd>
                  {caso.registradoPor} · {fmtDataHora(caso.registradoEm)}
                </dd>
              </dl>
            </Card>
            <div className="col">
              <Card title="Classificação">
                <p className="hint">Nível do caso: o maior entre real e potencial.</p>
                <table className="table flush">
                  <thead>
                    <tr>
                      <th>Dimensão</th>
                      <th>Dano real</th>
                      <th>Dano potencial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIMENSOES.map((d) => (
                      <tr key={d.key}>
                        <td>{d.label}</td>
                        <td className="muted">{NIVEIS[caso.classificacao.real[d.key]]}</td>
                        <td className="muted">{NIVEIS[caso.classificacao.pot[d.key]]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="note">
                  <strong>
                    {NIVEIS[caso.nivel]} pelo {origemDoNivel(caso.classificacao)}
                  </strong>
                  {caso.classificacao.justificativa && `: ${caso.classificacao.justificativa}`}
                  {!caso.classificacao.confirmada && ' (rascunho, ainda não confirmada)'}
                </div>
              </Card>
              <Card
                title="Envolvidos"
                right={
                  <button className="btn ghost sm" onClick={() => setEnvModal(true)}>
                    Adicionar envolvido
                  </button>
                }
              >
                {caso.classificacao.confirmada && nivelPelasLesoes(caso.envolvidos) > caso.classificacao.real.pessoas && (
                  <div className="note warn">
                    A lesão registrada indica dano real <strong>{NIVEIS[nivelPelasLesoes(caso.envolvidos)]}</strong> em Pessoas, mas a classificação está como{' '}
                    <strong>{NIVEIS[caso.classificacao.real.pessoas]}</strong>. {aberto ? 'Revise a classificação com o comitê.' : 'Reabra o caso para revisar a classificação.'}
                  </div>
                )}
                <table className="table flush">
                  <thead>
                    <tr>
                      <th>Envolvido</th>
                      <th>Papel</th>
                      <th>Veículo</th>
                      <th>Lesão</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {caso.envolvidos.map((e, i) => (
                      <tr key={i}>
                        <td>{e.nome}</td>
                        <td className="muted">{e.papel}</td>
                        <td className="muted">{e.veiculo || '—'}</td>
                        <td className="muted">{e.lesao}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn ghost sm" onClick={() => setLesaoIdx(i)}>
                            Atualizar lesão
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint">A lesão pode ser atualizada a qualquer momento, inclusive com o caso concluído (ex.: lesão grave que evolui para óbito).</p>
              </Card>
              <Card title="Anexos">
                {caso.anexos.length === 0 && <span className="hint">Nenhum anexo.</span>}
                {caso.anexos.map((a) => (
                  <AnexoItem key={a.id} a={a} />
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab === 'dados' && (
          <DadosTab caso={caso} onCorrigir={async (eventoId, corrigido, motivo) => !!(await run(() => api.corrigirEvento(caso.id, eventoId, corrigido, motivo), 'Evento corrigido'))} />
        )}
        {tab === 'invest' && <InvestTab caso={caso} />}

        {tab === 'plano' && (
          <Card title="Plano de ação">
            <p className="help">O caso só encerra quando todas as ações estiverem concluídas com evidência.</p>
            {caso.acoes.length === 0 ? (
              <span className="hint">Nenhuma ação.</span>
            ) : (
              <table className="table flush">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th>Evidência</th>
                  </tr>
                </thead>
                <tbody>
                  {caso.acoes.map((a) => (
                    <tr key={a.id}>
                      <td>{a.titulo}</td>
                      <td className="muted">{a.responsavel}</td>
                      <td className="muted">{fmtData(a.prazo)}</td>
                      <td>
                        <StatusAcao a={a} />
                      </td>
                      <td>{a.evidencia ? <AnexoLink id={a.evidencia.id} nome={a.evidencia.nome} /> : caso.etapa === 'acompanhamento' ? <Link to={`/sinistros/${caso.id}/acompanhamento`}>Anexar</Link> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === 'hist' && (
          <Card title="Histórico">
            <p className="help">Nada é apagado. Cada mudança guarda autor, data e motivo.</p>
            <table className="table flush">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Data</th>
                  <th>Evento</th>
                  <th>Motivo</th>
                  <th>Autor</th>
                </tr>
              </thead>
              <tbody>
                {caso.historico.map((h) => (
                  <tr key={h.id}>
                    <td className="muted">{fmtDataHora(h.data)}</td>
                    <td>{h.evento}</td>
                    <td className="muted">{h.motivo ?? '—'}</td>
                    <td className="muted">{h.autor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {editar && <EditarModal caso={caso} onClose={() => setEditar(false)} onSave={(patch, motivo) => run(() => api.editarIdentificacao(caso.id, patch, motivo), 'Dados corrigidos').then((c) => c && setEditar(false))} />}
      {lesaoIdx !== null && (
        <LesaoModal
          caso={caso}
          indice={lesaoIdx}
          onClose={() => setLesaoIdx(null)}
          onSave={(lesao, motivo) => run(() => api.atualizarLesao(caso.id, lesaoIdx, lesao, motivo), 'Lesão atualizada').then((c) => c && setLesaoIdx(null))}
        />
      )}
      {envModal && <EnvolvidoModal onClose={() => setEnvModal(false)} onSave={(e) => run(() => api.adicionarEnvolvido(caso.id, e), 'Envolvido adicionado').then((c) => c && setEnvModal(false))} />}
      {reabrir && (
        <ReabrirModal
          caso={caso}
          onClose={() => setReabrir(false)}
          onDone={(c) => {
            setCaso(c);
            nav(rotaDaEtapa(c.id, c.etapa));
          }}
        />
      )}
    </>
  );
}

const AnexoLink = ({ id, nome }: { id: string; nome: string }) => (
  <a href={`/api/anexos/${id}`} target="_blank" rel="noreferrer">
    {nome}
  </a>
);

export function DadosTab({ caso, onCorrigir }: { caso: Caso; onCorrigir?: (eventoId: string, corrigido: string, motivo: string) => Promise<boolean> }) {
  const d = caso.dados;
  if (!d)
    return (
      <Card title="Dados coletados">
        <div className="note">Veículo de terceiro, sem equipamento INFLEET: não há dados da plataforma. Os documentos fornecidos estão nos anexos.</div>
      </Card>
    );
  const at = fmtDataHora(d.coletadoEm);
  return (
    <Card title="Dados coletados">
      <p className="help">Congelados na abertura do caso ({at}). Cada valor mostra de onde veio.</p>
      <table className="table flush">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Valor</th>
            <th>Fonte</th>
            <th>Coletado em</th>
          </tr>
        </thead>
        <tbody>
          {d.grupos.map((g) => (
            <GrupoRows key={g.nome} nome={g.nome} rows={g.itens.map((i) => [i.campo, i.valor, i.fonte, i.coletadoEm])} />
          ))}
        </tbody>
      </table>
      <div className="stack" style={{ gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Eventos da viagem</h3>
        <EventosTabela caso={caso} onCorrigir={onCorrigir} />
      </div>
      {d.jornada && <JornadaTabela jornada={d.jornada} />}
      <HistoricoMotoristaTabela historico={d.historico30d} km30d={d.km30d} />
      <VeiculoBloco veiculo={d.veiculo} />
      {d.observacoes.map((o) => (
        <div key={o} className="note warn">
          {o}
        </div>
      ))}
    </Card>
  );
}

function GrupoRows({ nome, rows }: { nome: string; rows: string[][] }) {
  return (
    <>
      <tr className="group">
        <td colSpan={4} style={{ paddingLeft: 8 }}>
          {nome}
        </td>
      </tr>
      {rows.map((r, i) => (
        <tr key={i}>
          <td>{r[0]}</td>
          <td style={{ fontWeight: 500 }}>{r[1]}</td>
          <td className="muted">{r[2]}</td>
          <td className="muted">{r[3]}</td>
        </tr>
      ))}
    </>
  );
}

export function InvestTab({ caso }: { caso: Caso }) {
  const inv = caso.investigacao;
  if (caso.etapa === 'classificacao' || caso.etapa === 'concluido_sem_investigacao')
    return (
      <Card title="Investigação">
        <div className="note">{caso.etapa === 'classificacao' ? 'O caso ainda não foi classificado.' : 'Caso abaixo do nível de investigação.'}</div>
      </Card>
    );
  const evidencias = caso.dados?.eventos.filter((e) => inv.evidencias.includes(e.id)) ?? [];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div className="col">
        <Card title="Relato e constatação">
          <dl className="kv">
            <dt>Relato do motorista</dt>
            <dd>{caso.relato || '—'}</dd>
            <dt>Constatado pelo comitê</dt>
            <dd>{inv.constatado || '—'}</dd>
          </dl>
        </Card>
        <Card title="Hipóteses e fatores">
          <table className="table flush">
            <thead>
              <tr>
                <th>Item</th>
                <th>Descrição</th>
                <th>Evidência</th>
              </tr>
            </thead>
            <tbody>
              {inv.hipoteses.map((h) => (
                <tr key={h.id}>
                  <td className="muted">{h.tipo}</td>
                  <td>{h.descricao}</td>
                  <td className="muted">{h.evidencia || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <div className="col">
        <Card title="Conclusão">
          <dl className="kv">
            <dt>Causa raiz</dt>
            <dd>{inv.causaRaiz || '—'}</dd>
            <dt>Grau de certeza</dt>
            <dd>{inv.certeza || '—'}</dd>
            <dt>Evitabilidade</dt>
            <dd>{inv.evitabilidade || '—'}</dd>
            <dt>Responsabilidade legal</dt>
            <dd>{inv.responsabilidade || '—'}</dd>
            <dt>Comitê</dt>
            <dd>{inv.participantes.join(', ') || '—'}</dd>
            <dt>Data da análise</dt>
            <dd>{fmtData(inv.comiteData)}</dd>
          </dl>
        </Card>
        <Card title="Evidências marcadas">
          {evidencias.length === 0 ? (
            <span className="hint">Nenhum evento marcado como evidência.</span>
          ) : (
            <div className="rows">
              {evidencias.map((e) => (
                <div className="r" key={e.id}>
                  <span className="k">{e.horario}</span>
                  <span className="v">{e.evento}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function EditarModal({ caso, onClose, onSave }: { caso: Caso; onClose: () => void; onSave: (patch: object, motivo: string) => void }) {
  const [p, setP] = useState({ motorista: caso.motorista, local: caso.local, tipo: caso.tipo, tipoOutro: caso.tipoOutro, condicaoVia: caso.condicaoVia, dataHora: caso.dataHora, relato: caso.relato });
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      title="Corrigir dados do registro"
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!motivo.trim()} onClick={() => onSave(p, motivo)}>
            Salvar correção
          </button>
        </>
      }
    >
      <p className="hint">Dados coletados da plataforma não mudam: ficam congelados como na abertura do caso.</p>
      <div className="grid2">
        <Field label="Data e hora" htmlFor="ed-dh">
          <input id="ed-dh" type="datetime-local" className="input" value={p.dataHora} onChange={(e) => setP({ ...p, dataHora: e.target.value })} />
        </Field>
        <Field label="Motorista" htmlFor="ed-mot">
          <input id="ed-mot" className="input" value={p.motorista} onChange={(e) => setP({ ...p, motorista: e.target.value })} />
        </Field>
        <Field label="Tipo" htmlFor="ed-tipo">
          <select id="ed-tipo" className="select" value={p.tipo} onChange={(e) => setP({ ...p, tipo: e.target.value })}>
            {TIPOS_SINISTRO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {p.tipo === 'Outro' && (
          <Field label="Descreva o tipo" htmlFor="ed-tipo-outro">
            <input id="ed-tipo-outro" className="input" value={p.tipoOutro} onChange={(e) => setP({ ...p, tipoOutro: e.target.value })} />
          </Field>
        )}
        <Field label="Condição da via" htmlFor="ed-via">
          <select id="ed-via" className="select" value={p.condicaoVia} onChange={(e) => setP({ ...p, condicaoVia: e.target.value })}>
            {CONDICOES_VIA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Local" htmlFor="ed-local">
        <input id="ed-local" className="input" value={p.local} onChange={(e) => setP({ ...p, local: e.target.value })} />
      </Field>
      <Field label="Relato do motorista" htmlFor="ed-relato">
        <textarea id="ed-relato" className="textarea" rows={2} value={p.relato} onChange={(e) => setP({ ...p, relato: e.target.value })} />
      </Field>
      <Field label="Motivo da correção" htmlFor="ed-motivo">
        <textarea id="ed-motivo" className="textarea" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Fica registrado no histórico" />
      </Field>
    </Modal>
  );
}

function LesaoModal({ caso, indice, onClose, onSave }: { caso: Caso; indice: number; onClose: () => void; onSave: (lesao: string, motivo: string) => void }) {
  const env = caso.envolvidos[indice];
  const [lesao, setLesao] = useState(env.lesao);
  const [motivo, setMotivo] = useState('');
  const hoje = new Date().toISOString().slice(0, 10);
  const dias = diasDesde(caso.dataHora, hoje);
  return (
    <Modal
      title={`Atualizar lesão · ${env.nome}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={lesao === env.lesao || !motivo.trim()} onClick={() => onSave(lesao, motivo)}>
            Salvar
          </button>
        </>
      }
    >
      <p className="help">
        {dias} {dias === 1 ? 'dia' : 'dias'} após o sinistro. Lesão atual: <strong>{env.lesao}</strong>.
      </p>
      {lesao === 'Óbito' && (
        <div className="note warn">Óbito decorrente do acidente dentro do prazo da metodologia (30 a 60 dias) conta como acidente de trânsito. Confira o prazo com a metodologia INFLEET.</div>
      )}
      <Field label="Lesão" htmlFor="les-nova">
        <select id="les-nova" className="select" value={lesao} onChange={(e) => setLesao(e.target.value)}>
          {LESOES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Motivo" htmlFor="les-motivo">
        <textarea id="les-motivo" className="textarea" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: informação do hospital" />
      </Field>
    </Modal>
  );
}
