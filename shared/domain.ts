// Modelo de domínio e regras do C1 · Registro e investigação de sinistros.
// Compartilhado entre a API (server/) e a interface (web/).

export const NIVEIS = ['Leve', 'Médio', 'Grave', 'Gravíssimo'] as const;
export type Nivel = 0 | 1 | 2 | 3;
export const NIVEL_COR = ['#9aa1ab', '#f7b50f', '#ed6b0a', '#ea0f33'] as const;

/** A partir deste nível o caso exige investigação pelo comitê. */
export const NIVEL_INVESTIGACAO: Nivel = 2;

export const DIMENSOES = [
  { key: 'pessoas', label: 'Pessoas' },
  { key: 'via', label: 'Via' },
  { key: 'ambiente', label: 'Meio ambiente' },
  { key: 'carga', label: 'Carga e prejuízo' },
] as const;
export type Dimensao = (typeof DIMENSOES)[number]['key'];
export type Danos = Record<Dimensao, Nivel>;

/** Critérios de cada nível por dimensão. No produto são configurados pelo cliente. */
export const CRITERIOS: Record<Dimensao, [string, string, string, string]> = {
  pessoas: ['Sem lesão ou primeiros socorros', 'Lesão com atendimento médico, sem afastamento', 'Lesão com afastamento', 'Óbito ou lesão permanente'],
  via: ['Sem interdição', 'Interdição parcial até 1 h', 'Interdição total ou parcial acima de 1 h', 'Interdição total acima de 4 h'],
  ambiente: ['Sem vazamento', 'Vazamento contido no local', 'Vazamento que atinge solo ou drenagem', 'Vazamento em corpo d’água ou área protegida'],
  carga: ['Até R$ 5 mil', 'De R$ 5 mil a R$ 50 mil', 'De R$ 50 mil a R$ 200 mil', 'Acima de R$ 200 mil'],
};

export const TIPOS_SINISTRO = [
  'Saída de pista',
  'Colisão traseira',
  'Colisão frontal',
  'Colisão lateral',
  'Colisão com motocicleta',
  'Tombamento',
  'Atropelamento',
  'Choque com objeto fixo',
  'Outro',
] as const;

export const CONDICOES_VIA = ['Pista seca', 'Pista molhada', 'Neblina', 'Obras na via', 'Iluminação precária', 'Não informada'] as const;

export const PAPEIS_ENVOLVIDO = ['Motorista do veículo', 'Ajudante', 'Condutor de terceiro', 'Passageiro de terceiro', 'Pedestre', 'Outro'] as const;
export const LESOES = ['Sem lesão', 'Lesão leve', 'Lesão grave', 'Óbito'] as const;

export const TIPOS_HIPOTESE = [
  'Hipótese em análise',
  'Hipótese descartada',
  'Hipótese confirmada',
  'Fator · humano',
  'Fator · veículo',
  'Fator · ambiente',
  'Fator · organização',
] as const;

export const CERTEZAS = ['Confirmada', 'Provável', 'Inconclusiva'] as const;
export const EVITABILIDADES = ['Evitável', 'Não evitável', 'Inconclusiva'] as const;
export const RESPONSABILIDADES = ['Frota', 'Terceiro', 'Compartilhada', 'Indeterminada'] as const;

export type Etapa = 'classificacao' | 'investigacao' | 'acompanhamento' | 'concluido' | 'concluido_sem_investigacao';
export const ETAPA_LABEL: Record<Etapa, string> = {
  classificacao: 'Classificação',
  investigacao: 'Investigação',
  acompanhamento: 'Acompanhamento',
  concluido: 'Concluído',
  concluido_sem_investigacao: 'Concluído sem investigação',
};
/** Índice no stepper de 5 etapas (0 = Registro). */
export const ETAPA_INDEX: Record<Etapa, number> = {
  classificacao: 1,
  investigacao: 2,
  acompanhamento: 3,
  concluido: 4,
  concluido_sem_investigacao: 4,
};
export const ETAPAS_STEPPER = ['Registro', 'Classificação', 'Investigação', 'Acompanhamento', 'Conclusão'] as const;

export type Propriedade = 'proprio' | 'terceiro';

export interface Usuario {
  id: string;
  nome: string;
  setor: string;
}

export interface Envolvido {
  nome: string;
  papel: string;
  veiculo: string;
  lesao: string;
}

export interface DadosTerceiro {
  proprietario: string;
  documento: string;
  cnh: string;
}

export interface Classificacao {
  real: Danos;
  pot: Danos;
  justificativa: string;
  confirmada: boolean;
}

export interface Hipotese {
  id: string;
  tipo: string;
  descricao: string;
  evidencia: string;
}

export interface Investigacao {
  comiteData: string; // YYYY-MM-DD
  participantes: string[];
  evidencias: string[]; // ids de eventos da plataforma marcados como evidência
  constatado: string;
  hipoteses: Hipotese[];
  causaRaiz: string;
  certeza: string;
  evitabilidade: string;
  responsabilidade: string;
  rascunhoSalvoEm: string | null;
}

export interface ItemColetado {
  campo: string;
  valor: string;
  fonte: string;
  coletadoEm: string;
}
export interface GrupoColetado {
  nome: string;
  itens: ItemColetado[];
}
export interface EventoPlataforma {
  id: string;
  horario: string; // "07:36:14" ou "05:48 → 07:42"
  origem: 'Telemetria' | 'Videotelemetria';
  evento: string;
  detalhe: string;
}
export interface Jornada {
  inicio: string; // HH:mm
  horasTrabalhadasMin: number;
  direcaoContinuaMin: number;
  interjornadaMin: number;
}
/** Dados puxados da plataforma e congelados na abertura do caso. */
export interface DadosColetados {
  coletadoEm: string;
  grupos: GrupoColetado[];
  eventos: EventoPlataforma[];
  jornada: Jornada | null;
  historico30d: { evento: string; ocorrencias: number }[];
  observacoes: string[];
}

export type StatusAcao = 'aberta' | 'em_andamento' | 'concluida';
export const STATUS_ACAO_LABEL: Record<StatusAcao, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

export interface Anexo {
  id: string;
  casoId: string;
  acaoId: string | null;
  contexto: 'registro' | 'investigacao' | 'evidencia';
  nome: string;
  tamanho: number;
  mime: string;
  enviadoPor: string;
  enviadoEm: string;
}

export interface Acao {
  id: string;
  casoId: string;
  titulo: string;
  responsavel: string; // "Nome · Setor"
  prazo: string; // YYYY-MM-DD
  status: StatusAcao;
  evidencia: Anexo | null;
  concluidaPor: string | null;
  concluidaEm: string | null;
  atrasada: boolean;
}

export interface EventoHistorico {
  id: number;
  data: string;
  evento: string;
  autor: string;
  motivo: string | null;
}

export interface Caso {
  id: string;
  placa: string;
  modelo: string;
  categoria: string;
  unidade: string;
  propriedade: Propriedade;
  terceiro: DadosTerceiro | null;
  motorista: string;
  dataHora: string; // YYYY-MM-DDTHH:mm (horário local)
  local: string;
  tipo: string;
  condicaoVia: string;
  relato: string;
  envolvidos: Envolvido[];
  etapa: Etapa;
  nivel: Nivel;
  classificacao: Classificacao;
  investigacao: Investigacao;
  dados: DadosColetados | null;
  registradoPor: string;
  registradoEm: string;
  concluidoPor: string | null;
  concluidoEm: string | null;
  acoes: Acao[];
  anexos: Anexo[];
  historico: EventoHistorico[];
  proximoPasso: string;
}

export type CasoResumo = Pick<
  Caso,
  'id' | 'placa' | 'modelo' | 'unidade' | 'motorista' | 'dataHora' | 'tipo' | 'nivel' | 'etapa' | 'proximoPasso' | 'propriedade'
>;

export interface Indicadores {
  sinistros30d: number;
  graves30d: number;
  abertos: number;
  abertosPorEtapa: Record<'classificacao' | 'investigacao' | 'acompanhamento', number>;
  acoesSemEvidencia: number;
  diasSemGravissimo: number | null;
  ultimoGravissimo: string | null;
}

// ---------------------------------------------------------------- regras

export const maxNivel = (d: Danos): Nivel => Math.max(d.pessoas, d.via, d.ambiente, d.carga) as Nivel;

/** O nível do caso é o maior entre dano real e dano potencial em todas as dimensões. */
export const nivelDoCaso = (c: Pick<Classificacao, 'real' | 'pot'>): Nivel => Math.max(maxNivel(c.real), maxNivel(c.pot)) as Nivel;

export const exigeInvestigacao = (n: Nivel) => n >= NIVEL_INVESTIGACAO;

/** De onde vem o nível do caso: "real", "potencial" ou "real e potencial". */
export function origemDoNivel(c: Pick<Classificacao, 'real' | 'pot'>): string {
  const r = maxNivel(c.real);
  const p = maxNivel(c.pot);
  if (r === p) return 'real e potencial';
  return r > p ? 'real' : 'potencial';
}

/** Regras da Lei 13.103/2015 (transporte de cargas). Configuráveis por cliente e convenção coletiva. */
export const REGRAS_JORNADA = {
  jornadaMin: 8 * 60,
  extrasMin: 2 * 60,
  direcaoContinuaMin: 5 * 60 + 30,
  interjornadaMin: 11 * 60,
};

export function avaliarJornada(j: Jornada) {
  const r = REGRAS_JORNADA;
  const violacoes: string[] = [];
  if (j.horasTrabalhadasMin > r.jornadaMin + r.extrasMin) violacoes.push('Horas trabalhadas acima do limite');
  if (j.direcaoContinuaMin > r.direcaoContinuaMin) violacoes.push('Direção contínua acima do limite');
  if (j.interjornadaMin < r.interjornadaMin) violacoes.push('Descanso interjornada abaixo do mínimo');
  return { dentro: violacoes.length === 0, violacoes };
}

export const EMPTY_DANOS: Danos = { pessoas: 0, via: 0, ambiente: 0, carga: 0 };

export const EMPTY_INVESTIGACAO: Investigacao = {
  comiteData: '',
  participantes: [],
  evidencias: [],
  constatado: '',
  hipoteses: [],
  causaRaiz: '',
  certeza: '',
  evitabilidade: '',
  responsabilidade: '',
  rascunhoSalvoEm: null,
};

/** Pendências que impedem concluir a investigação. Lista vazia = pode concluir. */
export function pendenciasInvestigacao(inv: Investigacao, acoes: Pick<Acao, 'titulo' | 'responsavel' | 'prazo'>[]): string[] {
  const p: string[] = [];
  if (!inv.comiteData) p.push('Informe a data da análise do comitê');
  if (inv.participantes.length === 0) p.push('Informe os participantes do comitê');
  if (!inv.causaRaiz.trim()) p.push('Descreva a causa raiz');
  if (!inv.certeza) p.push('Escolha o grau de certeza da causa');
  if (!inv.evitabilidade) p.push('Escolha a evitabilidade');
  if (!inv.responsabilidade) p.push('Escolha a responsabilidade legal');
  if (acoes.length === 0) p.push('Adicione ao menos uma ação ao plano');
  if (acoes.some((a) => !a.responsavel.trim() || !a.prazo)) p.push('Cada ação precisa de responsável e prazo');
  return p;
}

export function proximoPasso(etapa: Etapa, acoes: Pick<Acao, 'status' | 'evidencia'>[]): string {
  switch (etapa) {
    case 'classificacao':
      return 'Classificar';
    case 'investigacao':
      return 'Investigar no comitê';
    case 'acompanhamento': {
      const semEvid = acoes.filter((a) => a.status !== 'concluida' && !a.evidencia).length;
      const pendentes = acoes.filter((a) => a.status !== 'concluida').length;
      if (semEvid > 0) return `Anexar evidência de ${semEvid} ${semEvid === 1 ? 'ação' : 'ações'}`;
      if (pendentes > 0) return `Concluir ${pendentes} ${pendentes === 1 ? 'ação' : 'ações'}`;
      return 'Concluir caso';
    }
    default:
      return '—';
  }
}
