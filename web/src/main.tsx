import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import './styles.css';
import { ToastProvider, UserProvider } from './components/ui.tsx';
import { Lista } from './pages/Lista.tsx';
import { Registro } from './pages/Registro.tsx';
import { ClassificacaoPage } from './pages/Classificacao.tsx';
import { InvestigacaoPage } from './pages/Investigacao.tsx';
import { Acompanhamento } from './pages/Acompanhamento.tsx';
import { Conclusao } from './pages/Conclusao.tsx';
import { Ficha } from './pages/Ficha.tsx';
import { Relatorio } from './pages/Relatorio.tsx';

function AbrirCaso() {
  const { id } = useParams();
  return <Navigate to={`/sinistros/${id}/ficha`} replace />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/sinistros" replace />} />
            <Route path="/sinistros" element={<Lista />} />
            <Route path="/sinistros/novo" element={<Registro />} />
            <Route path="/sinistros/:id" element={<AbrirCaso />} />
            <Route path="/sinistros/:id/registro" element={<Registro />} />
            <Route path="/sinistros/:id/classificacao" element={<ClassificacaoPage />} />
            <Route path="/sinistros/:id/investigacao" element={<InvestigacaoPage />} />
            <Route path="/sinistros/:id/acompanhamento" element={<Acompanhamento />} />
            <Route path="/sinistros/:id/conclusao" element={<Conclusao />} />
            <Route path="/sinistros/:id/ficha" element={<Ficha />} />
            <Route path="/sinistros/:id/relatorio" element={<Relatorio />} />
            <Route path="*" element={<Navigate to="/sinistros" replace />} />
          </Routes>
        </ToastProvider>
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
);
