import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DIMENSOES, ETAPA_LABEL, NIVEIS, STATUS_ACAO_LABEL, avaliarJornada, eventoCorrigido, origemDoNivel, tipoLabel } from '../../../shared/domain.ts';
import { useCaso } from '../components/caso.tsx';
import { Loading } from '../components/ui.tsx';
import { DEMO } from '../demo/flag.ts';
import logo from '../infleet-logo.png';
import { ContextoResumo } from '../components/contexto.tsx';
import { fmtData, fmtDataHora, fmtDuracao } from '../format.ts';

/** Relatório consolidado do caso, pensado para "Imprimir → Salvar como PDF". */
export function Relatorio() {
  const { caso: c, erro } = useCaso();
  useEffect(() => {
    if (c) document.title = `Relatório ${c.id} · ${c.placa}`;
    return () => {
      document.title = 'Sinistros · INFLEET';
    };
  }, [c]);
  if (erro) return <div className="loading">{erro}</div>;
  if (!c) return <Loading />;
  const inv = c.investigacao;
  const d = c.dados;
  return (
    <>
      <div className="report-toolbar no-print">
        <Link to={`/sinistros/${c.id}/ficha`}>← Voltar para a ficha</Link>
        {DEMO ? (
          <span className="hint">Na demonstração, a impressão fica desativada. No sistema, este relatório vira PDF.</span>
        ) : (
          <button className="btn" onClick={() => window.print()}>
            Imprimir ou salvar PDF
          </button>
        )}
      </div>
      <article className="report">
        <header className="stack" style={{ gap: 6 }}>
          <img src={logo} alt="INFLEET" style={{ height: 22, width: 'auto', alignSelf: 'flex-start' }} />
          <h1>
            Relatório do sinistro {c.id} · {NIVEIS[c.nivel]}
          </h1>
          <span className="subtitle">
            {tipoLabel(c)} · {c.placa} · {c.modelo} · {c.motorista} · {fmtDataHora(c.dataHora)} · Etapa: {ETAPA_LABEL[c.etapa]}
          </span>
        </header>

        <section>
          <h2>Identificação</h2>
          <dl className="kv">
            <dt>Local</dt>
            <dd>{c.local}</dd>
            <dt>Propriedade</dt>
            <dd>{c.propriedade === 'proprio' ? 'Própria da frota' : `De terceiro · ${c.terceiro?.proprietario ?? ''}`}</dd>
            <dt>Vínculo do motorista</dt>
            <dd>{c.vinculo || '—'}</dd>
            {(c.operacao || c.rnc || c.bo) && (
              <>
                <dt>Operação · RNC · BO</dt>
                <dd>
                  {c.operacao || '—'} · {c.rnc || '—'} · {c.bo || '—'}
                </dd>
              </>
            )}
            <dt>Condição da via</dt>
            <dd>{c.condicaoVia}</dd>
            <dt>Relato do motorista</dt>
            <dd>{c.relato || '—'}</dd>
            <dt>Registrado por</dt>
            <dd>
              {c.registradoPor} · {fmtDataHora(c.registradoEm)}
            </dd>
          </dl>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Envolvido</th>
                <th>Papel</th>
                <th>Veículo</th>
                <th>Lesão</th>
              </tr>
            </thead>
            <tbody>
              {c.envolvidos.map((e, i) => (
                <tr key={i}>
                  <td>{e.nome}</td>
                  <td>{e.papel}</td>
                  <td>{e.veiculo || '—'}</td>
                  <td>{e.lesao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Classificação</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Dimensão</th>
                <th>Dano real</th>
                <th>Dano potencial</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSOES.map((x) => (
                <tr key={x.key}>
                  <td>{x.label}</td>
                  <td>{NIVEIS[c.classificacao.real[x.key]]}</td>
                  <td>{NIVEIS[c.classificacao.pot[x.key]]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="help" style={{ marginTop: 8 }}>
            {NIVEIS[c.nivel]} pelo {origemDoNivel(c.classificacao)}. {c.classificacao.justificativa}
            {c.classificacao.valorPrejuizo != null && ` Valor estimado do prejuízo: ${c.classificacao.valorPrejuizo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`}
          </p>
        </section>

        {d && (
          <section>
            <h2>Dados coletados (congelados em {fmtDataHora(d.coletadoEm)})</h2>
            <table className="table">
              <tbody>
                {d.grupos.flatMap((g) =>
                  g.itens.map((i, k) => (
                    <tr key={g.nome + k}>
                      <td>{g.nome}</td>
                      <td>{i.campo}</td>
                      <td>{i.valor}</td>
                      <td>{i.fonte}</td>
                    </tr>
                  )),
                )}
                {d.eventos.map((e) => (
                  <tr key={e.id}>
                    <td>Evento{inv.evidencias.includes(e.id) ? ' · evidência' : ''}</td>
                    <td>
                      {eventoCorrigido(c.correcoes, e.id) ? `${eventoCorrigido(c.correcoes, e.id)!.corrigido} (corrigido; era ${e.evento})` : e.evento}
                    </td>
                    <td>
                      {e.horario}
                      {e.velocidade != null && ` · ${e.velocidade} km/h`}
                    </td>
                    <td>{e.origem}</td>
                  </tr>
                ))}
                {d.jornada && (
                  <tr>
                    <td>Jornada</td>
                    <td>{avaliarJornada(d.jornada).dentro ? 'Dentro da jornada' : 'Fora da jornada'}</td>
                    <td>
                      {fmtDuracao(d.jornada.horasTrabalhadasMin)} trabalhadas · {fmtDuracao(d.jornada.direcaoContinuaMin)} direção contínua
                    </td>
                    <td>Jornada</td>
                  </tr>
                )}
              </tbody>
            </table>
            {d.observacoes.map((o) => (
              <p key={o} className="hint">
                {o}
              </p>
            ))}
          </section>
        )}

        {(c.etapa === 'investigacao' || c.etapa === 'acompanhamento' || c.etapa === 'concluido') && (
          <section>
            <h2>Contexto do acidente</h2>
            <ContextoResumo caso={c} />
          </section>
        )}

        {inv.causaRaiz && (
          <section>
            <h2>Investigação</h2>
            <dl className="kv">
              <dt>Comitê</dt>
              <dd>
                {inv.participantes.join(', ')} · {fmtData(inv.comiteData)}
              </dd>
              <dt>Constatado</dt>
              <dd>{inv.constatado || '—'}</dd>
              <dt>Causa raiz</dt>
              <dd>{inv.causaRaiz}</dd>
              <dt>Grau de certeza</dt>
              <dd>{inv.certeza}</dd>
              <dt>Evitabilidade</dt>
              <dd>{inv.evitabilidade}</dd>
              <dt>Responsabilidade legal</dt>
              <dd>{inv.responsabilidade}</dd>
            </dl>
            <table className="table" style={{ marginTop: 12 }}>
              <tbody>
                {inv.hipoteses.map((h) => (
                  <tr key={h.id}>
                    <td>{h.tipo}</td>
                    <td>{h.descricao}</td>
                    <td>{h.evidencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {c.acoes.length > 0 && (
          <section>
            <h2>Plano de ação e evidências</h2>
            <table className="table">
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
                {c.acoes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.titulo}</td>
                    <td>{a.responsavel}</td>
                    <td>{fmtData(a.prazo)}</td>
                    <td>
                      {STATUS_ACAO_LABEL[a.status]}
                      {a.concluidaEm && ` em ${fmtData(a.concluidaEm)}`}
                    </td>
                    <td>{a.evidencia?.nome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2>Histórico</h2>
          <table className="table">
            <tbody>
              {c.historico.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDataHora(h.data)}</td>
                  <td>
                    {h.evento}
                    {h.motivo && ` · motivo: ${h.motivo}`}
                  </td>
                  <td>{h.autor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.concluidoEm && (
            <p className="help" style={{ marginTop: 8 }}>
              Concluído por {c.concluidoPor} em {fmtDataHora(c.concluidoEm)}.
            </p>
          )}
        </section>
      </article>
    </>
  );
}
