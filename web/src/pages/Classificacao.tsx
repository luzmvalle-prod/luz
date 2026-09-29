import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CRITERIOS,
  DIMENSOES,
  NIVEIS,
  NIVEL_COR,
  avaliarJornada,
  exigeInvestigacao,
  maxNivel,
  nivelDoCaso,
  type Caso,
  type Classificacao,
  type Danos,
  type DadosColetados,
  type Nivel,
} from '../../../shared/domain.ts';
import { api } from '../api.ts';
import { CasoGate, CasoHeader, useCaso, useMutacao } from '../components/caso.tsx';
import { Card, Field, Seg } from '../components/ui.tsx';
import { fmtDuracao, rotaDaEtapa } from '../format.ts';

export function ClassificacaoPage() {
  const { caso, setCaso, erro } = useCaso();
  return (
    <CasoGate caso={caso} erro={erro} etapas={['classificacao']}>
      {(c) => <Tela caso={c} setCaso={setCaso} />}
    </CasoGate>
  );
}

function Tela({ caso, setCaso }: { caso: Caso; setCaso: (c: Caso) => void }) {
  const nav = useNavigate();
  const { run, ocupado } = useMutacao(setCaso);
  const [cls, setCls] = useState<Pick<Classificacao, 'real' | 'pot' | 'justificativa'>>(() => ({
    real: caso.classificacao.real,
    pot: caso.classificacao.pot,
    justificativa: caso.classificacao.justificativa,
  }));
  const [salvo, setSalvo] = useState(true);
  const primeira = useRef(true);

  // Rascunho salvo automaticamente enquanto a classificação é preenchida.
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    setSalvo(false);
    const t = setTimeout(() => {
      api.salvarClassificacao(caso.id, cls).then(() => setSalvo(true), () => {});
    }, 600);
    return () => clearTimeout(t);
  }, [cls, caso.id]);

  const set = (kind: 'real' | 'pot', key: keyof Danos, v: Nivel) => setCls({ ...cls, [kind]: { ...cls[kind], [key]: v } });
  const r = maxNivel(cls.real);
  const p = maxNivel(cls.pot);
  const n = nivelDoCaso(cls);
  const investiga = exigeInvestigacao(n);
  const precisaJust = p > r && !cls.justificativa.trim();

  async function confirmar() {
    const c = await run(() => api.confirmarClassificacao(caso.id, cls), investiga ? 'Classificação confirmada. Siga para a investigação.' : 'Caso concluído como registro.');
    if (c) nav(rotaDaEtapa(c.id, c.etapa));
  }

  const opts = NIVEIS.map((l, i) => ({ value: String(i) as `${number}`, label: l }));

  return (
    <>
      <CasoHeader caso={caso} eyebrow="Etapa 2 de 5" titulo="Classificação" nivel={n} />
      <div className="content">
        <div className="col">
          <Card title="Consequências" right={<span className="hint">{salvo ? 'Rascunho salvo' : 'Salvando…'}</span>}>
            <p className="help">Marque o dano real e o potencial em cada dimensão. O nível do caso é o maior entre todos.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '12px 16px', alignItems: 'start' }}>
              <span />
              <span className="hint" style={{ color: 'var(--muted)' }}>
                Dano real
              </span>
              <span className="hint" style={{ color: 'var(--muted)' }}>
                Dano potencial
              </span>
              {DIMENSOES.map((d) => (
                <Linha key={d.key} label={d.label}>
                  {(['real', 'pot'] as const).map((k) => (
                    <div key={k} className="stack" style={{ gap: 6 }}>
                      <Seg label={`${d.label} · ${k === 'real' ? 'dano real' : 'dano potencial'}`} value={String(cls[k][d.key]) as `${number}`} options={opts} onChange={(v) => set(k, d.key, Number(v) as Nivel)} />
                      <span className="hint">{CRITERIOS[d.key][cls[k][d.key]]}</span>
                    </div>
                  ))}
                </Linha>
              ))}
            </div>
            <p className="hint">Critérios de cada nível configurados pelo cliente.</p>
            <Field label="Justificativa do potencial" htmlFor="just">
              <textarea
                id="just"
                className="textarea"
                rows={3}
                value={cls.justificativa}
                placeholder="O que poderia ter acontecido e por quê"
                aria-invalid={precisaJust}
                onChange={(e) => setCls({ ...cls, justificativa: e.target.value })}
              />
            </Field>
            {precisaJust && <p className="hint" style={{ color: 'var(--danger)' }}>Obrigatória quando o potencial é maior que o dano real.</p>}
          </Card>
        </div>
        <aside className="aside">
          <Card title="Resultado">
            <div className="rows">
              <Res k="Dano real" n={r} />
              <Res k="Dano potencial" n={p} />
              <Res k="Nível do caso" n={n} forte />
            </div>
            {investiga ? (
              <div className="note warn">Exige investigação. Pela regra do cliente, o comitê se reúne no dia seguinte.</div>
            ) : (
              <div className="note">Abaixo do nível de investigação. O caso será encerrado como registro.</div>
            )}
          </Card>
          <Card title="Dados já coletados">
            <ResumoDados dados={caso.dados} />
          </Card>
        </aside>
      </div>
      <div className="footer-bar">
        <span className="msg">Registrado por {caso.registradoPor}</span>
        <div className="actions">
          <Link className="btn outline" to="/sinistros">
            Voltar
          </Link>
          <button className="btn" onClick={confirmar} disabled={ocupado || precisaJust}>
            {investiga ? 'Confirmar e seguir para investigação' : 'Confirmar e concluir como registro'}
          </button>
        </div>
      </div>
    </>
  );
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span style={{ fontSize: 14, fontWeight: 500, paddingTop: 8 }}>{label}</span>
      {children}
    </>
  );
}

function Res({ k, n, forte }: { k: string; n: Nivel; forte?: boolean }) {
  return (
    <div className="r">
      <span className="k">{k}</span>
      <span className="v" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: forte ? 600 : 500 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: NIVEL_COR[n] }} />
        {NIVEIS[n]}
      </span>
    </div>
  );
}

export function ResumoDados({ dados }: { dados: DadosColetados | null }) {
  if (!dados) return <div className="note">Veículo de terceiro: sem dados da plataforma. Use os anexos do registro.</div>;
  const item = (grupo: string, campo: string) =>
    dados.grupos
      .find((g) => g.nome === grupo)
      ?.itens.filter((i) => i.campo === campo)
      .map((i) => i.valor.split(' · ')[0]);
  const j = dados.jornada;
  return (
    <div className="rows">
      <div className="r">
        <span className="k">Velocidade</span>
        <span className="v">{item('Telemetria', 'Velocidade no momento')?.join(' · ') ?? '—'}</span>
      </div>
      <div className="r">
        <span className="k">Câmera interna</span>
        <span className="v">{item('Vídeo', 'Câmera interna')?.[0] ?? '—'}</span>
      </div>
      <div className="r">
        <span className="k">Última corretiva</span>
        <span className="v">{item('Manutenção', 'Última corretiva')?.[0] ?? '—'}</span>
      </div>
      <div className="r">
        <span className="k">Jornada</span>
        <span className="v">{j ? `${avaliarJornada(j).dentro ? 'Dentro' : 'Fora'} · ${fmtDuracao(j.horasTrabalhadasMin)}` : '—'}</span>
      </div>
      <div className="r">
        <span className="k">Eventos na janela</span>
        <span className="v">{dados.eventos.length}</span>
      </div>
    </div>
  );
}
