import {
  CERTEZAS,
  DIMENSOES,
  ETAPA_LABEL,
  EMPTY_DANOS,
  EMPTY_INVESTIGACAO,
  EVITABILIDADES,
  CONDICOES_FISICAS,
  CONTEXTOS_VIA,
  EMPTY_DETALHES,
  HISTORICO_ITENS,
  PISTA_CONDICOES,
  QUALIDADES,
  VINCULOS,
  LESOES,
  PRAZO_CORRECAO_DIAS,
  TIPOS_EVENTO,
  diasDesde,
  eventoCorrigido,
  podeCorrigirEvento,
  tipoLabel,
  NIVEIS,
  RESPONSABILIDADES,
  exigeInvestigacao,
  maxNivel,
  nivelDoCaso,
  origemDoNivel,
  pendenciasInvestigacao,
  proximoPasso,
  type Acao,
  type Anexo,
  type Caso,
  type CasoResumo,
  type Classificacao,
  type CorrecaoEvento,
  type Danos,
  type DadosColetados,
  type DetalhesInvestigacao,
  type DadosTerceiro,
  type Envolvido,
  type Etapa,
  type EventoHistorico,
  type Indicadores,
  type Investigacao,
  type Nivel,
  type Propriedade,
  type StatusAcao,
  type Usuario,
} from '../shared/domain.ts';
import { tx, type Db } from './schema.ts';
import { agora, hoje } from './tempo.ts';
import { coletarDados, consultarPosicao, veiculo } from './plataforma.ts';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalhes?: string[],
  ) {
    super(message);
  }
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const J = <T>(v: unknown): T => JSON.parse(String(v)) as T;
const autor = (u: Usuario) => u.nome;

export interface ArquivoRecebido {
  originalname: string;
  size: number;
  mimetype: string;
  path?: string;
  buffer?: Uint8Array;
}

/** Onde os arquivos dos anexos ficam guardados (disco no servidor, memória na demonstração). */
export interface Arquivos {
  salvar(arquivo: string, f: ArquivoRecebido): void;
}

const randomUUID = () => globalThis.crypto.randomUUID();

export class Casos {
  constructor(
    private db: Db,
    private arquivos: Arquivos,
  ) {}

  // ---------------------------------------------------------------- leitura

  usuarios(): Usuario[] {
    return this.db.prepare('SELECT id, nome, setor FROM usuarios ORDER BY nome').all() as unknown as Usuario[];
  }

  usuario(id: string | undefined): Usuario {
    const u = id ? (this.db.prepare('SELECT id, nome, setor FROM usuarios WHERE id = ?').get(id) as Usuario | undefined) : undefined;
    return u ?? this.usuarios()[0];
  }

  private rowCaso(id: string): Row {
    const r = this.db.prepare('SELECT * FROM casos WHERE id = ?').get(id) as Row | undefined;
    if (!r) throw new HttpError(404, 'Caso não encontrado');
    return r;
  }

  private anexos(casoId: string): Anexo[] {
    return (this.db.prepare('SELECT * FROM anexos WHERE caso_id = ? ORDER BY enviado_em, rowid').all(casoId) as Row[]).map(mapAnexo);
  }

  private acoes(casoId: string, anexos = this.anexos(casoId)): Acao[] {
    const hj = hoje();
    return (this.db.prepare('SELECT * FROM acoes WHERE caso_id = ? ORDER BY ordem').all(casoId) as Row[]).map((r) => {
      const status = r.status as StatusAcao;
      return {
        id: String(r.id),
        casoId: String(r.caso_id),
        titulo: String(r.titulo),
        responsavel: String(r.responsavel),
        prazo: String(r.prazo),
        status,
        evidencia: anexos.find((a) => a.id === r.evidencia_id) ?? null,
        concluidaPor: s(r.concluida_por),
        concluidaEm: s(r.concluida_em),
        atrasada: status !== 'concluida' && String(r.prazo) < hj,
      };
    });
  }

  private historico(casoId: string): EventoHistorico[] {
    return this.db
      .prepare('SELECT id, data, evento, autor, motivo FROM historico WHERE caso_id = ? ORDER BY data DESC, id DESC')
      .all(casoId) as unknown as EventoHistorico[];
  }

  /** Sinistros anteriores do mesmo motorista (histórico além da telemetria). */
  private anteriores(id: string, motorista: string, dataHora: string): Caso['sinistrosAnteriores'] {
    if (!motorista.trim()) return [];
    return (
      this.db
        .prepare("SELECT id, data_hora, tipo, tipo_outro, nivel FROM casos WHERE motorista = ? AND id <> ? AND data_hora < ? AND etapa <> 'rascunho' ORDER BY data_hora DESC")
        .all(motorista, id, dataHora) as Row[]
    ).map((x) => ({ id: String(x.id), dataHora: String(x.data_hora), tipo: String(x.tipo), tipoOutro: String(x.tipo_outro ?? ''), nivel: Number(x.nivel) as Nivel }));
  }

  obter(id: string): Caso {
    const r = this.rowCaso(id);
    const anexos = this.anexos(id);
    const acoes = this.acoes(id, anexos);
    const etapa = r.etapa as Etapa;
    return {
      id: String(r.id),
      placa: String(r.placa),
      modelo: String(r.modelo),
      categoria: String(r.categoria),
      unidade: String(r.unidade),
      propriedade: r.propriedade as Propriedade,
      terceiro: r.terceiro ? J<DadosTerceiro>(r.terceiro) : null,
      motorista: String(r.motorista),
      dataHora: String(r.data_hora),
      local: String(r.local),
      tipo: String(r.tipo),
      tipoOutro: String(r.tipo_outro ?? ''),
      condicaoVia: String(r.condicao_via),
      vinculo: String(r.vinculo ?? ''),
      rnc: String(r.rnc ?? ''),
      bo: String(r.bo ?? ''),
      operacao: String(r.operacao ?? ''),
      sinistrosAnteriores: this.anteriores(String(r.id), String(r.motorista), String(r.data_hora)),
      relato: String(r.relato),
      envolvidos: J<Envolvido[]>(r.envolvidos),
      etapa,
      nivel: Number(r.nivel) as Nivel,
      classificacao: J<Classificacao>(r.classificacao),
      investigacao: { ...EMPTY_INVESTIGACAO, ...J<Investigacao>(r.investigacao) },
      dados: r.dados ? J(r.dados) : null,
      correcoes: J<CorrecaoEvento[]>(r.correcoes ?? '[]'),
      registradoPor: String(r.registrado_por),
      registradoEm: String(r.registrado_em),
      concluidoPor: s(r.concluido_por),
      concluidoEm: s(r.concluido_em),
      acoes,
      anexos: anexos.filter((a) => a.contexto !== 'evidencia'),
      historico: this.historico(id),
      proximoPasso: proximoPasso(etapa, acoes),
    };
  }

  listar(): CasoResumo[] {
    const rows = this.db.prepare('SELECT id, placa, modelo, unidade, motorista, data_hora, tipo, tipo_outro, nivel, etapa, propriedade FROM casos ORDER BY data_hora DESC').all() as Row[];
    return rows.map((r) => {
      const etapa = r.etapa as Etapa;
      return {
        id: String(r.id),
        placa: String(r.placa),
        modelo: String(r.modelo),
        unidade: String(r.unidade),
        motorista: String(r.motorista),
        dataHora: String(r.data_hora),
        tipo: String(r.tipo),
        tipoOutro: String(r.tipo_outro ?? ''),
        nivel: Number(r.nivel) as Nivel,
        etapa,
        propriedade: r.propriedade as Propriedade,
        proximoPasso: etapa === 'acompanhamento' ? proximoPasso(etapa, this.acoes(String(r.id))) : proximoPasso(etapa, []),
      };
    });
  }

  indicadores(): Indicadores {
    const agoraIso = agora();
    const limite = new Date(Date.parse(agoraIso + ':00Z') - 30 * 86400000).toISOString().slice(0, 16);
    const casos = this.db.prepare('SELECT id, data_hora, nivel, etapa FROM casos').all() as Row[];
    const recentes = casos.filter((c) => String(c.data_hora) >= limite);
    const porEtapa = { rascunho: 0, classificacao: 0, investigacao: 0, acompanhamento: 0 };
    for (const c of casos) if (String(c.etapa) in porEtapa) porEtapa[c.etapa as keyof typeof porEtapa]++;
    const semEvid = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM acoes a JOIN casos c ON c.id = a.caso_id
         WHERE c.etapa IN ('investigacao','acompanhamento') AND a.status <> 'concluida' AND a.evidencia_id IS NULL`,
      )
      .get() as { n: number };
    const ult = casos
      .filter((c) => Number(c.nivel) === 3)
      .map((c) => String(c.data_hora))
      .sort()
      .pop();
    const dias = ult ? Math.floor((Date.parse(agoraIso.slice(0, 10)) - Date.parse(ult.slice(0, 10))) / 86400000) : null;
    return {
      sinistros30d: recentes.length,
      graves30d: recentes.filter((c) => Number(c.nivel) >= 2).length,
      abertos: porEtapa.rascunho + porEtapa.classificacao + porEtapa.investigacao + porEtapa.acompanhamento,
      abertosPorEtapa: porEtapa,
      acoesSemEvidencia: Number(semEvid.n),
      diasSemGravissimo: dias,
      ultimoGravissimo: ult ?? null,
    };
  }

  arquivoDoAnexo(id: string): { anexo: Anexo; arquivo: string } {
    const r = this.db.prepare('SELECT * FROM anexos WHERE id = ?').get(id) as Row | undefined;
    if (!r) throw new HttpError(404, 'Anexo não encontrado');
    return { anexo: mapAnexo(r), arquivo: String(r.arquivo) };
  }

  // ---------------------------------------------------------------- escrita

  log(casoId: string, evento: string, u: Usuario | string, motivo: string | null = null, data = agora()) {
    this.db
      .prepare('INSERT INTO historico (caso_id, data, evento, autor, motivo) VALUES (?, ?, ?, ?, ?)')
      .run(casoId, data, evento, typeof u === 'string' ? u : autor(u), motivo);
  }

  private exigirEtapa(r: Row, ...etapas: Etapa[]) {
    if (!etapas.includes(r.etapa as Etapa))
      throw new HttpError(409, `Operação indisponível: o caso está em ${ETAPA_LABEL[r.etapa as Etapa]}`);
  }

  private novoId(): string {
    const ano = agora().slice(0, 4);
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM casos WHERE id LIKE ?").get(`SIN-${ano}-%`) as { n: number };
    return `SIN-${ano}-${String(Number(r.n) + 1).padStart(4, '0')}`;
  }

  salvarArquivo(casoId: string, contexto: Anexo['contexto'], f: ArquivoRecebido, u: Usuario, acaoId: string | null = null, data = agora()): Anexo {
    const id = randomUUID();
    const ext = /\.[A-Za-z0-9]{1,10}$/.exec(f.originalname)?.[0] ?? '';
    const arquivo = `${id}${ext}`;
    this.arquivos.salvar(arquivo, f);
    this.db
      .prepare('INSERT INTO anexos (id, caso_id, acao_id, contexto, nome, tamanho, mime, arquivo, enviado_por, enviado_em) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, casoId, acaoId, contexto, f.originalname, f.size, f.mimetype || 'application/octet-stream', arquivo, autor(u), data);
    return mapAnexo(this.db.prepare('SELECT * FROM anexos WHERE id = ?').get(id) as Row);
  }

  /**
   * Registra um sinistro. Com `rascunho`, basta placa e horário (registro rápido); o caso fica
   * na etapa "rascunho" até ser completado. Com `id`, atualiza/completa um rascunho existente.
   */
  registrar(input: RegistroInput, arquivos: ArquivoRecebido[], u: Usuario, quando = agora(), opts: { rascunho?: boolean; id?: string } = {}): Caso {
    const rascunho = !!opts.rascunho;
    const e = validarRegistro(input, rascunho);
    if (e.length) throw new HttpError(422, rascunho ? 'Para salvar o rascunho, informe placa e horário' : 'Revise os campos do registro', e);
    const placa = input.placa.toUpperCase().trim();
    const v = input.propriedade === 'proprio' ? veiculo(placa) : undefined;
    if (input.propriedade === 'proprio' && !v) throw new HttpError(422, 'Placa não encontrada na frota', ['Para veículo de terceiro, escolha "De terceiro"']);
    const atual = opts.id ? this.rowCaso(opts.id) : null;
    if (atual) this.exigirEtapa(atual, 'rascunho');

    // Veículo próprio: motorista e local vêm da telemetria quando não informados.
    const pos = v ? consultarPosicao(placa, input.dataHora) : null;
    const motorista = input.motorista?.trim() || pos?.motorista || '';
    const local = input.local?.trim() || pos?.local || '';
    const tipo = input.tipo && input.tipo !== 'Selecione' ? input.tipo : '';
    const envolvidos = (input.envolvidos ?? []).map((x, i) => (i === 0 && x.papel === 'Motorista do veículo' && (!x.nome.trim() || x.nome === 'Motorista') && motorista ? { ...x, nome: motorista } : x));

    return tx(this.db, () => {
      const id = atual ? String(atual.id) : this.novoId();
      // Dados da janela são puxados e congelados na abertura; só são refeitos se placa ou horário mudarem no rascunho.
      const mudouJanela = !atual || atual.placa !== placa || atual.data_hora !== input.dataHora || atual.propriedade !== input.propriedade;
      const dados = mudouJanela ? (v ? coletarDados(placa, input.dataHora, quando, tipo) : null) : atual.dados ? J<DadosColetados>(atual.dados) : null;
      const valores = [
        placa,
        v?.modelo ?? (input.modelo?.trim() || 'Veículo de terceiro'),
        v?.categoria ?? 'Terceiro',
        v?.unidade ?? (input.unidade?.trim() || 'Terceiro'),
        input.propriedade,
        input.propriedade === 'terceiro' ? JSON.stringify(input.terceiro ?? { proprietario: '', documento: '', cnh: '' }) : null,
        motorista,
        input.dataHora,
        local,
        tipo,
        tipo === 'Outro' ? (input.tipoOutro ?? '').trim() : '',
        input.condicaoVia || 'Não informada',
        input.relato?.trim() ?? '',
        JSON.stringify(envolvidos),
        rascunho ? 'rascunho' : 'classificacao',
        dados ? JSON.stringify(dados) : null,
        VINCULOS.includes(input.vinculo as (typeof VINCULOS)[number]) ? input.vinculo! : input.propriedade === 'terceiro' ? 'Terceiro' : 'Frota',
        (input.rnc ?? '').trim(),
        (input.bo ?? '').trim(),
        (input.operacao ?? '').trim(),
      ] as const;
      if (atual) {
        this.db
          .prepare(
            `UPDATE casos SET placa=?, modelo=?, categoria=?, unidade=?, propriedade=?, terceiro=?, motorista=?, data_hora=?, local=?, tipo=?,
              tipo_outro=?, condicao_via=?, relato=?, envolvidos=?, etapa=?, dados=?, vinculo=?, rnc=?, bo=?, operacao=? WHERE id=?`,
          )
          .run(...valores, id);
      } else {
        const classificacao: Classificacao = { real: { ...EMPTY_DANOS }, pot: { ...EMPTY_DANOS }, justificativa: '', confirmada: false };
        this.db
          .prepare(
            `INSERT INTO casos (placa, modelo, categoria, unidade, propriedade, terceiro, motorista, data_hora, local, tipo, tipo_outro,
              condicao_via, relato, envolvidos, etapa, dados, vinculo, rnc, bo, operacao, id, nivel, classificacao, investigacao, registrado_por, registrado_em)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(...valores, id, 0, JSON.stringify(classificacao), JSON.stringify(EMPTY_INVESTIGACAO), autor(u) + ' · ' + u.setor, quando);
      }
      if (!atual) this.log(id, rascunho ? 'Registro iniciado (rascunho)' : 'Sinistro registrado', u, null, quando);
      else if (!rascunho) this.log(id, 'Registro completado', u, null, quando);
      if (dados && mudouJanela) this.log(id, `Dados da plataforma coletados e congelados (${dados.eventos.length} eventos da viagem)`, 'Sistema', null, quando);
      for (const f of arquivos) {
        this.salvarArquivo(id, 'registro', f, u, null, quando);
        this.log(id, `Anexo adicionado: ${f.originalname}`, u, null, quando);
      }
      return this.obter(id);
    });
  }

  editarIdentificacao(id: string, patch: Partial<Pick<Caso, 'motorista' | 'local' | 'tipo' | 'tipoOutro' | 'condicaoVia' | 'dataHora' | 'relato' | 'vinculo' | 'rnc' | 'bo' | 'operacao'>>, motivo: string, u: Usuario): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'classificacao', 'investigacao', 'acompanhamento');
    if (!motivo?.trim()) throw new HttpError(422, 'Informe o motivo da alteração');
    const cols = { motorista: 'motorista', local: 'local', tipo: 'tipo', tipoOutro: 'tipo_outro', condicaoVia: 'condicao_via', dataHora: 'data_hora', relato: 'relato', vinculo: 'vinculo', rnc: 'rnc', bo: 'bo', operacao: 'operacao' } as const;
    const labels = { motorista: 'Motorista', local: 'Local', tipo: 'Tipo', tipoOutro: 'Descrição do tipo', condicaoVia: 'Condição da via', dataHora: 'Data e hora', relato: 'Relato', vinculo: 'Vínculo do motorista', rnc: 'Nº da RNC', bo: 'Nº do BO', operacao: 'Operação' } as const;
    return tx(this.db, () => {
      for (const [k, col] of Object.entries(cols) as [keyof typeof cols, string][]) {
        const novo = patch[k];
        if (novo === undefined || String(novo) === String(r[col])) continue;
        this.db.prepare(`UPDATE casos SET ${col} = ? WHERE id = ?`).run(String(novo), id);
        this.log(id, `${labels[k]} alterado: "${r[col]}" → "${novo}"`, u, motivo.trim());
      }
      return this.obter(id);
    });
  }

  /** Envolvidos podem ser incluídos em qualquer etapa, inclusive após a conclusão. */
  adicionarEnvolvido(id: string, env: Envolvido, u: Usuario): Caso {
    const r = this.rowCaso(id);
    if (!env.nome?.trim() || !env.papel?.trim()) throw new HttpError(422, 'Informe nome e papel do envolvido');
    const lista = J<Envolvido[]>(r.envolvidos);
    lista.push({ nome: env.nome.trim(), papel: env.papel, veiculo: env.veiculo?.trim() ?? '', lesao: env.lesao || 'Sem lesão' });
    return tx(this.db, () => {
      this.db.prepare('UPDATE casos SET envolvidos = ? WHERE id = ?').run(JSON.stringify(lista), id);
      this.log(id, `Envolvido adicionado: ${env.nome.trim()} (${env.papel})`, u);
      return this.obter(id);
    });
  }

  /**
   * Atualiza a lesão de um envolvido depois do registro (ex.: lesão grave que evolui para óbito).
   * Vale em qualquer etapa, inclusive em caso concluído; exige motivo e fica no histórico.
   */
  atualizarLesao(id: string, indice: number, lesao: string, motivo: string, u: Usuario, quando = agora()): Caso {
    const r = this.rowCaso(id);
    const lista = J<Envolvido[]>(r.envolvidos);
    const env = lista[indice];
    if (!env) throw new HttpError(404, 'Envolvido não encontrado');
    if (!LESOES.includes(lesao as (typeof LESOES)[number])) throw new HttpError(422, 'Lesão inválida');
    if (!motivo?.trim()) throw new HttpError(422, 'Informe o motivo da atualização');
    if (env.lesao === lesao) return this.obter(id);
    const dias = diasDesde(String(r.data_hora), quando);
    return tx(this.db, () => {
      const antes = env.lesao;
      lista[indice] = { ...env, lesao };
      this.db.prepare('UPDATE casos SET envolvidos = ? WHERE id = ?').run(JSON.stringify(lista), id);
      this.log(id, `Lesão de ${env.nome} atualizada: ${antes} → ${lesao} (${dias} ${dias === 1 ? 'dia' : 'dias'} após o sinistro)`, u, motivo.trim(), quando);
      return this.obter(id);
    });
  }

  /**
   * Corrige a natureza de um evento da plataforma (ex.: "uso de celular" que era um cochilo).
   * Guarda original e corrigido; só é permitido até PRAZO_CORRECAO_DIAS após o sinistro.
   * A correção fica marcada como pendente de envio à base de eventos.
   */
  corrigirEvento(id: string, eventoId: string, corrigido: string, motivo: string, u: Usuario, quando = agora()): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'investigacao', 'acompanhamento');
    const dados = r.dados ? J<DadosColetados>(r.dados) : null;
    const ev = dados?.eventos.find((e) => e.id === eventoId);
    if (!ev) throw new HttpError(404, 'Evento não encontrado nos dados do caso');
    if (!podeCorrigirEvento(String(r.data_hora), quando))
      throw new HttpError(409, `A natureza do evento só pode ser corrigida até ${PRAZO_CORRECAO_DIAS} dias após o sinistro`);
    if (!TIPOS_EVENTO.includes(corrigido as (typeof TIPOS_EVENTO)[number])) throw new HttpError(422, 'Tipo de evento inválido');
    if (!motivo?.trim()) throw new HttpError(422, 'Informe o motivo da correção');
    const lista = J<CorrecaoEvento[]>(r.correcoes ?? '[]');
    const atualNome = eventoCorrigido(lista, eventoId)?.corrigido ?? ev.evento;
    if (atualNome === corrigido) throw new HttpError(422, 'O evento já está com essa natureza');
    lista.push({ eventoId, original: ev.evento, corrigido, motivo: motivo.trim(), autor: autor(u), data: quando, pendenteBase: true });
    return tx(this.db, () => {
      this.db.prepare('UPDATE casos SET correcoes = ? WHERE id = ?').run(JSON.stringify(lista), id);
      this.log(id, `Evento ${ev.horario} corrigido: ${atualNome} → ${corrigido}`, u, motivo.trim(), quando);
      return this.obter(id);
    });
  }

  anexar(id: string, contexto: 'registro' | 'investigacao', arquivos: ArquivoRecebido[], u: Usuario): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'rascunho', 'classificacao', 'investigacao', 'acompanhamento');
    if (!arquivos.length) throw new HttpError(422, 'Nenhum arquivo enviado');
    return tx(this.db, () => {
      for (const f of arquivos) {
        this.salvarArquivo(id, contexto, f, u);
        this.log(id, `Anexo adicionado: ${f.originalname}`, u);
      }
      return this.obter(id);
    });
  }

  salvarClassificacao(id: string, c: Pick<Classificacao, 'real' | 'pot' | 'justificativa' | 'valorPrejuizo'>, u: Usuario, confirmar = false, quando = agora()): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'classificacao');
    const real = normalizarDanos(c.real);
    const pot = normalizarDanos(c.pot);
    // O dano potencial nunca é menor que o real, em nenhuma dimensão.
    const menores = DIMENSOES.filter((d) => pot[d.key] < real[d.key]).map((d) => d.label);
    if (menores.length) throw new HttpError(422, 'O dano potencial não pode ser menor que o dano real', menores.map((m) => `Revise ${m}`));
    const justificativa = (c.justificativa ?? '').trim();
    const nivel = nivelDoCaso({ real, pot });
    if (confirmar && maxNivel(pot) > maxNivel(real) && !justificativa)
      throw new HttpError(422, 'Justifique o dano potencial', ['O potencial é maior que o dano real: descreva o que poderia ter acontecido']);
    const valor = c.valorPrejuizo == null || (c.valorPrejuizo as unknown) === '' ? null : Number(c.valorPrejuizo);
    if (valor != null && (!Number.isFinite(valor) || valor < 0)) throw new HttpError(422, 'Valor estimado do prejuízo inválido');
    const cls: Classificacao = { real, pot, justificativa, confirmada: confirmar, valorPrejuizo: valor };

    return tx(this.db, () => {
      if (!confirmar) {
        this.db.prepare('UPDATE casos SET classificacao = ?, nivel = ? WHERE id = ?').run(JSON.stringify(cls), nivel, id);
        return this.obter(id);
      }
      const investiga = exigeInvestigacao(nivel);
      const etapa: Etapa = investiga ? 'investigacao' : 'concluido_sem_investigacao';
      const inv = { ...EMPTY_INVESTIGACAO, ...J<Investigacao>(r.investigacao) };
      // Regra do cliente: o comitê se reúne no dia seguinte.
      if (investiga && !inv.comiteData) inv.comiteData = new Date(Date.parse(quando.slice(0, 10)) + 86400000).toISOString().slice(0, 10);
      this.db
        .prepare('UPDATE casos SET classificacao = ?, nivel = ?, etapa = ?, investigacao = ?, concluido_por = ?, concluido_em = ? WHERE id = ?')
        .run(JSON.stringify(cls), nivel, etapa, JSON.stringify(inv), investiga ? null : autor(u), investiga ? null : quando, id);
      this.log(id, `Classificado como ${NIVEIS[nivel]} (${origemDoNivel(cls)})`, u, null, quando);
      if (!investiga) this.log(id, 'Caso concluído sem investigação (abaixo do nível de investigação)', u, null, quando);
      return this.obter(id);
    });
  }

  salvarInvestigacao(id: string, inv: Partial<Investigacao>, _u: Usuario, quando = agora()): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'investigacao');
    const atual = { ...EMPTY_INVESTIGACAO, ...J<Investigacao>(r.investigacao) };
    const prox: Investigacao = { ...atual, ...sanitizarInvestigacao(inv), rascunhoSalvoEm: quando };
    return tx(this.db, () => {
      this.db.prepare('UPDATE casos SET investigacao = ? WHERE id = ?').run(JSON.stringify(prox), id);
      return this.obter(id);
    });
  }

  concluirInvestigacao(id: string, inv: Partial<Investigacao> | undefined, u: Usuario, quando = agora()): Caso {
    if (inv) this.salvarInvestigacao(id, inv, u, quando);
    const c = this.obter(id);
    this.exigirEtapa(this.rowCaso(id), 'investigacao');
    const p = pendenciasInvestigacao(c.investigacao, c.acoes);
    if (p.length) throw new HttpError(422, 'A investigação ainda tem pendências', p);
    return tx(this.db, () => {
      this.db.prepare("UPDATE casos SET etapa = 'acompanhamento' WHERE id = ?").run(id);
      this.log(id, 'Investigação concluída', u, null, quando);
      this.log(id, `Plano de ação criado com ${c.acoes.length} ${c.acoes.length === 1 ? 'ação' : 'ações'}`, u, null, quando);
      return this.obter(id);
    });
  }

  criarAcao(id: string, a: { titulo: string; responsavel: string; prazo: string }, u: Usuario, motivo: string | null = null, quando = agora()): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'investigacao', 'acompanhamento');
    const e = validarAcao(a);
    if (e.length) throw new HttpError(422, 'Revise a ação', e);
    if (r.etapa === 'acompanhamento' && !motivo?.trim()) throw new HttpError(422, 'Informe o motivo para incluir uma ação após a investigação');
    return tx(this.db, () => {
      const ordem = (this.db.prepare('SELECT COALESCE(MAX(ordem), 0) + 1 AS n FROM acoes WHERE caso_id = ?').get(id) as { n: number }).n;
      this.db
        .prepare("INSERT INTO acoes (id, caso_id, ordem, titulo, responsavel, prazo, status) VALUES (?,?,?,?,?,?, 'aberta')")
        .run(randomUUID(), id, ordem, a.titulo.trim(), a.responsavel.trim(), a.prazo);
      if (r.etapa === 'acompanhamento') this.log(id, `Ação incluída no plano: ${a.titulo.trim()}`, u, motivo?.trim() ?? null, quando);
      return this.obter(id);
    });
  }

  private rowAcao(acaoId: string): { acao: Row; caso: Row } {
    const acao = this.db.prepare('SELECT * FROM acoes WHERE id = ?').get(acaoId) as Row | undefined;
    if (!acao) throw new HttpError(404, 'Ação não encontrada');
    return { acao, caso: this.rowCaso(String(acao.caso_id)) };
  }

  editarAcao(acaoId: string, a: { titulo: string; responsavel: string; prazo: string }, u: Usuario, motivo: string | null = null): Caso {
    const { acao, caso } = this.rowAcao(acaoId);
    this.exigirEtapa(caso, 'investigacao', 'acompanhamento');
    if (acao.status === 'concluida') throw new HttpError(409, 'Ação concluída não pode ser alterada');
    const e = validarAcao(a);
    if (e.length) throw new HttpError(422, 'Revise a ação', e);
    if (caso.etapa === 'acompanhamento' && !motivo?.trim()) throw new HttpError(422, 'Informe o motivo da alteração');
    return tx(this.db, () => {
      this.db.prepare('UPDATE acoes SET titulo = ?, responsavel = ?, prazo = ? WHERE id = ?').run(a.titulo.trim(), a.responsavel.trim(), a.prazo, acaoId);
      if (caso.etapa === 'acompanhamento') {
        const mud: string[] = [];
        if (acao.titulo !== a.titulo.trim()) mud.push('título');
        if (acao.responsavel !== a.responsavel.trim()) mud.push(`responsável → ${a.responsavel.trim()}`);
        if (acao.prazo !== a.prazo) mud.push(`prazo ${fmtData(String(acao.prazo))} → ${fmtData(a.prazo)}`);
        if (mud.length) this.log(String(caso.id), `Ação alterada (${mud.join(', ')}): ${a.titulo.trim()}`, u, motivo?.trim() ?? null);
      }
      return this.obter(String(caso.id));
    });
  }

  removerAcao(acaoId: string): Caso {
    const { caso } = this.rowAcao(acaoId);
    // Antes de concluir a investigação o plano ainda é rascunho; depois, nada é apagado.
    this.exigirEtapa(caso, 'investigacao');
    this.db.prepare('DELETE FROM acoes WHERE id = ?').run(acaoId);
    return this.obter(String(caso.id));
  }

  anexarEvidencia(acaoId: string, f: ArquivoRecebido | undefined, u: Usuario, quando = agora()): Caso {
    const { acao, caso } = this.rowAcao(acaoId);
    this.exigirEtapa(caso, 'acompanhamento');
    if (!f) throw new HttpError(422, 'Selecione o arquivo de evidência');
    if (acao.status === 'concluida') throw new HttpError(409, 'Ação já concluída');
    return tx(this.db, () => {
      const an = this.salvarArquivo(String(caso.id), 'evidencia', f, u, acaoId, quando);
      this.db.prepare("UPDATE acoes SET evidencia_id = ?, status = 'em_andamento' WHERE id = ?").run(an.id, acaoId);
      this.log(String(caso.id), `Evidência anexada (${f.originalname}): ${acao.titulo}`, u, null, quando);
      return this.obter(String(caso.id));
    });
  }

  concluirAcao(acaoId: string, u: Usuario, quando = agora()): Caso {
    const { acao, caso } = this.rowAcao(acaoId);
    this.exigirEtapa(caso, 'acompanhamento');
    if (!acao.evidencia_id) throw new HttpError(422, 'Anexe a evidência para concluir a ação');
    if (acao.status === 'concluida') throw new HttpError(409, 'Ação já concluída');
    return tx(this.db, () => {
      this.db.prepare("UPDATE acoes SET status = 'concluida', concluida_por = ?, concluida_em = ? WHERE id = ?").run(autor(u), quando, acaoId);
      this.log(String(caso.id), `Ação concluída: ${acao.titulo}`, u, null, quando);
      return this.obter(String(caso.id));
    });
  }

  concluirCaso(id: string, u: Usuario, quando = agora()): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'acompanhamento');
    const acoes = this.acoes(id);
    const abertas = acoes.filter((a) => a.status !== 'concluida').length;
    if (!acoes.length || abertas) throw new HttpError(422, `O caso só pode ser concluído quando todas as ações estiverem concluídas (faltam ${abertas})`);
    return tx(this.db, () => {
      this.db.prepare("UPDATE casos SET etapa = 'concluido', concluido_por = ?, concluido_em = ? WHERE id = ?").run(`${u.nome} · ${u.setor}`, quando, id);
      this.log(id, 'Caso concluído', u, null, quando);
      return this.obter(id);
    });
  }

  reabrir(id: string, motivo: string, u: Usuario): Caso {
    const r = this.rowCaso(id);
    this.exigirEtapa(r, 'concluido', 'concluido_sem_investigacao');
    if (!motivo?.trim()) throw new HttpError(422, 'Informe o motivo para reabrir o caso');
    const volta: Etapa = r.etapa === 'concluido' ? 'investigacao' : 'classificacao';
    return tx(this.db, () => {
      if (volta === 'classificacao') {
        const cls = J<Classificacao>(r.classificacao);
        this.db.prepare('UPDATE casos SET classificacao = ? WHERE id = ?').run(JSON.stringify({ ...cls, confirmada: false }), id);
      }
      this.db.prepare('UPDATE casos SET etapa = ?, concluido_por = NULL, concluido_em = NULL WHERE id = ?').run(volta, id);
      this.log(id, `Caso reaberto, volta para ${ETAPA_LABEL[volta]}`, u, motivo.trim());
      return this.obter(id);
    });
  }

  /** Dados para a Comunicação de Acidente de Trabalho (CAT) dos envolvidos com lesão. */
  exportarCAT(id: string) {
    const c = this.obter(id);
    const lesionados = c.envolvidos.filter((e) => e.lesao !== 'Sem lesão');
    return {
      caso: c.id,
      tipoAcidente: 'Típico',
      dataAcidente: c.dataHora.slice(0, 10),
      horaAcidente: c.dataHora.slice(11, 16),
      localAcidente: c.local,
      descricao: `${tipoLabel(c)}. ${c.relato}`.trim(),
      veiculo: `${c.placa} · ${c.modelo}`,
      houveAfastamento: lesionados.some((e) => e.lesao === 'Lesão grave' || e.lesao === 'Óbito'),
      houveObito: lesionados.some((e) => e.lesao === 'Óbito'),
      acidentados: lesionados.map((e) => ({ nome: e.nome, papel: e.papel, lesao: e.lesao })),
      observacao: lesionados.length ? null : 'Nenhum envolvido com lesão: não há CAT a emitir.',
    };
  }
}

// ---------------------------------------------------------------- validação

export interface RegistroInput {
  propriedade: Propriedade;
  placa: string;
  modelo?: string;
  unidade?: string;
  terceiro?: DadosTerceiro;
  motorista: string;
  dataHora: string;
  local: string;
  tipo: string;
  tipoOutro?: string;
  condicaoVia?: string;
  relato?: string;
  envolvidos?: Envolvido[];
  vinculo?: string;
  rnc?: string;
  bo?: string;
  operacao?: string;
}

const RE_DATAHORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function validarRegistro(i: Partial<RegistroInput>, rascunho = false): string[] {
  const e: string[] = [];
  if (i.propriedade !== 'proprio' && i.propriedade !== 'terceiro') e.push('Escolha se o veículo é próprio ou de terceiro');
  if (!i.placa?.trim()) e.push('Informe a placa');
  if (!i.dataHora || !RE_DATAHORA.test(i.dataHora)) e.push('Informe data e hora do sinistro');
  else if (i.dataHora > agora()) e.push('A data e hora do sinistro não pode estar no futuro');
  // Registro rápido: o rascunho só exige placa e horário.
  if (rascunho) return [...new Set(e)];
  if (i.tipo === 'Outro' && !i.tipoOutro?.trim()) e.push('Descreva o tipo de sinistro');
  if (!i.motorista?.trim()) e.push('Informe o motorista');
  if (!i.local?.trim()) e.push('Informe o local');
  if (!i.tipo?.trim() || i.tipo === 'Selecione') e.push('Selecione o tipo de sinistro');
  if (i.propriedade === 'terceiro' && !i.terceiro?.proprietario?.trim()) e.push('Informe o proprietário ou transportadora');
  for (const env of i.envolvidos ?? []) if (!env.nome?.trim() || !env.papel?.trim()) e.push('Cada envolvido precisa de nome e papel');
  return [...new Set(e)];
}

function validarAcao(a: { titulo?: string; responsavel?: string; prazo?: string }): string[] {
  const e: string[] = [];
  if (!a.titulo?.trim()) e.push('Descreva a ação');
  if (!a.responsavel?.trim()) e.push('Informe o responsável');
  if (!a.prazo || !RE_DATA.test(a.prazo)) e.push('Informe o prazo');
  return e;
}

function normalizarDanos(d: Partial<Danos> | undefined): Danos {
  const out = { ...EMPTY_DANOS };
  for (const { key } of DIMENSOES) {
    const v = Number(d?.[key] ?? 0);
    if (!Number.isInteger(v) || v < 0 || v > 3) throw new HttpError(422, `Nível inválido em ${key}`);
    out[key] = v as Nivel;
  }
  return out;
}

function sanitizarInvestigacao(inv: Partial<Investigacao>): Partial<Investigacao> {
  const out: Partial<Investigacao> = {};
  if (inv.comiteData !== undefined) {
    if (inv.comiteData && !RE_DATA.test(inv.comiteData)) throw new HttpError(422, 'Data da análise inválida');
    out.comiteData = inv.comiteData;
  }
  if (inv.participantes) out.participantes = inv.participantes.map((p) => String(p).trim()).filter(Boolean);
  if (inv.evidencias) out.evidencias = inv.evidencias.map(String);
  if (inv.constatado !== undefined) out.constatado = String(inv.constatado);
  if (inv.hipoteses)
    out.hipoteses = inv.hipoteses
      .filter((h) => h.descricao?.trim())
      .map((h) => ({ id: h.id || randomUUID(), tipo: String(h.tipo), descricao: h.descricao.trim(), evidencia: (h.evidencia ?? '').trim() }));
  if (inv.causaRaiz !== undefined) out.causaRaiz = String(inv.causaRaiz);
  const opt = (v: string | undefined, lista: readonly string[], nome: string) => {
    if (v === undefined) return undefined;
    if (v && !lista.includes(v)) throw new HttpError(422, `${nome} inválido`);
    return v;
  };
  const c = opt(inv.certeza, CERTEZAS, 'Grau de certeza');
  if (c !== undefined) out.certeza = c;
  const ev = opt(inv.evitabilidade, EVITABILIDADES, 'Evitabilidade');
  if (ev !== undefined) out.evitabilidade = ev;
  const rs = opt(inv.responsabilidade, RESPONSABILIDADES, 'Responsabilidade');
  if (rs !== undefined) out.responsabilidade = rs;
  if (inv.detalhes !== undefined) out.detalhes = sanitizarDetalhes(inv.detalhes);
  return out;
}

const txt = (v: unknown, max = 2000) => String(v ?? '').slice(0, max);
const lista = (v: unknown, permitidos: readonly string[]) => (Array.isArray(v) ? [...new Set(v.map(String).filter((x) => permitidos.includes(x)))] : []);
const umDe = (v: unknown, permitidos: readonly string[]) => (permitidos.includes(String(v)) ? String(v) : '');
const data = (v: unknown) => (RE_DATA.test(String(v ?? '')) ? String(v) : '');

function sanitizarDetalhes(d: Partial<DetalhesInvestigacao>): DetalhesInvestigacao {
  const c = { ...EMPTY_DETALHES.condutor, ...d.condutor };
  const v = { ...EMPTY_DETALHES.via, ...d.via };
  return {
    jornadaObs: txt(d.jornadaObs, 5000),
    condutor: {
      condicaoFisica: lista(c.condicaoFisica, CONDICOES_FISICAS),
      condicaoObs: txt(c.condicaoObs),
      historico: lista(c.historico, HISTORICO_ITENS),
      historicoObs: txt(c.historicoObs),
      cnh: txt(c.cnh, 30),
      validadeCnh: data(c.validadeCnh),
      validadeToxicologico: data(c.validadeToxicologico),
    },
    via: {
      pista: lista(v.pista, PISTA_CONDICOES),
      pavimentacao: umDe(v.pavimentacao, QUALIDADES),
      sinalizacao: umDe(v.sinalizacao, QUALIDADES),
      contexto: lista(v.contexto, CONTEXTOS_VIA),
      rodovia: txt(v.rodovia, 120),
      concessionaria: txt(v.concessionaria, 120),
      faixas: txt(v.faixas, 10),
    },
  };
}

function mapAnexo(r: Row): Anexo {
  return {
    id: String(r.id),
    casoId: String(r.caso_id),
    acaoId: s(r.acao_id),
    contexto: r.contexto as Anexo['contexto'],
    nome: String(r.nome),
    tamanho: Number(r.tamanho),
    mime: String(r.mime),
    enviadoPor: String(r.enviado_por),
    enviadoEm: String(r.enviado_em),
  };
}

const fmtData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
