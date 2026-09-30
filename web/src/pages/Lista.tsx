import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ETAPA_LABEL, NIVEIS, TIPOS_SINISTRO, tipoLabel, type CasoResumo, type Etapa, type Indicadores } from '../../../shared/domain.ts';
import { api } from '../api.ts';
import { IconChevronRight, Loading, NivelBadge, PageHeader, Shell } from '../components/ui.tsx';
import { fmtData, fmtDataHora, rotaDaEtapa } from '../format.ts';

const ABAS: { label: string; etapas: Etapa[] | null }[] = [
  { label: 'Todos', etapas: null },
  { label: 'Registro', etapas: ['rascunho'] },
  { label: 'Classificação', etapas: ['classificacao'] },
  { label: 'Investigação', etapas: ['investigacao'] },
  { label: 'Acompanhamento', etapas: ['acompanhamento'] },
  { label: 'Concluídos', etapas: ['concluido', 'concluido_sem_investigacao'] },
];

const PERIODOS = [
  { v: '', l: 'Período: todos' },
  { v: '7', l: 'Últimos 7 dias' },
  { v: '30', l: 'Últimos 30 dias' },
  { v: '90', l: 'Últimos 90 dias' },
];

export function Lista() {
  const nav = useNavigate();
  const [casos, setCasos] = useState<CasoResumo[] | null>(null);
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [aba, setAba] = useState(0);
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [nivel, setNivel] = useState('');
  const [unidade, setUnidade] = useState('');
  const [tipo, setTipo] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    api.casos().then(setCasos, (e) => setErro(e.message));
    api.indicadores().then(setInd, () => {});
  }, []);

  const unidades = useMemo(() => [...new Set((casos ?? []).map((c) => c.unidade))].sort(), [casos]);

  const filtrados = useMemo(() => {
    if (!casos) return [];
    const q = busca.trim().toLowerCase();
    const limite = periodo ? new Date(Date.now() - Number(periodo) * 86400000).toISOString().slice(0, 16) : '';
    return casos.filter((c) => {
      const etapas = ABAS[aba].etapas;
      if (etapas && !etapas.includes(c.etapa)) return false;
      if (q && !`${c.placa} ${c.motorista} ${c.id}`.toLowerCase().includes(q)) return false;
      if (limite && c.dataHora < limite) return false;
      if (nivel !== '' && c.nivel !== Number(nivel)) return false;
      if (unidade && c.unidade !== unidade) return false;
      if (tipo && c.tipo !== tipo) return false;
      return true;
    });
  }, [casos, aba, busca, periodo, nivel, unidade, tipo]);

  const contagem = (etapas: Etapa[] | null) => (casos ?? []).filter((c) => !etapas || etapas.includes(c.etapa)).length;
  const temFiltro = busca || periodo || nivel !== '' || unidade || tipo;
  const pe = ind?.abertosPorEtapa;

  return (
    <Shell>
      <PageHeader
        crumbs="Segurança"
        title="Sinistros"
        subtitle="Registre, investigue e acompanhe o plano de ação de cada sinistro."
        actions={
          <Link className="btn" to="/sinistros/novo">
            Registrar sinistro
          </Link>
        }
      >
        <div className="tabs" role="tablist" aria-label="Etapa">
          {ABAS.map((a, i) => (
            <button key={a.label} role="tab" className="tab" aria-selected={aba === i} onClick={() => setAba(i)}>
              {a.label}
              {casos && <span className="count">{contagem(a.etapas)}</span>}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="kpis">
        <Kpi
          destaque
          k="Dias sem gravíssimo"
          v={ind ? (ind.diasSemGravissimo ?? '—') : undefined}
          s={ind?.ultimoGravissimo ? `último em ${fmtData(ind.ultimoGravissimo)}` : 'nenhum registrado'}
        />
        <Kpi k="Sinistros" v={ind?.sinistros30d} s="últimos 30 dias" />
        <Kpi k="Casos abertos" v={ind?.abertos} s={pe ? resumoAbertos(pe) : ''} />
        <Kpi k="Ações sem evidência" v={ind?.acoesSemEvidencia} s="bloqueiam a conclusão" />
      </div>

      <div style={{ padding: '16px 32px', display: 'flex', gap: 8, alignItems: 'center', background: '#fff', borderBottom: '1px solid var(--line)', borderTop: '1px solid var(--line)' }}>
        <label htmlFor="busca" className="sr-only">
          Buscar
        </label>
        <input id="busca" className="input sm" style={{ width: 280 }} placeholder="Buscar por placa, motorista ou nº do caso" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="select sm" style={{ width: 'auto' }} aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map((p) => (
            <option key={p.v} value={p.v}>
              {p.l}
            </option>
          ))}
        </select>
        <select className="select sm" style={{ width: 'auto' }} aria-label="Nível" value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="">Nível: todos</option>
          {NIVEIS.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
        <select className="select sm" style={{ width: 'auto' }} aria-label="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
          <option value="">Unidade: todas</option>
          {unidades.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select className="select sm" style={{ width: 'auto' }} aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo: todos</option>
          {TIPOS_SINISTRO.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {temFiltro && (
          <button
            className="btn ghost sm"
            onClick={() => {
              setBusca('');
              setPeriodo('');
              setNivel('');
              setUnidade('');
              setTipo('');
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {erro ? (
        <div className="empty">
          <div className="note danger" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'left' }}>
            {erro}
          </div>
        </div>
      ) : !casos ? (
        <Loading />
      ) : filtrados.length === 0 ? (
        <div className="empty">Nenhum sinistro encontrado com esses filtros.</div>
      ) : (
        <table className="table list">
          <thead>
            <tr>
              <th>Data e hora</th>
              <th>Veículo</th>
              <th>Motorista</th>
              <th>Tipo</th>
              <th>Nível</th>
              <th>Etapa</th>
              <th>Próximo passo</th>
              <th style={{ width: 64 }}>
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} onClick={() => nav(rotaDaEtapa(c.id, c.etapa))}>
                <td className="muted">{fmtDataHora(c.dataHora)}</td>
                <td>
                  <div className="stack">
                    <span style={{ fontWeight: 500 }}>{c.placa}</span>
                    <span className="sub">
                      {c.modelo} · {c.unidade}
                      {c.propriedade === 'terceiro' && ' · terceiro'}
                    </span>
                  </div>
                </td>
                <td>{c.motorista}</td>
                <td>{tipoLabel(c)}</td>
                <td>
                  <NivelBadge nivel={c.nivel} />
                </td>
                <td>{ETAPA_LABEL[c.etapa]}</td>
                <td>{c.proximoPasso}</td>
                <td style={{ padding: '0 24px 0 8px' }}>
                  <Link to={rotaDaEtapa(c.id, c.etapa)} className="icon-btn" aria-label={`Abrir caso ${c.placa}`} onClick={(e) => e.stopPropagation()}>
                    <IconChevronRight />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}

function resumoAbertos(pe: Indicadores['abertosPorEtapa']) {
  const partes = [
    [pe.rascunho, 'em registro'],
    [pe.classificacao, 'classif.'],
    [pe.investigacao, 'invest.'],
    [pe.acompanhamento, 'acomp.'],
  ].filter(([n], i) => i > 0 || Number(n) > 0);
  if (!pe.rascunho && pe.classificacao === pe.investigacao && pe.investigacao === pe.acompanhamento) return `${pe.classificacao} em cada etapa`;
  return partes.map(([n, l]) => `${n} ${l}`).join(' · ');
}

function Kpi({ k, v, s, destaque }: { k: string; v: number | string | undefined; s: string; destaque?: boolean }) {
  return (
    <div className={`kpi ${destaque ? 'destaque' : ''}`}>
      <span className="k">{k}</span>
      <span className="v">{v ?? '·'}</span>
      <span className="s">{s}</span>
    </div>
  );
}
