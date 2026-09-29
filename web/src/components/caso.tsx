import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { Caso, Etapa } from '../../../shared/domain.ts';
import { ApiError, api } from '../api.ts';
import { cabecalhoCaso, etapaIndex, rotaDaEtapa } from '../format.ts';
import { Loading, NivelBadge, PageHeader, Shell, Stepper, useToast } from './ui.tsx';

export function useCaso() {
  const { id = '' } = useParams();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    api
      .caso(id)
      .then(setCaso)
      .catch((e) => setErro(e.message));
  }, [id]);
  useEffect(recarregar, [recarregar]);
  return { id, caso, setCaso, erro, recarregar };
}

/** Executa uma mutação da API, atualiza o caso e mostra erros como toast. */
export function useMutacao(setCaso: (c: Caso) => void) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<Caso>, ok?: string): Promise<Caso | null> => {
      setOcupado(true);
      try {
        const c = await fn();
        setCaso(c);
        if (ok) toast(ok);
        return c;
      } catch (e) {
        const d = e instanceof ApiError && e.detalhes.length ? `: ${e.detalhes.join('; ')}` : '';
        toast(`${(e as Error).message}${d}`, 'erro');
        return null;
      } finally {
        setOcupado(false);
      }
    },
    [setCaso, toast],
  );
  return { run, ocupado };
}

/**
 * Garante que a tela aberta corresponde à etapa do caso. Casos em outra etapa vão para a
 * tela certa (a ficha continua disponível para qualquer etapa).
 */
export function CasoGate({ caso, erro, etapas, children }: { caso: Caso | null; erro: string | null; etapas: Etapa[]; children: (c: Caso) => ReactNode }) {
  if (erro)
    return (
      <Shell>
        <div className="loading">
          {erro}. <Link to="/sinistros">Voltar para a lista</Link>
        </div>
      </Shell>
    );
  if (!caso)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (!etapas.includes(caso.etapa)) return <Navigate to={rotaDaEtapa(caso.id, caso.etapa)} replace />;
  return <Shell>{children(caso)}</Shell>;
}

export function CasoHeader({ caso, eyebrow, titulo, actions, semFicha, nivel }: { caso: Caso; eyebrow: string; titulo: string; actions?: ReactNode; semFicha?: boolean; nivel?: Caso['nivel'] }) {
  const concluido = caso.etapa === 'concluido' || caso.etapa === 'concluido_sem_investigacao';
  return (
    <PageHeader
      crumbs={
        <>
          <Link to="/sinistros">Sinistros</Link> / {caso.placa} <span style={{ color: 'var(--faint)' }}>· {caso.id}</span>
        </>
      }
      eyebrow={eyebrow}
      title={
        <>
          <h1>{titulo}</h1>
          <NivelBadge nivel={nivel ?? caso.nivel} lg />
        </>
      }
      subtitle={cabecalhoCaso(caso)}
      actions={
        <>
          {actions}
          {!semFicha && (
            <Link className="btn outline" to={`/sinistros/${caso.id}/ficha`}>
              Ver ficha completa
            </Link>
          )}
        </>
      }
    >
      <Stepper atual={etapaIndex(caso.etapa)} concluido={concluido} />
    </PageHeader>
  );
}
