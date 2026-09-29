import { ETAPA_INDEX, type Caso, type Etapa } from '../../shared/domain.ts';

/** "2026-09-22T07:42" → "22/09/2026 07:42" */
export const fmtDataHora = (iso: string | null | undefined) => (iso ? `${fmtData(iso)} ${iso.slice(11, 16)}` : '—');
/** "2026-09-22" → "22/09/2026" */
export const fmtData = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
export const fmtDuracao = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
export const diasEntre = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000));

/** Tela de trabalho para a etapa atual do caso. */
export function rotaDaEtapa(id: string, etapa: Etapa) {
  const seg = { classificacao: 'classificacao', investigacao: 'investigacao', acompanhamento: 'acompanhamento', concluido: 'conclusao', concluido_sem_investigacao: 'conclusao' }[etapa];
  return `/sinistros/${id}/${seg}`;
}

export const cabecalhoCaso = (c: Pick<Caso, 'placa' | 'modelo' | 'motorista' | 'dataHora'>) => `${c.placa} · ${c.modelo} · ${c.motorista} · ${fmtDataHora(c.dataHora)}`;

export const etapaIndex = (e: Etapa) => ETAPA_INDEX[e];

export function nomeArquivoDownload(nome: string, dados: object) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
