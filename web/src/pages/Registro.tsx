import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CONDICOES_VIA, LESOES, PAPEIS_ENVOLVIDO, TIPOS_SINISTRO, type Envolvido, type Propriedade } from '../../../shared/domain.ts';
import { ApiError, api } from '../api.ts';
import { Card, ErrosNote, Field, FileButton, Modal, PageHeader, Seg, Shell, Stepper, useToast } from '../components/ui.tsx';
import { fmtBytes } from '../format.ts';

type Veiculo = { placa: string; modelo: string; unidade: string; motorista: string };

function agoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function Registro() {
  const nav = useNavigate();
  const toast = useToast();
  const [frota, setFrota] = useState<Veiculo[]>([]);
  const [prop, setProp] = useState<Propriedade>('proprio');
  const [placa, setPlaca] = useState('');
  const [dataHora, setDataHora] = useState(agoraLocal());
  const [motorista, setMotorista] = useState('');
  const [local, setLocal] = useState('');
  const [tipo, setTipo] = useState('');
  const [condicaoVia, setCondicaoVia] = useState('Não informada');
  const [proprietario, setProprietario] = useState('');
  const [documento, setDocumento] = useState('');
  const [cnh, setCnh] = useState('');
  const [modelo, setModelo] = useState('');
  const [lesaoMotorista, setLesaoMotorista] = useState('Sem lesão');
  const [outros, setOutros] = useState<Envolvido[]>([]);
  const [relato, setRelato] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [modalEnv, setModalEnv] = useState(false);
  const [origem, setOrigem] = useState<'telemetria' | 'manual' | null>(null);
  const editado = useRef({ motorista: false, local: false });

  useEffect(() => {
    api.frota().then(setFrota, () => {});
  }, []);

  const veiculo = useMemo(() => frota.find((v) => v.placa === placa.trim().toUpperCase()), [frota, placa]);

  // Veículo próprio: motorista e local vêm da telemetria no horário informado.
  useEffect(() => {
    if (prop !== 'proprio' || !veiculo || dataHora.length !== 16) return;
    let vivo = true;
    api
      .posicao(veiculo.placa, dataHora)
      .then((p) => {
        if (!vivo) return;
        if (!editado.current.motorista) setMotorista(p.motorista);
        if (!editado.current.local) setLocal(p.local);
        setOrigem('telemetria');
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [prop, veiculo, dataHora]);

  const envolvidos: Envolvido[] = [
    { nome: motorista.trim() || 'Motorista', papel: 'Motorista do veículo', veiculo: placa.trim().toUpperCase(), lesao: lesaoMotorista },
    ...outros,
  ];

  async function registrar() {
    setErros([]);
    setEnviando(true);
    const dados = {
      propriedade: prop,
      placa,
      dataHora,
      motorista,
      local,
      tipo,
      condicaoVia,
      relato,
      envolvidos,
      ...(prop === 'terceiro' ? { terceiro: { proprietario, documento, cnh }, modelo } : {}),
    };
    const fd = new FormData();
    fd.append('dados', JSON.stringify(dados));
    arquivos.forEach((f) => fd.append('anexos', f));
    try {
      const c = await api.registrar(fd);
      toast(`Caso ${c.id} registrado`);
      nav(`/sinistros/${c.id}/classificacao`);
    } catch (e) {
      const err = e as ApiError;
      setErros(err.detalhes?.length ? err.detalhes : [err.message]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  }

  const tipoSelect = (
    <select id="tipo" className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
      <option value="">Selecione</option>
      {TIPOS_SINISTRO.map((t) => (
        <option key={t}>{t}</option>
      ))}
    </select>
  );
  const viaSelect = (
    <select id="via" className="select" value={condicaoVia} onChange={(e) => setCondicaoVia(e.target.value)}>
      {CONDICOES_VIA.map((t) => (
        <option key={t}>{t}</option>
      ))}
    </select>
  );

  return (
    <Shell>
      <PageHeader crumbs={<><Link to="/sinistros">Sinistros</Link> / Novo</>} eyebrow="Etapa 1 de 5" title="Registro do sinistro">
        <Stepper atual={0} />
      </PageHeader>

      <div className="content">
        <div className="col">
          <ErrosNote titulo="Não foi possível registrar" itens={erros} />
          <Card title="Identificação">
            <div className="field">
              <span className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>
                Veículo
              </span>
              <Seg
                label="Propriedade do veículo"
                width={320}
                value={prop}
                onChange={setProp}
                options={[
                  { value: 'proprio', label: 'Próprio da frota' },
                  { value: 'terceiro', label: 'De terceiro' },
                ]}
              />
            </div>

            {prop === 'proprio' ? (
              <>
                <div className="grid3">
                  <Field label="Placa" htmlFor="placa">
                    <input id="placa" className="input" list="frota" placeholder="Placa" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} aria-invalid={!!placa && !veiculo} />
                    <datalist id="frota">
                      {frota.map((v) => (
                        <option key={v.placa} value={v.placa}>
                          {v.modelo} · {v.unidade}
                        </option>
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Data e hora" htmlFor="datahora">
                    <input id="datahora" type="datetime-local" className="input" value={dataHora} max={agoraLocal()} onChange={(e) => setDataHora(e.target.value)} />
                  </Field>
                  <Field label="Motorista" htmlFor="motorista">
                    <input
                      id="motorista"
                      className="input"
                      placeholder="Vinculado ao veículo"
                      value={motorista}
                      onChange={(e) => {
                        editado.current.motorista = true;
                        setMotorista(e.target.value);
                      }}
                    />
                  </Field>
                  <Field label="Local" htmlFor="local" className="span2">
                    <input
                      id="local"
                      className="input"
                      placeholder="Posição da telemetria"
                      value={local}
                      onChange={(e) => {
                        editado.current.local = true;
                        setLocal(e.target.value);
                      }}
                    />
                  </Field>
                  <Field label="Tipo" htmlFor="tipo">
                    {tipoSelect}
                  </Field>
                  <Field label="Condição da via" htmlFor="via">
                    {viaSelect}
                  </Field>
                </div>
                {placa && !veiculo ? (
                  <div className="note warn">Placa não encontrada na frota. Se o veículo não tem equipamento INFLEET, escolha “De terceiro”.</div>
                ) : veiculo ? (
                  <p className="hint">
                    {veiculo.modelo} · {veiculo.unidade}.{' '}
                    {origem === 'telemetria' ? 'Motorista e local vêm da telemetria no horário informado. Você pode corrigir.' : ''}
                  </p>
                ) : (
                  <p className="hint">Motorista e local vêm da telemetria no horário informado. Você pode corrigir.</p>
                )}
              </>
            ) : (
              <>
                <div className="grid3">
                  <Field label="Placa" htmlFor="t-placa">
                    <input id="t-placa" className="input" placeholder="Placa do veículo" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Proprietário ou transportadora" htmlFor="t-dono">
                    <input id="t-dono" className="input" placeholder="Razão social" value={proprietario} onChange={(e) => setProprietario(e.target.value)} />
                  </Field>
                  <Field label="CNPJ ou CPF do proprietário" htmlFor="t-cnpj">
                    <input id="t-cnpj" className="input" placeholder="00.000.000/0000-00" value={documento} onChange={(e) => setDocumento(e.target.value)} />
                  </Field>
                  <Field label="Motorista" htmlFor="t-motorista">
                    <input id="t-motorista" className="input" placeholder="Nome completo" value={motorista} onChange={(e) => setMotorista(e.target.value)} />
                  </Field>
                  <Field label="CNH do motorista" htmlFor="t-cnh">
                    <input id="t-cnh" className="input" placeholder="Número da CNH" value={cnh} onChange={(e) => setCnh(e.target.value)} />
                  </Field>
                  <Field label="Data e hora" htmlFor="t-datahora">
                    <input id="t-datahora" type="datetime-local" className="input" value={dataHora} max={agoraLocal()} onChange={(e) => setDataHora(e.target.value)} />
                  </Field>
                  <Field label="Local" htmlFor="t-local" className="span2">
                    <input id="t-local" className="input" placeholder="Endereço ou rodovia e km" value={local} onChange={(e) => setLocal(e.target.value)} />
                  </Field>
                  <Field label="Tipo" htmlFor="tipo">
                    {tipoSelect}
                  </Field>
                  <Field label="Modelo do veículo" htmlFor="t-modelo">
                    <input id="t-modelo" className="input" placeholder="Opcional" value={modelo} onChange={(e) => setModelo(e.target.value)} />
                  </Field>
                  <Field label="Condição da via" htmlFor="via">
                    {viaSelect}
                  </Field>
                </div>
                <div className="note">Veículo sem equipamento INFLEET. Telemetria, vídeo e jornada não serão puxados automaticamente: anexe o que o proprietário fornecer.</div>
              </>
            )}
          </Card>

          <Card title="Envolvidos">
            <table className="table flush">
              <thead>
                <tr>
                  <th>Envolvido</th>
                  <th>Papel</th>
                  <th>Veículo</th>
                  <th>Lesão</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {envolvidos.map((e, i) => (
                  <tr key={i}>
                    <td>{e.nome}</td>
                    <td className="muted">{e.papel}</td>
                    <td className="muted">{e.veiculo || '—'}</td>
                    <td className="muted">
                      {i === 0 ? (
                        <select className="select sm" aria-label="Lesão do motorista" value={lesaoMotorista} onChange={(ev) => setLesaoMotorista(ev.target.value)}>
                          {LESOES.map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                      ) : (
                        e.lesao
                      )}
                    </td>
                    <td>
                      {i > 0 && (
                        <button className="icon-btn" aria-label={`Remover ${e.nome}`} onClick={() => setOutros(outros.filter((_, k) => k !== i - 1))}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <button className="btn ghost sm" onClick={() => setModalEnv(true)}>
                Adicionar envolvido
              </button>
            </div>
          </Card>

          <Card title="Relato inicial e anexos">
            <Field label="Relato do motorista" htmlFor="relato">
              <textarea id="relato" className="textarea" rows={3} value={relato} onChange={(e) => setRelato(e.target.value)} placeholder="O que o motorista relatou ao monitoramento ou à manutenção" />
            </Field>
            <div className="field">
              <span className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>
                Anexos
              </span>
              {arquivos.map((f, i) => (
                <div className="file" key={i}>
                  <span>{f.name}</span>
                  <span className="meta">
                    {fmtBytes(f.size)}{' '}
                    <button className="btn danger sm" onClick={() => setArquivos(arquivos.filter((_, k) => k !== i))}>
                      Remover
                    </button>
                  </span>
                </div>
              ))}
              <div>
                <FileButton multiple onFiles={(f) => setArquivos([...arquivos, ...f])}>
                  Anexar arquivo
                </FileButton>
              </div>
            </div>
          </Card>
        </div>

        <aside className="aside">
          <Card title="Ao registrar">
            <ul className="help" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>O caso é criado e aparece na lista.</li>
              {prop === 'proprio' ? (
                <li>Veículo próprio: jornada, eventos de telemetria e videotelemetria, manutenção e vídeo da janela são puxados e congelados.</li>
              ) : (
                <li>Veículo de terceiro: o caso segue com os dados e anexos informados.</li>
              )}
              <li>Você segue para a classificação.</li>
            </ul>
          </Card>
        </aside>
      </div>

      <div className="footer-bar">
        <span className="msg">Campos obrigatórios: placa, data e hora, motorista, local e tipo.</span>
        <div className="actions">
          <Link className="btn outline" to="/sinistros">
            Cancelar
          </Link>
          <button className="btn" onClick={registrar} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar e classificar'}
          </button>
        </div>
      </div>

      {modalEnv && (
        <EnvolvidoModal
          onClose={() => setModalEnv(false)}
          onSave={(e) => {
            setOutros([...outros, e]);
            setModalEnv(false);
          }}
        />
      )}
    </Shell>
  );
}

export function EnvolvidoModal({ onClose, onSave }: { onClose: () => void; onSave: (e: Envolvido) => void }) {
  const [e, setE] = useState<Envolvido>({ nome: '', papel: 'Condutor de terceiro', veiculo: '', lesao: 'Sem lesão' });
  const ok = e.nome.trim() && e.papel;
  return (
    <Modal
      title="Adicionar envolvido"
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!ok} onClick={() => onSave(e)}>
            Adicionar
          </button>
        </>
      }
    >
      <Field label="Nome" htmlFor="env-nome">
        <input id="env-nome" className="input" autoFocus placeholder="Nome ou “Não identificado”" value={e.nome} onChange={(x) => setE({ ...e, nome: x.target.value })} />
      </Field>
      <div className="grid2">
        <Field label="Papel" htmlFor="env-papel">
          <select id="env-papel" className="select" value={e.papel} onChange={(x) => setE({ ...e, papel: x.target.value })}>
            {PAPEIS_ENVOLVIDO.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Lesão" htmlFor="env-lesao">
          <select id="env-lesao" className="select" value={e.lesao} onChange={(x) => setE({ ...e, lesao: x.target.value })}>
            {LESOES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Veículo" htmlFor="env-veic">
        <input id="env-veic" className="input" placeholder="Placa ou descrição" value={e.veiculo} onChange={(x) => setE({ ...e, veiculo: x.target.value })} />
      </Field>
    </Modal>
  );
}
