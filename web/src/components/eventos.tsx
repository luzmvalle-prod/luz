import { useState } from 'react';
import {
  PRAZO_CORRECAO_DIAS,
  TIPOS_EVENTO,
  eventoCorrigido,
  podeCorrigirEvento,
  type Caso,
  type EventoPlataforma,
  type HistoricoMotorista,
  type VeiculoNoSinistro,
} from '../../../shared/domain.ts';
import { fmtData, fmtDataHora } from '../format.ts';
import { Field, Modal } from './ui.tsx';

const hojeLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/**
 * Eventos da viagem (do início da jornada até o sinistro), com velocidade no momento,
 * visualização do evento e correção da natureza (até 7 dias após o sinistro).
 */
export function EventosTabela({
  caso,
  selecionados,
  onToggle,
  onCorrigir,
}: {
  caso: Caso;
  selecionados?: string[];
  onToggle?: (id: string) => void;
  onCorrigir?: (eventoId: string, corrigido: string, motivo: string) => Promise<boolean>;
}) {
  const [ver, setVer] = useState<EventoPlataforma | null>(null);
  const [corrigir, setCorrigir] = useState<EventoPlataforma | null>(null);
  const eventos = caso.dados?.eventos ?? [];
  const dentroDoPrazo = podeCorrigirEvento(caso.dataHora, hojeLocal());
  const podeCorrigir = !!onCorrigir && (caso.etapa === 'investigacao' || caso.etapa === 'acompanhamento');

  return (
    <>
      <table className="table flush">
        <thead>
          <tr>
            <th>Horário</th>
            <th>Origem</th>
            <th>Evento</th>
            <th>Detalhe</th>
            <th>Velocidade</th>
            <th style={{ width: onToggle ? 250 : 150 }} />
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => {
            const corr = eventoCorrigido(caso.correcoes, e.id);
            return (
              <tr key={e.id}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                  {e.horario}
                </td>
                <td className="muted">{e.origem}</td>
                <td style={{ fontWeight: 500 }}>
                  {corr ? (
                    <span className="stack" style={{ gap: 2 }}>
                      <span>{corr.corrigido}</span>
                      <span className="sub" style={{ fontWeight: 400 }}>
                        era <s>{corr.original}</s> ·{' '}
                        <span className="pill warn" title="A correção ainda será levada à base de eventos da plataforma">
                          corrigido
                        </span>
                      </span>
                    </span>
                  ) : (
                    e.evento
                  )}
                </td>
                <td className="muted">{e.detalhe}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                  {e.velocidade != null ? `${e.velocidade} km/h` : '—'}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setVer(e)}>
                    Ver
                  </button>
                  {podeCorrigir && (
                    <button
                      className="btn ghost sm"
                      disabled={!dentroDoPrazo}
                      title={dentroDoPrazo ? 'Corrigir a natureza do evento' : `Prazo de ${PRAZO_CORRECAO_DIAS} dias após o sinistro encerrado`}
                      onClick={() => setCorrigir(e)}
                    >
                      Corrigir
                    </button>
                  )}
                  {onToggle && (
                    <label className="check" style={{ marginLeft: 8 }}>
                      <input type="checkbox" checked={!!selecionados?.includes(e.id)} onChange={() => onToggle(e.id)} />
                      Evidência
                    </label>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {podeCorrigir && (
        <p className="hint">
          {dentroDoPrazo
            ? `A natureza de um evento pode ser corrigida até ${PRAZO_CORRECAO_DIAS} dias após o sinistro. O original fica guardado e a correção será levada à base de eventos.`
            : `O prazo de ${PRAZO_CORRECAO_DIAS} dias para corrigir eventos deste sinistro terminou.`}
        </p>
      )}
      {ver && <EventoModal caso={caso} evento={ver} onClose={() => setVer(null)} />}
      {corrigir && onCorrigir && (
        <CorrecaoModal
          caso={caso}
          evento={corrigir}
          onClose={() => setCorrigir(null)}
          onSave={async (novo, motivo) => {
            if (await onCorrigir(corrigir.id, novo, motivo)) setCorrigir(null);
          }}
        />
      )}
    </>
  );
}

function EventoModal({ caso, evento, onClose }: { caso: Caso; evento: EventoPlataforma; onClose: () => void }) {
  const historico = (caso.correcoes ?? []).filter((c) => c.eventoId === evento.id);
  const video = evento.origem === 'Videotelemetria';
  return (
    <Modal
      title={eventoCorrigido(caso.correcoes, evento.id)?.corrigido ?? evento.evento}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Fechar
        </button>
      }
    >
      <div className="video-ph" aria-label="Clipe do evento">
        <span>{video ? 'Clipe de vídeo do evento' : 'Clipe da câmera externa no horário do evento'}</span>
        <span className="hint" style={{ color: '#9fb6da' }}>
          Simulado no ambiente local · na plataforma, o vídeo abre aqui
        </span>
      </div>
      <dl className="kv tight">
        <dt>Horário</dt>
        <dd>
          {fmtData(caso.dataHora)} {evento.horario}
        </dd>
        <dt>Origem</dt>
        <dd>{evento.origem}</dd>
        <dt>Detalhe</dt>
        <dd>{evento.detalhe}</dd>
        <dt>Velocidade</dt>
        <dd>{evento.velocidade != null ? `${evento.velocidade} km/h` : '—'}</dd>
        <dt>Veículo</dt>
        <dd>
          {caso.placa} · {caso.motorista}
        </dd>
      </dl>
      {historico.length > 0 && (
        <div className="note warn">
          <strong>Correções</strong>
          <ul>
            {historico.map((c, i) => (
              <li key={i}>
                {c.original} → {c.corrigido} · {c.autor} em {fmtDataHora(c.data)} · “{c.motivo}”{c.pendenteBase && ' · pendente de envio à base de eventos'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function CorrecaoModal({ caso, evento, onClose, onSave }: { caso: Caso; evento: EventoPlataforma; onClose: () => void; onSave: (novo: string, motivo: string) => void }) {
  const atual = eventoCorrigido(caso.correcoes, evento.id)?.corrigido ?? evento.evento;
  const [novo, setNovo] = useState('');
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      title="Corrigir natureza do evento"
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!novo || novo === atual || !motivo.trim()} onClick={() => onSave(novo, motivo)}>
            Salvar correção
          </button>
        </>
      }
    >
      <p className="help">
        {evento.horario} · registrado como <strong>{atual}</strong>. Use quando o vídeo mostra outra coisa (ex.: “uso de celular” que era um cochilo) ou um falso positivo.
      </p>
      <Field label="O evento na verdade foi" htmlFor="corr-novo">
        <select id="corr-novo" className="select" value={novo} onChange={(e) => setNovo(e.target.value)}>
          <option value="">Selecione</option>
          {TIPOS_EVENTO.filter((t) => t !== atual).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Motivo" htmlFor="corr-motivo">
        <textarea id="corr-motivo" className="textarea" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="O que foi visto no vídeo" />
      </Field>
      <p className="hint">O evento original fica guardado. A correção fica registrada no histórico e será levada à base de eventos da plataforma.</p>
    </Modal>
  );
}

/** Histórico do motorista em 30 dias, normalizado por 1.000 km e comparado com a frota. */
export function HistoricoMotoristaTabela({ historico, km30d }: { historico: HistoricoMotorista[]; km30d?: number }) {
  const temTaxa = historico.some((h) => h.por1000km != null);
  const posicao = (p?: number) => {
    if (p == null) return '—';
    if (p >= 50) return <span className={`pill ${p >= 80 ? 'danger' : 'warn'}`}>entre os {100 - p}% piores</span>;
    return <span className="pill ok">entre os {p}% melhores</span>;
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600 }}>
        Histórico do motorista · 30 dias antes
        {km30d != null && <span className="hint" style={{ fontWeight: 400, marginLeft: 8 }}>{km30d.toLocaleString('pt-BR')} km rodados</span>}
      </h3>
      <table className="table flush">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Ocorrências</th>
            {temTaxa && (
              <>
                <th>Por 1.000 km</th>
                <th>Média da frota</th>
                <th>Posição na frota</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {historico.map((h) => (
            <tr key={h.evento}>
              <td>{h.evento}</td>
              <td className="muted">{h.ocorrencias}</td>
              {temTaxa && (
                <>
                  <td style={{ fontWeight: 500 }}>{h.por1000km?.toLocaleString('pt-BR') ?? '—'}</td>
                  <td className="muted">{h.mediaFrota?.toLocaleString('pt-BR') ?? '—'}</td>
                  <td>{posicao(h.percentil)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Situação do veículo no dia do sinistro: último checklist e manutenções vencidas. */
export function VeiculoBloco({ veiculo }: { veiculo?: VeiculoNoSinistro }) {
  if (!veiculo) return null;
  const ck = veiculo.checklist;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600 }}>Veículo no momento do sinistro</h3>
      <div className="compare">
        <div>
          <span className="k">Último checklist</span>
          {ck ? (
            <>
              <span>
                {fmtDataHora(ck.data)} · <span className={`pill ${ck.naoConformidades.length ? 'warn' : 'ok'}`}>{ck.resultado}</span>
              </span>
              {ck.naoConformidades.length > 0 && (
                <ul className="help" style={{ margin: 0, paddingLeft: 18 }}>
                  {ck.naoConformidades.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <span className="muted">Nenhum checklist no dia</span>
          )}
        </div>
        <div>
          <span className="k">Manutenções vencidas</span>
          {veiculo.manutencoesVencidas.length === 0 ? (
            <span>Nenhuma manutenção vencida</span>
          ) : (
            veiculo.manutencoesVencidas.map((m) => (
              <span key={m.item}>
                <span className="pill danger">vencida</span> {m.item} · desde {fmtData(m.venceuEm)}
              </span>
            ))
          )}
        </div>
      </div>
      <p className="hint">Dados de Checklist e Manutenção.</p>
    </div>
  );
}
