// Simulação local das integrações da plataforma INFLEET (telemetria, videotelemetria,
// manutenção e jornada). Em produção estas funções chamam os serviços reais; aqui os
// dados são determinísticos a partir da placa e do horário, para que o fluxo possa ser
// exercitado em localhost sem dependências externas.

import type { DadosColetados, EventoPlataforma, GrupoColetado, Jornada } from '../shared/domain.ts';

export interface Veiculo {
  placa: string;
  modelo: string;
  categoria: string;
  unidade: string;
  motorista: string;
}

export const FROTA: Veiculo[] = [
  { placa: 'RTB-4E21', modelo: 'Scania R 450', categoria: 'Carreta', unidade: 'Recife', motorista: 'Carlos Menezes' },
  { placa: 'KTR-1A66', modelo: 'Mercedes Atego 2430', categoria: 'Truck', unidade: 'Recife', motorista: 'Paulo Andrade' },
  { placa: 'QPX-7H09', modelo: 'Volvo FH 540', categoria: 'Carreta', unidade: 'Cabo de Santo Agostinho', motorista: 'José Ferreira' },
  { placa: 'SGD-2B83', modelo: 'Scania R 450', categoria: 'Carreta', unidade: 'Recife', motorista: 'Antônio Ribeiro' },
  { placa: 'PNV-5C47', modelo: 'VW Delivery 11.180', categoria: 'Toco', unidade: 'Jaboatão', motorista: 'Marcos Lima' },
  { placa: 'MHL-8D32', modelo: 'Volvo FH 460', categoria: 'Carreta', unidade: 'Cabo de Santo Agostinho', motorista: 'Severino Batista' },
  { placa: 'JVC-3K57', modelo: 'Mercedes Actros 2651', categoria: 'Carreta', unidade: 'Recife', motorista: 'Luiz Carvalho' },
  { placa: 'OFA-6G14', modelo: 'VW Constellation 24.280', categoria: 'Truck', unidade: 'Jaboatão', motorista: 'Rogério Santos' },
];

const LOCAIS = [
  'BR-101, km 72 · Cabo de Santo Agostinho (PE)',
  'BR-232, km 18 · Jaboatão dos Guararapes (PE)',
  'Av. Recife, 4200 · Recife (PE)',
  'PE-060, km 9 · Ipojuca (PE)',
  'BR-408, km 41 · São Lourenço da Mata (PE)',
  'Porto de Suape, pátio 3 · Ipojuca (PE)',
];

// PRNG determinístico (mulberry32) semeado pela placa + horário.
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number) => `${pad(Math.floor((((min % 1440) + 1440) % 1440) / 60))}:${pad((((min % 1440) + 1440) % 1440) % 60)}`;
const hhmmss = (sec: number) => `${hhmm(Math.floor(sec / 60))}:${pad(((sec % 60) + 60) % 60)}`;
export const fmtDuracao = (min: number) => `${Math.floor(min / 60)} h ${pad(min % 60)} min`;
const fmtData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const fmtDataHora = (iso: string) => `${fmtData(iso)} ${iso.slice(11, 16)}`;

export function veiculo(placa: string): Veiculo | undefined {
  return FROTA.find((v) => v.placa === placa.toUpperCase().trim());
}

/** Motorista e posição do veículo no horário informado, vindos da telemetria. */
export function consultarPosicao(placa: string, dataHora: string): { motorista: string; local: string } | null {
  const v = veiculo(placa);
  if (!v) return null;
  if (v.placa === 'RTB-4E21' && dataHora.startsWith('2026-09-22')) return { motorista: v.motorista, local: LOCAIS[0] };
  const r = rng(v.placa + dataHora.slice(0, 13));
  return { motorista: v.motorista, local: LOCAIS[int(r, 0, LOCAIS.length - 1)] };
}

/**
 * Puxa jornada, eventos de telemetria e videotelemetria, manutenção e vídeo da janela do
 * sinistro. O resultado é gravado no caso e nunca recalculado ("congelado").
 */
export function coletarDados(placa: string, dataHora: string, coletadoEm: string): DadosColetados | null {
  const v = veiculo(placa);
  if (!v) return null;
  if (v.placa === 'RTB-4E21' && dataHora === '2026-09-22T07:42') return fixtureRTB(coletadoEm);

  const r = rng(v.placa + dataHora);
  const [h, m] = dataHora.slice(11, 16).split(':').map(Number);
  const momento = h * 60 + m;
  const at = fmtDataHora(coletadoEm);
  const velInfleet = int(r, 20, 92);
  const temAutotrack = r() < 0.4;
  const velAutotrack = Math.max(0, velInfleet + int(r, -22, 6));
  const houveReducao = r() < 0.45;
  const cameraInternaOk = r() < 0.7;

  const jornadaInicio = momento - int(r, 40, 9 * 60);
  const jornada: Jornada = {
    inicio: hhmm(jornadaInicio),
    horasTrabalhadasMin: momento - jornadaInicio,
    direcaoContinuaMin: Math.min(momento - jornadaInicio, int(r, 30, 6 * 60)),
    interjornadaMin: int(r, 9 * 60, 13 * 60),
  };

  const pool: Omit<EventoPlataforma, 'id' | 'horario'>[] = [
    { origem: 'Telemetria', evento: 'Excesso de velocidade', detalhe: `${velInfleet + int(r, 4, 14)} km/h em trecho de ${velInfleet > 60 ? 80 : 60} km/h` },
    { origem: 'Telemetria', evento: 'Frenagem brusca', detalhe: 'Desaceleração acima de 0,4 g' },
    { origem: 'Videotelemetria', evento: 'Uso de celular', detalhe: 'Câmera interna: celular na mão' },
    { origem: 'Videotelemetria', evento: 'Distância insegura', detalhe: 'Câmera externa: menos de 2 s do veículo à frente' },
    { origem: 'Videotelemetria', evento: 'Fadiga', detalhe: 'Câmera interna: olhos fechados por 2 s' },
    { origem: 'Telemetria', evento: 'Manobra brusca', detalhe: 'Guinada lateral' },
  ];
  const eventos: EventoPlataforma[] = [];
  const n = int(r, 1, 4);
  const usados = new Set<number>();
  for (let i = 0; i < n; i++) {
    let k = int(r, 0, pool.length - 1);
    while (usados.has(k)) k = (k + 1) % pool.length;
    usados.add(k);
    const seg = momento * 60 - int(r, 20, 20 * 60);
    eventos.push({ id: `ev${i + 1}`, horario: hhmmss(seg), ...pool[k] });
  }
  if (!cameraInternaOk)
    eventos.push({ id: 'ev-cam', horario: `${hhmm(jornadaInicio + 15)} → ${hhmm(momento)}`, origem: 'Videotelemetria', evento: 'Câmera interna obstruída', detalhe: 'Persistente na jornada' });
  eventos.push({ id: 'ev-imp', horario: hhmmss(momento * 60 + 6), origem: 'Telemetria', evento: 'Impacto detectado', detalhe: 'Acelerômetro' });
  eventos.sort((a, b) => a.horario.localeCompare(b.horario));

  const ultimaCorretiva = new Date(Date.parse(dataHora.slice(0, 10)) - int(r, 7, 90) * 86400000).toISOString().slice(0, 10);
  const km = int(r, 80, 520) * 1000 + int(r, 0, 999);

  const grupos: GrupoColetado[] = [
    {
      nome: 'Telemetria',
      itens: [
        { campo: 'Velocidade no momento', valor: `${velInfleet} km/h`, fonte: 'INFLEET', coletadoEm: at },
        ...(temAutotrack ? [{ campo: 'Velocidade no momento', valor: `${velAutotrack} km/h`, fonte: 'Autotrack', coletadoEm: at }] : []),
        { campo: 'Redução de velocidade antes do sinistro', valor: houveReducao ? 'Sim' : 'Não houve', fonte: 'INFLEET', coletadoEm: at },
      ],
    },
    {
      nome: 'Vídeo',
      itens: [
        { campo: 'Câmera externa', valor: 'Ativa · clipe salvo', fonte: 'INFLEET', coletadoEm: at },
        { campo: 'Câmera interna', valor: cameraInternaOk ? 'Ativa · clipe salvo' : 'Obstruída', fonte: 'INFLEET', coletadoEm: at },
      ],
    },
    {
      nome: 'Manutenção',
      itens: [
        { campo: 'Última corretiva', valor: `${fmtData(ultimaCorretiva)} · ${km.toLocaleString('pt-BR')} km`, fonte: 'Manutenção', coletadoEm: at },
        { campo: 'Reclamação aberta do motorista', valor: r() < 0.2 ? 'Sim' : 'Não', fonte: 'Manutenção', coletadoEm: at },
      ],
    },
  ];

  const observacoes: string[] = [];
  if (temAutotrack && Math.abs(velInfleet - velAutotrack) >= 5)
    observacoes.push('As duas fontes de velocidade divergem. O caso guarda as duas; nenhuma substitui a outra.');

  return {
    coletadoEm,
    grupos,
    eventos,
    jornada,
    historico30d: [
      { evento: 'Uso de celular', ocorrencias: int(r, 0, 5) },
      { evento: 'Câmera obstruída', ocorrencias: int(r, 0, 3) },
      { evento: 'Excesso de velocidade', ocorrencias: int(r, 0, 6) },
      { evento: 'Frenagem brusca', ocorrencias: int(r, 0, 4) },
    ],
    observacoes,
  };
}

/** Dados do caso de referência do protótipo (RTB-4E21 · 22/09/2026 07:42). */
function fixtureRTB(coletadoEm: string): DadosColetados {
  const at = fmtDataHora(coletadoEm);
  return {
    coletadoEm,
    grupos: [
      {
        nome: 'Telemetria',
        itens: [
          { campo: 'Velocidade no momento', valor: '74 km/h', fonte: 'INFLEET', coletadoEm: at },
          { campo: 'Velocidade no momento', valor: '54 km/h', fonte: 'Autotrack', coletadoEm: at },
          { campo: 'Redução de velocidade antes do sinistro', valor: 'Não houve', fonte: 'INFLEET', coletadoEm: at },
        ],
      },
      {
        nome: 'Vídeo',
        itens: [
          { campo: 'Câmera externa', valor: 'Ativa · clipe salvo', fonte: 'INFLEET', coletadoEm: at },
          { campo: 'Câmera interna', valor: 'Obstruída', fonte: 'INFLEET', coletadoEm: at },
        ],
      },
      {
        nome: 'Manutenção',
        itens: [
          { campo: 'Última corretiva', valor: '14/08/2026 · 312.480 km', fonte: 'Manutenção', coletadoEm: at },
          { campo: 'Reclamação aberta do motorista', valor: 'Não', fonte: 'Manutenção', coletadoEm: at },
        ],
      },
    ],
    eventos: [
      { id: 'ev-cam', horario: '05:48 → 07:42', origem: 'Videotelemetria', evento: 'Câmera interna obstruída', detalhe: 'Persistente desde o início da jornada' },
      { id: 'ev1', horario: '07:36:14', origem: 'Telemetria', evento: 'Excesso de velocidade', detalhe: '82 km/h em trecho de 80 km/h, por 40 s' },
      { id: 'ev2', horario: '07:41:58', origem: 'Videotelemetria', evento: 'Sem frenagem com veículo à frente', detalhe: 'Câmera externa: veículos à frente reduzindo' },
      { id: 'ev3', horario: '07:42:04', origem: 'Telemetria', evento: 'Manobra brusca', detalhe: 'Guinada para o acostamento' },
      { id: 'ev-imp', horario: '07:42:06', origem: 'Telemetria', evento: 'Impacto detectado', detalhe: 'Acelerômetro' },
    ],
    jornada: { inicio: '05:30', horasTrabalhadasMin: 132, direcaoContinuaMin: 132, interjornadaMin: 665 },
    historico30d: [
      { evento: 'Uso de celular', ocorrencias: 4 },
      { evento: 'Câmera obstruída', ocorrencias: 3 },
      { evento: 'Excesso de velocidade', ocorrencias: 2 },
      { evento: 'Frenagem brusca', ocorrencias: 1 },
    ],
    observacoes: ['As duas fontes de velocidade divergem. O caso guarda as duas; nenhuma substitui a outra.'],
  };
}
