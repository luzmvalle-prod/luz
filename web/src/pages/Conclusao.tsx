import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NIVEIS, origemDoNivel, type Caso } from '../../../shared/domain.ts';
import { api, urlAnexo } from '../api.ts';
import { DEMO } from '../demo/flag.ts';
import { CasoGate, CasoHeader, useCaso, useMutacao } from '../components/caso.tsx';
import { Card, Field, IconDownload, Modal, useToast } from '../components/ui.tsx';
import { diasEntre, fmtData, fmtDataHora, nomeArquivoDownload, rotaDaEtapa } from '../format.ts';

export function Conclusao() {
  const { caso, setCaso, erro } = useCaso();
  return (
    <CasoGate caso={caso} erro={erro} etapas={['concluido', 'concluido_sem_investigacao']}>
      {(c) => <Tela caso={c} setCaso={setCaso} />}
    </CasoGate>
  );
}

export function ReabrirModal({ caso, onClose, onDone }: { caso: Caso; onClose: () => void; onDone: (c: Caso) => void }) {
  const { run, ocupado } = useMutacao(onDone);
  const [motivo, setMotivo] = useState('');
  const volta = caso.etapa === 'concluido' ? 'investigação' : 'classificação';
  return (
    <Modal
      title="Reabrir caso"
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!motivo.trim() || ocupado} onClick={() => run(() => api.reabrir(caso.id, motivo), 'Caso reaberto')}>
            Reabrir
          </button>
        </>
      }
    >
      <p className="help">O caso volta para a {volta}. Ações, evidências e histórico são mantidos.</p>
      <Field label="Motivo" htmlFor="motivo-reabrir">
        <textarea id="motivo-reabrir" className="textarea" rows={3} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: novo laudo recebido" />
      </Field>
    </Modal>
  );
}

export function exportarCAT(caso: Caso, toast: ReturnType<typeof useToast>) {
  api
    .cat(caso.id)
    .then((d) => (DEMO ? toast('Na demonstração, o download fica desativado. No sistema, os dados da CAT são baixados em arquivo.') : nomeArquivoDownload(`cat-${caso.id}.json`, d)))
    .catch((e) => toast(e.message, 'erro'));
}

function Tela({ caso, setCaso }: { caso: Caso; setCaso: (c: Caso) => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const [reabrir, setReabrir] = useState(false);
  const inv = caso.investigacao;
  const semInv = caso.etapa === 'concluido_sem_investigacao';
  const feitas = caso.acoes.filter((a) => a.status === 'concluida').length;

  return (
    <>
      <CasoHeader
        caso={caso}
        eyebrow="Etapa 5 de 5"
        titulo={semInv ? 'Concluído sem investigação' : 'Conclusão do caso'}
        semFicha
        actions={
          <>
            <Link className="btn outline" to={`/sinistros/${caso.id}/relatorio`}>
              Exportar PDF
            </Link>
            <button className="btn outline" onClick={() => setReabrir(true)}>
              Reabrir caso
            </button>
          </>
        }
      />
      <div className="content">
        <div className="col">
          <Card title="Conclusão">
            <dl className="kv">
              <dt>Concluído por</dt>
              <dd>{caso.concluidoPor ?? '—'}</dd>
              <dt>Data</dt>
              <dd>{fmtDataHora(caso.concluidoEm)}</dd>
              <dt>Duração do caso</dt>
              <dd>{caso.concluidoEm ? (({ d }) => `${d} ${d === 1 ? 'dia' : 'dias'}`)({ d: diasEntre(caso.dataHora, caso.concluidoEm) }) : '—'}</dd>
              {!semInv && (
                <>
                  <dt>Ações concluídas</dt>
                  <dd>
                    {feitas} de {caso.acoes.length}
                  </dd>
                </>
              )}
            </dl>
            {semInv && (
              <div className="note">
                Nível {NIVEIS[caso.nivel]} ({origemDoNivel(caso.classificacao)}), abaixo do nível de investigação. O caso foi encerrado como registro.
              </div>
            )}
          </Card>

          {!semInv && (
            <>
              <Card title="Conclusão da investigação">
                <dl className="kv">
                  <dt>Causa raiz</dt>
                  <dd>{inv.causaRaiz}</dd>
                  <dt>Grau de certeza</dt>
                  <dd>{inv.certeza}</dd>
                  <dt>Evitabilidade</dt>
                  <dd>{inv.evitabilidade}</dd>
                  <dt>Responsabilidade legal</dt>
                  <dd>{inv.responsabilidade}</dd>
                </dl>
              </Card>
              <Card title="Ações e evidências">
                <table className="table flush">
                  <thead>
                    <tr>
                      <th>Ação</th>
                      <th>Responsável</th>
                      <th>Concluída em</th>
                      <th>Evidência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caso.acoes.map((a) => (
                      <tr key={a.id}>
                        <td>{a.titulo}</td>
                        <td className="muted">{a.responsavel}</td>
                        <td className="muted">{fmtData(a.concluidaEm)}</td>
                        <td>{a.evidencia ? <a href={urlAnexo(a.evidencia.id)} target="_blank" rel="noreferrer">{a.evidencia.nome}</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
        <aside className="aside">
          <Card title="Relatório do caso">
            <p className="help">Consolida identificação, classificação, dados coletados, investigação, ações e evidências.</p>
            <div className="stack" style={{ gap: 8 }}>
              <Link className="btn" to={`/sinistros/${caso.id}/relatorio`}>
                <IconDownload /> Exportar PDF
              </Link>
              <button className="btn outline" onClick={() => exportarCAT(caso, toast)}>
                Exportar dados da CAT
              </button>
              <Link className="btn ghost" to={`/sinistros/${caso.id}/ficha`}>
                Ver ficha completa
              </Link>
            </div>
          </Card>
        </aside>
      </div>
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
