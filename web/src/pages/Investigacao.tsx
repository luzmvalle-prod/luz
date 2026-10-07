import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CERTEZAS,
  EVITABILIDADES,
  LEGENDAS,
  REGRAS_JORNADA,
  RESPONSABILIDADES,
  TIPOS_HIPOTESE,
  avaliarJornada,
  detalhesDe,
  eventoCorrigido,
  pendenciasInvestigacao,
  type Acao,
  type Caso,
  type Hipotese,
  type Investigacao,
} from '../../../shared/domain.ts';
import { api } from '../api.ts';
import { AcaoModal } from '../components/acao.tsx';
import { EventosTabela, HistoricoMotoristaTabela, VeiculoBloco } from '../components/eventos.tsx';
import { ContextoBlocos, Periodos24h, ResumoTelemetria } from '../components/contexto.tsx';
import { CasoGate, CasoHeader, useCaso, useMutacao } from '../components/caso.tsx';
import { AnexoItem, Card, ErrosNote, Field, FileButton, Modal, Seg, useUsuario } from '../components/ui.tsx';
import { fmtData, fmtDataHora, fmtDuracao } from '../format.ts';

export function InvestigacaoPage() {
  const { caso, setCaso, erro } = useCaso();
  return (
    <CasoGate caso={caso} erro={erro} etapas={['investigacao']}>
      {(c) => <Tela caso={c} setCaso={setCaso} />}
    </CasoGate>
  );
}

function Tela({ caso, setCaso }: { caso: Caso; setCaso: (c: Caso) => void }) {
  const nav = useNavigate();
  const { usuarios } = useUsuario();
  const { run, ocupado } = useMutacao(setCaso);
  const [inv, setInv] = useState<Investigacao>(caso.investigacao);
  const [sujo, setSujo] = useState(false);
  const [partNome, setPartNome] = useState('');
  const [partSetor, setPartSetor] = useState('');
  const [hipModal, setHipModal] = useState<Hipotese | 'nova' | null>(null);
  const [acaoModal, setAcaoModal] = useState<Acao | 'nova' | null>(null);
  const [tentouConcluir, setTentouConcluir] = useState(false);
  const invRef = useRef(inv);
  invRef.current = inv;

  const detalhes = detalhesDe(inv);
  const up = (patch: Partial<Investigacao>) => {
    setInv((i) => ({ ...i, ...patch }));
    setSujo(true);
  };

  // Salvamento automático do rascunho.
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(async () => {
      try {
        const c = await api.salvarInvestigacao(caso.id, invRef.current);
        setInv((i) => ({ ...i, rascunhoSalvoEm: c.investigacao.rascunhoSalvoEm }));
        setSujo(false);
      } catch {
        /* o botão "Salvar rascunho" mostra o erro */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [inv, sujo, caso.id]);

  const salvar = async () => {
    const c = await run(() => api.salvarInvestigacao(caso.id, inv), 'Rascunho salvo');
    if (c) {
      setInv(c.investigacao);
      setSujo(false);
    }
  };

  const pend = pendenciasInvestigacao(inv, caso.acoes);
  const concluir = async () => {
    setTentouConcluir(true);
    if (pend.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const c = await run(() => api.concluirInvestigacao(caso.id, inv), 'Investigação concluída. Acompanhe as ações.');
    if (c) nav(`/sinistros/${c.id}/acompanhamento`);
  };

  const d = caso.dados;
  const toggleEvid = (id: string) => up({ evidencias: inv.evidencias.includes(id) ? inv.evidencias.filter((x) => x !== id) : [...inv.evidencias, id] });
  // Participantes não precisam de cadastro na plataforma: só nome e setor.
  const addParticipante = () => {
    const nome = partNome.trim();
    const setor = partSetor.trim();
    if (!nome) return;
    const p = setor ? `${nome} · ${setor}` : nome;
    if (!inv.participantes.includes(p)) up({ participantes: [...inv.participantes, p] });
    setPartNome('');
    setPartSetor('');
  };
  const onNomeParticipante = (v: string) => {
    setPartNome(v);
    const u = usuarios.find((x) => x.nome.toLowerCase() === v.trim().toLowerCase());
    if (u && !partSetor) setPartSetor(u.setor);
  };
  const sugestoesEvidencia = [
    ...(d?.eventos.map((e) => `Evento: ${(eventoCorrigido(caso.correcoes, e.id)?.corrigido ?? e.evento).toLowerCase()} ${e.horario}`) ?? []),
    ...caso.anexos.map((a) => `Anexo: ${a.nome}`),
    'Clipe da câmera externa',
    'Clipe da câmera interna',
    'Relato do monitoramento',
  ];

  return (
    <>
      <CasoHeader caso={caso} eyebrow="Etapa 3 de 5" titulo="Investigação" />
      <div className="content">
        <div className="col">
          {tentouConcluir && <ErrosNote titulo="Para concluir a investigação" itens={pend} />}

          <Card n={1} title="Comitê">
            <div className="grid3">
              <Field label="Data da análise" htmlFor="comite-data">
                <input id="comite-data" type="date" className="input" value={inv.comiteData} onChange={(e) => up({ comiteData: e.target.value })} />
              </Field>
              <div className="field span2">
                <span className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Participantes (não precisam ter cadastro na plataforma)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label htmlFor="comite-nome" className="sr-only">
                    Nome do participante
                  </label>
                  <input id="comite-nome" className="input" list="usuarios-list" placeholder="Nome" value={partNome} onChange={(e) => onNomeParticipante(e.target.value)} />
                  <datalist id="usuarios-list">
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.nome} />
                    ))}
                  </datalist>
                  <label htmlFor="comite-setor" className="sr-only">
                    Setor do participante
                  </label>
                  <input
                    id="comite-setor"
                    className="input"
                    placeholder="Setor"
                    value={partSetor}
                    onChange={(e) => setPartSetor(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParticipante())}
                  />
                  <button className="btn secondary" onClick={addParticipante} disabled={!partNome.trim()}>
                    Incluir
                  </button>
                </div>
              </div>
            </div>
            <div className="chips">
              {inv.participantes.length === 0 && <span className="hint">Nenhum participante.</span>}
              {inv.participantes.map((p) => (
                <span className="chip" key={p}>
                  {p}
                  <button aria-label={`Remover ${p}`} onClick={() => up({ participantes: inv.participantes.filter((x) => x !== p) })}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </Card>

          <Card n={2} title="Evidências da plataforma">
            {!d ? (
              <div className="note">Veículo de terceiro: sem eventos da plataforma. Use os anexos fornecidos pelo proprietário.</div>
            ) : (
              <>
                <p className="help">Eventos da viagem inteira, do início da jornada até o sinistro, já registrados pela INFLEET. Marque o que entra como evidência do caso.</p>
                <ResumoTelemetria caso={caso} />
                <EventosTabela
                  caso={caso}
                  selecionados={inv.evidencias}
                  onToggle={toggleEvid}
                  onCorrigir={async (eventoId, corrigido, motivo) => !!(await run(() => api.corrigirEvento(caso.id, eventoId, corrigido, motivo), 'Evento corrigido'))}
                />
                {d.jornada && <JornadaTabela jornada={d.jornada} />}
                <Periodos24h periodos={d.periodos24h} />
                <HistoricoMotoristaTabela historico={d.historico30d} km30d={d.km30d} />
                <VeiculoBloco veiculo={d.veiculo} />
              </>
            )}
            <div className="stack" style={{ gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Anexos do caso</h3>
              {caso.anexos.length === 0 && <span className="hint">Nenhum anexo.</span>}
              {caso.anexos.map((a) => (
                <AnexoItem key={a.id} a={a} />
              ))}
              <div>
                <FileButton multiple disabled={ocupado} onFiles={(f) => run(() => api.anexar(caso.id, 'investigacao', f), 'Anexo adicionado')}>
                  Anexar laudo ou documento
                </FileButton>
              </div>
            </div>
          </Card>

          <Card n={3} title="Contexto do acidente" right={<span className="hint">opcional</span>}>
            <Field label="Observações sobre a jornada" htmlFor="jornada-obs">
              <textarea
                id="jornada-obs"
                className="textarea"
                rows={3}
                value={detalhes.jornadaObs}
                onChange={(e) => up({ detalhes: { ...detalhes, jornadaObs: e.target.value } })}
                placeholder="Ex.: fez a jornada da lei, mas parou várias vezes (1 h dirigindo e 10 min parado); dirigiu 1 h a mais a pedido da empresa"
              />
            </Field>
            <ContextoBlocos caso={caso} detalhes={detalhes} onChange={(x) => up({ detalhes: x })} />
          </Card>

          <Card n={4} title="Relato e constatação">
            <p className="help">Compare o que foi dito com o que a evidência mostra.</p>
            <div className="compare">
              <div>
                <span className="k">Relato do motorista</span>
                <span>{caso.relato || '—'}</span>
              </div>
              <div>
                <label className="k" htmlFor="constatado">
                  Constatado
                </label>
                <textarea id="constatado" className="textarea" rows={3} value={inv.constatado} onChange={(e) => up({ constatado: e.target.value })} placeholder="O que as evidências mostram" />
              </div>
            </div>
          </Card>

          <Card n={5} title="Hipóteses e fatores contribuintes">
            <table className="table flush">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Evidência</th>
                  <th style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>
                {inv.hipoteses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Nenhuma hipótese ou fator registrado.
                    </td>
                  </tr>
                )}
                {inv.hipoteses.map((h) => (
                  <tr key={h.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      {h.tipo}
                    </td>
                    <td>{h.descricao}</td>
                    <td className="muted">{h.evidencia || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => setHipModal(h)}>
                        Editar
                      </button>
                      <button className="btn danger sm" onClick={() => up({ hipoteses: inv.hipoteses.filter((x) => x.id !== h.id) })}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <button className="btn ghost sm" onClick={() => setHipModal('nova')}>
                Adicionar hipótese ou fator
              </button>
            </div>
          </Card>

          <Card n={6} title="Conclusão">
            <Field label="Causa raiz" htmlFor="causa">
              <textarea id="causa" className="textarea" rows={2} value={inv.causaRaiz} onChange={(e) => up({ causaRaiz: e.target.value })} />
            </Field>
            <p className="hint">Passe o mouse sobre cada opção para ver quando usá-la.</p>
            <div className="grid3">
              <div className="field">
                <span className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Grau de certeza da causa
                </span>
                <Seg<string> label="Grau de certeza" value={inv.certeza} options={CERTEZAS} dicas={dicas('certeza', CERTEZAS)} onChange={(v) => up({ certeza: v })} />
                <p className="legenda">{legenda('certeza', inv.certeza)}</p>
              </div>
              <div className="field">
                <span className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Evitabilidade
                </span>
                <Seg<string> label="Evitabilidade" value={inv.evitabilidade} options={EVITABILIDADES} dicas={dicas('evitabilidade', EVITABILIDADES)} onChange={(v) => up({ evitabilidade: v })} />
                <p className="legenda">{legenda('evitabilidade', inv.evitabilidade)}</p>
              </div>
              <div className="field">
                <span className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Responsabilidade legal
                </span>
                <Seg<string> label="Responsabilidade legal" value={inv.responsabilidade} options={RESPONSABILIDADES} dicas={dicas('responsabilidade', RESPONSABILIDADES)} onChange={(v) => up({ responsabilidade: v })} />
                <p className="legenda">{legenda('responsabilidade', inv.responsabilidade)}</p>
              </div>
            </div>
          </Card>

          <Card n={7} title="Plano de ação">
            <p className="help">Cada ação precisa de responsável e prazo. A evidência é anexada na próxima etapa.</p>
            <table className="table flush">
              <thead>
                <tr>
                  <th>Ação</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>
                {caso.acoes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Nenhuma ação no plano.
                    </td>
                  </tr>
                )}
                {caso.acoes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.titulo}</td>
                    <td className="muted">{a.responsavel}</td>
                    <td className="muted">{fmtData(a.prazo)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => setAcaoModal(a)}>
                        Editar
                      </button>
                      <button className="btn danger sm" disabled={ocupado} onClick={() => run(() => api.removerAcao(a.id), 'Ação removida')}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <button className="btn ghost sm" onClick={() => setAcaoModal('nova')}>
                Adicionar ação
              </button>
            </div>
          </Card>
        </div>
      </div>

      <div className="footer-bar">
        <span className="msg">{sujo ? 'Alterações não salvas…' : inv.rascunhoSalvoEm ? `Rascunho salvo às ${fmtDataHora(inv.rascunhoSalvoEm).slice(11)} de ${fmtDataHora(inv.rascunhoSalvoEm).slice(0, 5)}` : 'Nenhum rascunho salvo'}</span>
        <div className="actions">
          <button className="btn outline" onClick={salvar} disabled={ocupado}>
            Salvar rascunho
          </button>
          <button className="btn" onClick={concluir} disabled={ocupado}>
            Concluir investigação e acompanhar ações
          </button>
        </div>
      </div>

      {hipModal && (
        <HipoteseModal
          hip={hipModal === 'nova' ? undefined : hipModal}
          sugestoes={sugestoesEvidencia}
          onClose={() => setHipModal(null)}
          onSave={(h) => {
            up({ hipoteses: hipModal === 'nova' ? [...inv.hipoteses, h] : inv.hipoteses.map((x) => (x.id === h.id ? h : x)) });
            setHipModal(null);
          }}
        />
      )}
      {acaoModal && (
        <AcaoModal
          acao={acaoModal === 'nova' ? undefined : acaoModal}
          exigeMotivo={false}
          onClose={() => setAcaoModal(null)}
          onSave={async (a) => {
            const c = await run(() => (acaoModal === 'nova' ? api.criarAcao(caso.id, a) : api.editarAcao(acaoModal.id, a)), 'Plano de ação atualizado');
            if (c) setAcaoModal(null);
          }}
        />
      )}
    </>
  );
}

export function JornadaTabela({ jornada }: { jornada: NonNullable<Caso['dados']>['jornada'] & object }) {
  const av = avaliarJornada(jornada);
  const R = REGRAS_JORNADA;
  const lim = (ok: boolean) => (ok ? undefined : { color: 'var(--danger)', fontWeight: 500 });
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Jornada no momento do sinistro</h3>
        <span className={`pill ${av.dentro ? 'ok' : 'danger'}`}>{av.dentro ? 'Dentro da jornada' : 'Fora da jornada'}</span>
      </div>
      <table className="table flush">
        <thead>
          <tr>
            <th>Item</th>
            <th>Valor</th>
            <th>Regra</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Início da jornada</td>
            <td className="muted">{jornada.inicio}</td>
            <td className="muted">—</td>
          </tr>
          <tr>
            <td>Horas trabalhadas até o sinistro</td>
            <td style={lim(jornada.horasTrabalhadasMin <= R.jornadaMin + R.extrasMin)}>{fmtDuracao(jornada.horasTrabalhadasMin)}</td>
            <td className="muted">limite 8 h + 2 h extras</td>
          </tr>
          <tr>
            <td>Direção contínua</td>
            <td style={lim(jornada.direcaoContinuaMin <= R.direcaoContinuaMin)}>{fmtDuracao(jornada.direcaoContinuaMin)}</td>
            <td className="muted">limite 5 h 30 min</td>
          </tr>
          <tr>
            <td>Descanso interjornada anterior</td>
            <td style={lim(jornada.interjornadaMin >= R.interjornadaMin)}>{fmtDuracao(jornada.interjornadaMin)}</td>
            <td className="muted">mínimo 11 h</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">Regras da Lei 13.103/2015 (Lei do Motorista) para transporte de cargas.</p>
    </div>
  );
}

/** Legenda da opção escolhida (textos em LEGENDAS, a validar com a metodologia). */
function legenda(grupo: string, v: string) {
  if (!v) return 'Escolha uma opção.';
  return LEGENDAS[v === 'Inconclusiva' ? `Inconclusiva (${grupo})` : v] ?? '';
}
function dicas<T extends string>(grupo: string, opcoes: readonly T[]) {
  return Object.fromEntries(opcoes.map((o) => [o, legenda(grupo, o)])) as Partial<Record<T, string>>;
}

function HipoteseModal({ hip, sugestoes, onClose, onSave }: { hip?: Hipotese; sugestoes: string[]; onClose: () => void; onSave: (h: Hipotese) => void }) {
  const [h, setH] = useState<Hipotese>(hip ?? { id: crypto.randomUUID(), tipo: 'Hipótese em análise', descricao: '', evidencia: '' });
  return (
    <Modal
      title={hip ? 'Editar hipótese ou fator' : 'Adicionar hipótese ou fator'}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!h.descricao.trim()} onClick={() => onSave(h)}>
            Salvar
          </button>
        </>
      }
    >
      <Field label="Tipo" htmlFor="h-tipo">
        <select id="h-tipo" className="select" value={h.tipo} onChange={(e) => setH({ ...h, tipo: e.target.value })}>
          {TIPOS_HIPOTESE.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Descrição" htmlFor="h-desc">
        <input id="h-desc" className="input" autoFocus value={h.descricao} onChange={(e) => setH({ ...h, descricao: e.target.value })} />
      </Field>
      <Field label="Evidência" htmlFor="h-ev">
        <input id="h-ev" className="input" list="h-ev-list" value={h.evidencia} onChange={(e) => setH({ ...h, evidencia: e.target.value })} placeholder="Evento, anexo ou clipe que sustenta" />
        <datalist id="h-ev-list">
          {sugestoes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
    </Modal>
  );
}
