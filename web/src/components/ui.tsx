import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ETAPAS_STEPPER, NIVEIS, NIVEL_COR, type Anexo, type Nivel, type Usuario } from '../../../shared/domain.ts';
import { api, getUsuarioId, setUsuarioId, urlAnexo } from '../api.ts';
import { fmtBytes, fmtDataHora } from '../format.ts';

// ---------------------------------------------------------------- toast

type ToastFn = (msg: string, tipo?: 'ok' | 'erro') => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback<ToastFn>((msg, tipo = 'ok') => {
    setT({ msg, tipo });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), tipo === 'erro' ? 4500 : 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div className={`toast ${t.tipo === 'erro' ? 'erro' : ''}`} role="status">
          {t.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- usuário atual

const UserCtx = createContext<{ usuario: Usuario | null; usuarios: Usuario[]; trocar: (id: string) => void }>({ usuario: null, usuarios: [], trocar: () => {} });
export const useUsuario = () => useContext(UserCtx);

export function UserProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [id, setId] = useState(getUsuarioId());
  useEffect(() => {
    api.usuarios().then(setUsuarios).catch(() => {});
  }, []);
  const trocar = (novo: string) => {
    setUsuarioId(novo);
    setId(novo);
  };
  const usuario = usuarios.find((u) => u.id === id) ?? usuarios[0] ?? null;
  return <UserCtx.Provider value={{ usuario, usuarios, trocar }}>{children}</UserCtx.Provider>;
}

// ---------------------------------------------------------------- ícones

const I = ({ d, size = 24, sw = 1.75, children }: { d?: string; size?: number; sw?: number; children?: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d && <path d={d} />}
    {children}
  </svg>
);
export const IconChevronRight = ({ size = 20 }: { size?: number }) => <I d="M9 6l6 6-6 6" size={size} sw={2} />;
export const IconDownload = () => <I d="M12 4v11M7 10l5 5 5-5M5 20h14" size={16} sw={2} />;
export const IconPaperclip = () => <I d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5" size={16} sw={2} />;

const NAV: { label: string; novo?: boolean; sub?: boolean; icon: ReactNode }[] = [
  { label: 'Indicadores', icon: <I><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 16v-3M12 16V8M16 16v-5" /></I> },
  { label: 'Monitoramento', sub: true, icon: <I><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></I> },
  { label: 'Análise de vídeos', sub: true, icon: <I><rect x="2" y="6" width="14" height="12" rx="3" /><path d="M16 10l6-3v10l-6-3" /></I> },
  { label: 'Minha frota', novo: true, sub: true, icon: <I><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6" rx="2" /><path d="M6 17v2M18 17v2" /></I> },
  { label: 'Combustível', sub: true, icon: <I><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 7h5v4H7z" /><path d="M15 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3" /></I> },
  { label: 'Manutenção', sub: true, icon: <I><circle cx="12" cy="12" r="9" /><path d="M14.5 8.5a3 3 0 0 0-4 4l-3 3 1 1 3-3a3 3 0 0 0 4-4l-2 2-1-1z" /></I> },
  { label: 'Despesas', novo: true, sub: true, icon: <I><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h4" /></I> },
  { label: 'Checklist', sub: true, icon: <I><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8.5 11l1.5 1.5 3-3M8.5 16.5l1.5 1.5 3-3" /></I> },
];

export function Sidebar() {
  const toast = useToast();
  const { usuario, usuarios, trocar } = useUsuario();
  const fora = () => toast('Módulo fora do escopo deste ambiente local');
  return (
    <nav className="sidebar no-print" aria-label="Navegação principal">
      <div className="logo">
        <img src="/infleet-logo.png" alt="INFLEET" />
      </div>
      {NAV.map((n) => (
        <button key={n.label} className="nav-item" onClick={fora}>
          {n.icon}
          <span>{n.label}</span>
          {n.novo && <span className="tag-novo">novo</span>}
          {n.sub && (
            <span className="chev">
              <IconChevronRight size={18} />
            </span>
          )}
        </button>
      ))}
      <Link to="/sinistros" className="nav-item" aria-expanded="true">
        <I>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </I>
        <span>Segurança</span>
        <span className="tag-novo">novo</span>
        <span className="chev">
          <I d="M6 9l6 6 6-6" size={18} sw={2} />
        </span>
      </Link>
      <NavLink to="/sinistros" className="nav-sub" aria-current="page">
        Sinistros
      </NavLink>
      <button className="nav-item" onClick={fora}>
        <I>
          <path d="M12 3a9 9 0 1 0 9 9h-9z" />
          <path d="M12 3v9h9" />
        </I>
        <span>Relatórios</span>
      </button>
      <div className="user-box">
        <label htmlFor="usuario-atual">Usando como</label>
        <select id="usuario-atual" className="select sm" value={usuario?.id ?? ''} onChange={(e) => trocar(e.target.value)}>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome} · {u.setor}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}

// ---------------------------------------------------------------- blocos

export function PageHeader(p: { crumbs: ReactNode; eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="crumbs">{p.crumbs}</div>
      <div className="title-row">
        <div className="stack" style={{ gap: 8 }}>
          {p.eyebrow && <span className="eyebrow">{p.eyebrow}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{typeof p.title === 'string' ? <h1>{p.title}</h1> : p.title}</div>
          {p.subtitle && <span className="subtitle">{p.subtitle}</span>}
        </div>
        {p.actions && <div className="actions">{p.actions}</div>}
      </div>
      {p.children}
    </header>
  );
}

/** Stepper de 5 etapas. `atual` = índice da etapa em andamento; anteriores ficam concluídas. */
export function Stepper({ atual, concluido = false }: { atual: number; concluido?: boolean }) {
  return (
    <ol className="stepper" aria-label="Etapas do caso">
      {ETAPAS_STEPPER.map((l, i) => {
        const done = i < atual || (concluido && i === atual);
        const cur = i === atual && !concluido;
        return (
          <li key={l} className={done ? 'done' : cur ? 'cur' : ''} aria-current={cur ? 'step' : undefined}>
            <div className="bar" />
            <span className="lbl">
              <span className="num">{done ? '✓' : i + 1}</span>
              {l}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function NivelBadge({ nivel, lg }: { nivel: Nivel; lg?: boolean }) {
  return (
    <span className={`badge ${lg ? 'lg' : ''}`}>
      <span className="dot" style={{ background: NIVEL_COR[nivel] }} />
      {NIVEIS[nivel]}
    </span>
  );
}

export function Card({ title, n, right, children, id }: { title?: ReactNode; n?: number; right?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="card" id={id}>
      {(title || right) && (
        <div className="card-head">
          <div className="t">
            {n !== undefined && <span className="step-n">{n}</span>}
            {title && <h2>{title}</h2>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Seg<T extends string>(p: { value: T | ''; options: readonly T[] | { value: T; label: string }[]; onChange?: (v: T) => void; label: string; width?: number; disabled?: boolean }) {
  const opts = (p.options as (T | { value: T; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className="seg" role="radiogroup" aria-label={p.label} style={p.width ? { width: p.width } : undefined}>
      {opts.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={p.value === o.value} disabled={p.disabled} onClick={() => p.onChange?.(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <div className="foot">{footer}</div>
      </div>
    </div>
  );
}

/** Botão que abre o seletor de arquivos. */
export function FileButton({ onFiles, children, multiple, className = 'btn secondary sm', disabled, accept }: { onFiles: (f: File[]) => void; children: ReactNode; multiple?: boolean; className?: string; disabled?: boolean; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => ref.current?.click()}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (f.length) onFiles(f);
        }}
      />
    </>
  );
}

export function AnexoItem({ a, extra }: { a: Pick<Anexo, 'id' | 'nome' | 'tamanho' | 'enviadoPor' | 'enviadoEm'>; extra?: ReactNode }) {
  return (
    <div className="file">
      <a href={urlAnexo(a.id)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <IconPaperclip />
        {a.nome}
      </a>
      <span className="meta">
        {fmtBytes(a.tamanho)} · {a.enviadoPor} · {fmtDataHora(a.enviadoEm)}
        {extra}
      </span>
    </div>
  );
}

export function ErrosNote({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div className="note danger" role="alert">
      <strong>{titulo}</strong>
      <ul>
        {itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export const Loading = () => <div className="loading">Carregando…</div>;
