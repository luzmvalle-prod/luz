import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATUS_ACAO_LABEL, type Acao, type Caso } from '../../../shared/domain.ts';
import { api } from '../api.ts';
import { AcaoModal } from '../components/acao.tsx';
import { CasoGate, CasoHeader, useCaso, useMutacao } from '../components/caso.tsx';
import { AnexoItem, Card, FileButton } from '../components/ui.tsx';
import { fmtData, fmtDataHora } from '../format.ts';

export function Acompanhamento() {
  const { caso, setCaso, erro } = useCaso();
  return (
    <CasoGate caso={caso} erro={erro} etapas={['acompanhamento']}>
      {(c) => <Tela caso={c} setCaso={setCaso} />}
    </CasoGate>
  );
}

export function StatusAcao({ a }: { a: Acao }) {
  const cls = a.status === 'concluida' ? 'ok' : a.atrasada ? 'danger' : a.status === 'em_andamento' ? 'info' : '';
  return <span className={`pill ${cls}`}>{a.atrasada ? 'Atrasada' : STATUS_ACAO_LABEL[a.status]}</span>;
}

function Tela({ caso, setCaso }: { caso: Caso; setCaso: (c: Caso) => void }) {
  const nav = useNavigate();
  const { run, ocupado } = useMutacao(setCaso);
  const [modal, setModal] = useState<Acao | 'nova' | null>(null);
  const total = caso.acoes.length;
  const feitas = caso.acoes.filter((a) => a.status === 'concluida').length;
  const faltam = total - feitas;
  const inv = caso.investigacao;

  const concluirCaso = async () => {
    const c = await run(() => api.concluirCaso(caso.id), 'Caso concluído');
    if (c) nav(`/sinistros/${c.id}/conclusao`);
  };

  return (
    <>
      <CasoHeader caso={caso} eyebrow="Etapa 4 de 5" titulo="Acompanhamento das ações" />
      <div className="content">
        <div className="col">
          {caso.acoes.map((a) => (
            <div key={a.id} className={`acao-card card ${a.status === 'concluida' ? 'feita' : ''}`}>
              <div className="card-head">
                <div className="stack">
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{a.titulo}</span>
                  <span className="sub">
                    {a.responsavel} · prazo {fmtData(a.prazo)}
                  </span>
                </div>
                <StatusAcao a={a} />
              </div>
              <div className="field">
                <span className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Evidência
                </span>
                {a.evidencia ? <AnexoItem a={a.evidencia} /> : <div className="note">Nenhum arquivo anexado</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {a.status !== 'concluida' && (
                    <>
                      <FileButton disabled={ocupado} onFiles={([f]) => run(() => api.anexarEvidencia(a.id, f), 'Evidência anexada')}>
                        {a.evidencia ? 'Substituir evidência' : 'Anexar evidência'}
                      </FileButton>
                      <button className="btn ghost sm" onClick={() => setModal(a)}>
                        Editar
                      </button>
                    </>
                  )}
                </div>
                {a.status === 'concluida' ? (
                  <span className="hint" style={{ color: 'var(--ok)' }}>
                    ✓ Concluída por {a.concluidaPor} em {fmtDataHora(a.concluidaEm)}
                  </span>
                ) : a.evidencia ? (
                  <button className="btn sm" disabled={ocupado} onClick={() => run(() => api.concluirAcao(a.id), 'Ação concluída')}>
                    Concluir ação
                  </button>
                ) : (
                  <button className="btn sm" disabled title="Anexe a evidência para concluir">
                    Anexe a evidência para concluir
                  </button>
                )}
              </div>
            </div>
          ))}
          <div>
            <button className="btn ghost sm" onClick={() => setModal('nova')}>
              Nova ação
            </button>
          </div>
        </div>
        <aside className="aside">
          <Card title="Progresso">
            <div className="progress" aria-hidden="true">
              <div style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} />
            </div>
            <span style={{ fontSize: 14 }}>
              <strong>
                {feitas} de {total}
              </strong>{' '}
              ações concluídas com evidência
            </span>
            <p className="hint">O caso só pode ser concluído quando todas as ações estiverem concluídas.</p>
          </Card>
          <Card title="Resumo da investigação">
            <div className="rows">
              <div className="r">
                <span className="k">Causa raiz</span>
                <span className="v">{inv.causaRaiz || '—'}</span>
              </div>
              <div className="r">
                <span className="k">Grau de certeza</span>
                <span className="v">{inv.certeza || '—'}</span>
              </div>
              <div className="r">
                <span className="k">Evitabilidade</span>
                <span className="v">{inv.evitabilidade || '—'}</span>
              </div>
              <div className="r">
                <span className="k">Responsabilidade</span>
                <span className="v">{inv.responsabilidade || '—'}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
      <div className="footer-bar">
        <span className="msg">{faltam === 0 ? 'Todas as ações concluídas. O caso pode ser concluído.' : `${faltam === 1 ? 'Falta 1 ação' : `Faltam ${faltam} ações`} para concluir o caso.`}</span>
        <button className="btn" disabled={faltam > 0 || ocupado} onClick={concluirCaso}>
          Concluir caso
        </button>
      </div>
      {modal && (
        <AcaoModal
          acao={modal === 'nova' ? undefined : modal}
          exigeMotivo
          onClose={() => setModal(null)}
          onSave={async (a) => {
            const c = await run(() => (modal === 'nova' ? api.criarAcao(caso.id, a) : api.editarAcao(modal.id, a)), 'Plano de ação atualizado');
            if (c) setModal(null);
          }}
        />
      )}
    </>
  );
}
