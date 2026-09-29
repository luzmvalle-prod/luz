import { useState } from 'react';
import type { Acao } from '../../../shared/domain.ts';
import { Field, Modal, useUsuario } from './ui.tsx';

export type AcaoForm = { titulo: string; responsavel: string; prazo: string; motivo?: string };

/** Criação/edição de ação do plano. Após a investigação, toda mudança exige motivo. */
export function AcaoModal({ acao, exigeMotivo, onClose, onSave }: { acao?: Acao; exigeMotivo: boolean; onClose: () => void; onSave: (a: AcaoForm) => void }) {
  const { usuarios } = useUsuario();
  const [a, setA] = useState<AcaoForm>({ titulo: acao?.titulo ?? '', responsavel: acao?.responsavel ?? '', prazo: acao?.prazo ?? '', motivo: '' });
  const ok = a.titulo.trim() && a.responsavel.trim() && a.prazo && (!exigeMotivo || a.motivo?.trim());
  return (
    <Modal
      title={acao ? 'Editar ação' : 'Adicionar ação'}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!ok} onClick={() => onSave(a)}>
            Salvar
          </button>
        </>
      }
    >
      <Field label="Ação" htmlFor="ac-titulo">
        <input id="ac-titulo" className="input" autoFocus value={a.titulo} onChange={(e) => setA({ ...a, titulo: e.target.value })} placeholder="O que será feito" />
      </Field>
      <div className="grid2">
        <Field label="Responsável" htmlFor="ac-resp">
          <input id="ac-resp" className="input" list="ac-resp-list" value={a.responsavel} onChange={(e) => setA({ ...a, responsavel: e.target.value })} placeholder="Nome · Setor" />
          <datalist id="ac-resp-list">
            {usuarios.map((u) => (
              <option key={u.id} value={`${u.nome} · ${u.setor}`} />
            ))}
          </datalist>
        </Field>
        <Field label="Prazo" htmlFor="ac-prazo">
          <input id="ac-prazo" type="date" className="input" value={a.prazo} onChange={(e) => setA({ ...a, prazo: e.target.value })} />
        </Field>
      </div>
      {exigeMotivo && (
        <Field label="Motivo da mudança no plano" htmlFor="ac-motivo">
          <textarea id="ac-motivo" className="textarea" rows={2} value={a.motivo} onChange={(e) => setA({ ...a, motivo: e.target.value })} placeholder="Fica registrado no histórico do caso" />
        </Field>
      )}
    </Modal>
  );
}
