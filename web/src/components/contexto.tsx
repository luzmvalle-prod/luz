import type { ReactNode } from 'react';
import {
  CONDICOES_FISICAS,
  CONTEXTOS_VIA,
  HISTORICO_ITENS,
  PISTA_CONDICOES,
  QUALIDADES,
  detalhesDe,
  resumoTelemetria,
  tipoLabel,
  vencidaEm,
  type Caso,
  type DadosColetados,
  type DetalhesInvestigacao,
} from '../../../shared/domain.ts';
import { fmtData, fmtDataHora, fmtDuracao } from '../format.ts';
import { Field, NivelBadge } from './ui.tsx';

// ---------------------------------------------------------------- telemetria

/** Resumo da viagem no formato do formulário da Dellmar (velocidade, frenagens e Sim/Não). */
export function ResumoTelemetria({ caso }: { caso: Caso }) {
  if (!caso.dados) return null;
  const r = resumoTelemetria(caso.dados.eventos, caso.correcoes);
  const sn = (v: boolean) => <span className={`pill ${v ? 'danger' : 'ok'}`}>{v ? 'Sim' : 'Não'}</span>;
  return (
    <div className="resumo-tel">
      <div>
        <span className="k">Velocidade máxima</span>
        <strong>{r.velocidadeMaxima != null ? `${r.velocidadeMaxima} km/h` : '—'}</strong>
      </div>
      <div>
        <span className="k">Picos de velocidade</span>
        <strong>{r.picosVelocidade}</strong>
      </div>
      <div>
        <span className="k">Frenagens bruscas</span>
        <strong>{r.frenagensBruscas}</strong>
      </div>
      <div>
        <span className="k">Distração</span>
        {sn(r.distracao)}
      </div>
      <div>
        <span className="k">Uso de celular</span>
        {sn(r.celular)}
      </div>
      <div>
        <span className="k">Fadiga</span>
        {sn(r.fadiga)}
      </div>
      <div>
        <span className="k">Sem cinto</span>
        {sn(r.semCinto)}
      </div>
    </div>
  );
}

/** Direção, paradas e descanso nas 24 h antes do sinistro. */
export function Periodos24h({ periodos }: { periodos?: DadosColetados['periodos24h'] }) {
  if (!periodos?.length) return null;
  const paradas = periodos.filter((p) => p.tipo === 'Parada').length;
  return (
    <details className="bloco">
      <summary>
        Direção e paradas nas 24 h antes do sinistro <span className="hint">· {paradas} paradas</span>
      </summary>
      <table className="table flush">
        <thead>
          <tr>
            <th>Período</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Duração</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((p, i) => (
            <tr key={i}>
              <td>
                <span className={`pill ${p.tipo === 'Direção' ? 'info' : p.tipo === 'Descanso' ? 'ok' : ''}`}>{p.tipo}</span>
              </td>
              <td className="muted">{fmtDataHora(p.inicio)}</td>
              <td className="muted">{fmtDataHora(p.fim)}</td>
              <td>{fmtDuracao(p.duracaoMin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Dados de jornada da telemetria.</p>
    </details>
  );
}

// ---------------------------------------------------------------- blocos opcionais

function Chips({ opcoes, valor, onChange, label, exclusivo }: { opcoes: readonly string[]; valor: string[]; onChange: (v: string[]) => void; label: string; exclusivo?: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {opcoes.map((o) => {
        const on = valor.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={`chip-toggle ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => {
              if (on) return onChange(valor.filter((x) => x !== o));
              // Uma opção exclusiva (ex.: "Normal") desmarca as demais, e vice-versa.
              if (o === exclusivo) return onChange([o]);
              onChange([...valor.filter((x) => x !== exclusivo), o]);
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Bloco({ titulo, resumo, children }: { titulo: string; resumo?: string; children: ReactNode }) {
  return (
    <details className="bloco">
      <summary>
        {titulo} {resumo && <span className="hint">· {resumo}</span>}
      </summary>
      <div className="stack" style={{ gap: 16, paddingTop: 12 }}>
        {children}
      </div>
    </details>
  );
}

const Linha = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="r">
    <span className="k">{k}</span>
    <span className="v">{children}</span>
  </div>
);

function Validade({ data, dataHora }: { data: string; dataHora: string }) {
  if (!data) return <>—</>;
  return vencidaEm(data, dataHora) ? <span className="pill danger">vencida em {fmtData(data)}</span> : <>{fmtData(data)}</>;
}

/** Condutor, veículo e via: blocos opcionais e recolhidos da investigação (formulário da Dellmar). */
export function ContextoBlocos({ caso, detalhes, onChange }: { caso: Caso; detalhes: DetalhesInvestigacao; onChange: (d: DetalhesInvestigacao) => void }) {
  const c = detalhes.condutor;
  const v = detalhes.via;
  const setC = (p: Partial<DetalhesInvestigacao['condutor']>) => onChange({ ...detalhes, condutor: { ...c, ...p } });
  const setV = (p: Partial<DetalhesInvestigacao['via']>) => onChange({ ...detalhes, via: { ...v, ...p } });
  const auto = caso.dados?.condutor;
  const veic = caso.dados?.veiculo;
  const cnhVencida = auto ? vencidaEm(auto.validadeCnh, caso.dataHora) || vencidaEm(auto.validadeToxicologico, caso.dataHora) : vencidaEm(c.validadeCnh, caso.dataHora) || vencidaEm(c.validadeToxicologico, caso.dataHora);
  const preenchidos = (n: number) => (n ? `${n} ${n === 1 ? 'item preenchido' : 'itens preenchidos'}` : 'não preenchido');

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Bloco titulo="Condutor" resumo={cnhVencida ? 'documento vencido na data do sinistro' : preenchidos(c.condicaoFisica.length + c.historico.length)}>
        <div className="grid2">
          <div className="stack" style={{ gap: 8 }}>
            <span className="label-sm">Documentos {auto && <span className="hint">· Minha frota</span>}</span>
            {auto ? (
              <div className="rows">
                <Linha k="Vínculo">{caso.vinculo || '—'}</Linha>
                <Linha k="Nº da CNH">{auto.cnh}</Linha>
                <Linha k="Validade da CNH">
                  <Validade data={auto.validadeCnh} dataHora={caso.dataHora} />
                </Linha>
                <Linha k="Validade do toxicológico">
                  <Validade data={auto.validadeToxicologico} dataHora={caso.dataHora} />
                </Linha>
              </div>
            ) : (
              <div className="grid3">
                <Field label="Nº da CNH" htmlFor="ctx-cnh">
                  <input id="ctx-cnh" className="input" value={c.cnh || caso.terceiro?.cnh || ''} onChange={(e) => setC({ cnh: e.target.value })} />
                </Field>
                <Field label="Validade da CNH" htmlFor="ctx-vcnh">
                  <input id="ctx-vcnh" type="date" className="input" value={c.validadeCnh} onChange={(e) => setC({ validadeCnh: e.target.value })} />
                </Field>
                <Field label="Validade do toxicológico" htmlFor="ctx-vtox">
                  <input id="ctx-vtox" type="date" className="input" value={c.validadeToxicologico} onChange={(e) => setC({ validadeToxicologico: e.target.value })} />
                </Field>
              </div>
            )}
            {cnhVencida && <div className="note danger">CNH ou exame toxicológico vencido na data do sinistro.</div>}
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="label-sm">Sinistros anteriores do motorista</span>
            {caso.sinistrosAnteriores.length === 0 ? (
              <span className="hint">Nenhum sinistro anterior registrado.</span>
            ) : (
              <div className="rows">
                {caso.sinistrosAnteriores.map((s) => (
                  <Linha key={s.id} k={`${fmtData(s.dataHora)} · ${tipoLabel(s)}`}>
                    <NivelBadge nivel={s.nivel} />
                  </Linha>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="field">
          <span className="label-sm">Condição física</span>
          <Chips label="Condição física" opcoes={CONDICOES_FISICAS} valor={c.condicaoFisica} exclusivo="Normal" onChange={(x) => setC({ condicaoFisica: x })} />
          {c.condicaoFisica.some((x) => x !== 'Normal') && (
            <input className="input" aria-label="Detalhe da condição física" placeholder="Detalhe (opcional)" value={c.condicaoObs} onChange={(e) => setC({ condicaoObs: e.target.value })} />
          )}
        </div>
        <div className="field">
          <span className="label-sm">Histórico do motorista</span>
          <Chips label="Histórico do motorista" opcoes={HISTORICO_ITENS} valor={c.historico} onChange={(x) => setC({ historico: x })} />
          <textarea className="textarea" rows={2} aria-label="Detalhe do histórico" placeholder="Ex.: 2 multas por velocidade em 2026; advertência em agosto" value={c.historicoObs} onChange={(e) => setC({ historicoObs: e.target.value })} />
        </div>
      </Bloco>

      <Bloco titulo="Veículo" resumo={veic?.cadastro ? `${veic.cadastro.marca} ${veic.cadastro.modelo} · ${veic.cadastro.ano}` : 'sem dados da plataforma'}>
        {veic?.cadastro ? (
          <div className="grid2">
            <div className="rows">
              <Linha k="Marca">{veic.cadastro.marca}</Linha>
              <Linha k="Modelo">{veic.cadastro.modelo}</Linha>
              <Linha k="Ano">{veic.cadastro.ano}</Linha>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span className="label-sm">
                Última manutenção preventiva <span className="hint">· Manutenção</span>
              </span>
              <div className="rows">
                {(veic.preventivas ?? []).map((p) => (
                  <Linha key={p.placa} k={`${p.papel} ${p.placa}`}>
                    {fmtData(p.data)} · {p.km.toLocaleString('pt-BR')} km
                  </Linha>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="note">Veículo sem equipamento INFLEET: ano, marca e preventiva não vêm da plataforma. Registre nos anexos ou na constatação.</div>
        )}
      </Bloco>

      <Bloco titulo="Via" resumo={preenchidos(v.pista.length + v.contexto.length + (v.pavimentacao ? 1 : 0) + (v.sinalizacao ? 1 : 0) + (v.rodovia ? 1 : 0))}>
        <div className="grid3">
          <Field label="Rodovia" htmlFor="ctx-rod">
            <input id="ctx-rod" className="input" placeholder="Ex.: BR-101, km 72" value={v.rodovia} onChange={(e) => setV({ rodovia: e.target.value })} />
          </Field>
          <Field label="Concessionária" htmlFor="ctx-conc">
            <input id="ctx-conc" className="input" value={v.concessionaria} onChange={(e) => setV({ concessionaria: e.target.value })} />
          </Field>
          <Field label="Nº de faixas" htmlFor="ctx-fx">
            <input id="ctx-fx" className="input" inputMode="numeric" value={v.faixas} onChange={(e) => setV({ faixas: e.target.value.replace(/\D/g, '') })} />
          </Field>
        </div>
        <div className="field">
          <span className="label-sm">Condições da pista</span>
          <Chips label="Condições da pista" opcoes={PISTA_CONDICOES} valor={v.pista} onChange={(x) => setV({ pista: x })} />
        </div>
        <div className="grid2">
          <div className="field">
            <span className="label-sm">Pavimentação</span>
            <Chips label="Pavimentação" opcoes={QUALIDADES} valor={v.pavimentacao ? [v.pavimentacao] : []} onChange={(x) => setV({ pavimentacao: x.at(-1) ?? '' })} />
          </div>
          <div className="field">
            <span className="label-sm">Sinalização</span>
            <Chips label="Sinalização" opcoes={QUALIDADES} valor={v.sinalizacao ? [v.sinalizacao] : []} onChange={(x) => setV({ sinalizacao: x.at(-1) ?? '' })} />
          </div>
        </div>
        <div className="field">
          <span className="label-sm">Contexto</span>
          <Chips label="Contexto da via" opcoes={CONTEXTOS_VIA} valor={v.contexto} onChange={(x) => setV({ contexto: x })} />
        </div>
      </Bloco>
    </div>
  );
}

/** Versão somente leitura dos blocos opcionais (ficha e relatório). */
export function ContextoResumo({ caso }: { caso: Caso }) {
  const d = detalhesDe(caso.investigacao);
  const c = d.condutor;
  const v = d.via;
  const auto = caso.dados?.condutor;
  const veic = caso.dados?.veiculo;
  const lista = (x: string[]) => (x.length ? x.join(', ') : '—');
  return (
    <dl className="kv">
      <dt>Vínculo do motorista</dt>
      <dd>{caso.vinculo || '—'}</dd>
      <dt>CNH</dt>
      <dd>
        {auto?.cnh || c.cnh || '—'} · validade <Validade data={auto?.validadeCnh || c.validadeCnh} dataHora={caso.dataHora} />
      </dd>
      <dt>Toxicológico</dt>
      <dd>
        <Validade data={auto?.validadeToxicologico || c.validadeToxicologico} dataHora={caso.dataHora} />
      </dd>
      <dt>Condição física</dt>
      <dd>
        {lista(c.condicaoFisica)}
        {c.condicaoObs && ` · ${c.condicaoObs}`}
      </dd>
      <dt>Histórico</dt>
      <dd>
        {lista(c.historico)}
        {c.historicoObs && ` · ${c.historicoObs}`}
        {caso.sinistrosAnteriores.length > 0 && ` · ${caso.sinistrosAnteriores.length} sinistro(s) anterior(es)`}
      </dd>
      <dt>Veículo</dt>
      <dd>{veic?.cadastro ? `${veic.cadastro.marca} ${veic.cadastro.modelo} · ${veic.cadastro.ano}` : '—'}</dd>
      <dt>Preventiva</dt>
      <dd>{veic?.preventivas?.length ? veic.preventivas.map((p) => `${p.papel} ${p.placa}: ${fmtData(p.data)} · ${p.km.toLocaleString('pt-BR')} km`).join(' / ') : '—'}</dd>
      <dt>Via</dt>
      <dd>
        {[v.rodovia, v.concessionaria, v.faixas && `${v.faixas} faixas`].filter(Boolean).join(' · ') || '—'}
        {v.pista.length > 0 && ` · pista ${lista(v.pista).toLowerCase()}`}
        {v.pavimentacao && ` · pavimentação ${v.pavimentacao.toLowerCase()}`}
        {v.sinalizacao && ` · sinalização ${v.sinalizacao.toLowerCase()}`}
        {v.contexto.length > 0 && ` · ${lista(v.contexto).toLowerCase()}`}
      </dd>
      <dt>Observações da jornada</dt>
      <dd style={{ whiteSpace: 'pre-wrap' }}>{d.jornadaObs || '—'}</dd>
    </dl>
  );
}
