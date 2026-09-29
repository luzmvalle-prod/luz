import type { Caso, CasoResumo, Indicadores, Usuario } from '../../shared/domain.ts';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detalhes: string[] = [],
  ) {
    super(message);
  }
}

let usuarioAtual = (() => {
  try {
    return localStorage.getItem('usuario') ?? 'ana';
  } catch {
    return 'ana';
  }
})();
export const getUsuarioId = () => usuarioAtual;
export function setUsuarioId(id: string) {
  usuarioAtual = id;
  try {
    localStorage.setItem('usuario', id);
  } catch {
    /* sem storage */
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'x-usuario': usuarioAtual };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const r = await fetch('/api' + url, { method, headers, body: payload });
  const data = r.headers.get('content-type')?.includes('json') ? await r.json() : null;
  if (!r.ok) throw new ApiError(data?.erro ?? `Erro ${r.status}`, r.status, data?.detalhes ?? []);
  return data as T;
}

export const api = {
  usuarios: () => req<Usuario[]>('GET', '/usuarios'),
  frota: () => req<{ placa: string; modelo: string; unidade: string; motorista: string }[]>('GET', '/frota'),
  posicao: (placa: string, dataHora: string) =>
    req<{ motorista: string; local: string }>('GET', `/plataforma/posicao?placa=${encodeURIComponent(placa)}&dataHora=${encodeURIComponent(dataHora)}`),
  indicadores: () => req<Indicadores>('GET', '/indicadores'),
  casos: () => req<CasoResumo[]>('GET', '/casos'),
  caso: (id: string) => req<Caso>('GET', `/casos/${id}`),
  registrar: (fd: FormData) => req<Caso>('POST', '/casos', fd),
  editarIdentificacao: (id: string, patch: object, motivo: string) => req<Caso>('PATCH', `/casos/${id}/identificacao`, { patch, motivo }),
  adicionarEnvolvido: (id: string, env: object) => req<Caso>('POST', `/casos/${id}/envolvidos`, env),
  anexar: (id: string, contexto: 'registro' | 'investigacao', files: File[]) => {
    const fd = new FormData();
    fd.append('contexto', contexto);
    files.forEach((f) => fd.append('anexos', f));
    return req<Caso>('POST', `/casos/${id}/anexos`, fd);
  },
  salvarClassificacao: (id: string, c: object) => req<Caso>('PUT', `/casos/${id}/classificacao`, c),
  confirmarClassificacao: (id: string, c: object) => req<Caso>('POST', `/casos/${id}/classificacao/confirmar`, c),
  salvarInvestigacao: (id: string, inv: object) => req<Caso>('PUT', `/casos/${id}/investigacao`, inv),
  concluirInvestigacao: (id: string, inv: object) => req<Caso>('POST', `/casos/${id}/investigacao/concluir`, inv),
  criarAcao: (id: string, a: object) => req<Caso>('POST', `/casos/${id}/acoes`, a),
  editarAcao: (acaoId: string, a: object) => req<Caso>('PUT', `/acoes/${acaoId}`, a),
  removerAcao: (acaoId: string) => req<Caso>('DELETE', `/acoes/${acaoId}`),
  anexarEvidencia: (acaoId: string, f: File) => {
    const fd = new FormData();
    fd.append('arquivo', f);
    return req<Caso>('POST', `/acoes/${acaoId}/evidencia`, fd);
  },
  concluirAcao: (acaoId: string) => req<Caso>('POST', `/acoes/${acaoId}/concluir`),
  concluirCaso: (id: string) => req<Caso>('POST', `/casos/${id}/concluir`),
  reabrir: (id: string, motivo: string) => req<Caso>('POST', `/casos/${id}/reabrir`, { motivo }),
  cat: (id: string) => req<object>('GET', `/casos/${id}/cat`),
};

export const urlAnexo = (id: string, download = false) => `/api/anexos/${id}${download ? '?download=1' : ''}`;
