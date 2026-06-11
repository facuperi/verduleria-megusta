import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import './themes/theme.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const VentasPage = lazy(() => import('./pages/VentasPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const MovimientosPage = lazy(() => import('./pages/MovimientosPage'));
const CajaPage = lazy(() => import('./pages/CajaPage'));
const ReportesPage = lazy(() => import('./pages/ReportesPage'));
const UsuariosPage = lazy(() => import('./pages/UsuariosPage'));

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return <LoadingSkeleton type="page" />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red">No tienes acceso a esta página</div>
      </div>
    );
  }

  return children;
};

function App() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  
  if (!apiKey || apiKey.includes('____')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-page">
        <div className="bg-card p-8 rounded-lg shadow-md max-w-md text-center">
          <h1 className="text-2xl font-bold text-red mb-4">Configuración Requerida</h1>
          <p className="text-secondary mb-4">Debes completar las credenciales de Firebase en el archivo <code>.env</code></p>
          <p className="text-sm text-muted">1. Ve a Firebase Console</p>
          <p className="text-sm text-muted">2. Project Settings - General</p>
          <p className="text-sm text-muted">3. Copia las credenciales al archivo <code>.env</code></p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<LoadingSkeleton type="page" />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/ventas" element={<PrivateRoute><VentasPage /></PrivateRoute>} />
                <Route path="/stock" element={<PrivateRoute><StockPage /></PrivateRoute>} />
                <Route path="/movimientos" element={
                  <PrivateRoute requiredRole="gerente">
                    <MovimientosPage />
                  </PrivateRoute>
                } />
                <Route path="/caja" element={
                  <PrivateRoute>
                    <CajaPage />
                  </PrivateRoute>
                } />
                <Route path="/reportes" element={
                  <PrivateRoute requiredRole="gerente">
                    <ReportesPage />
                  </PrivateRoute>
                } />
                <Route path="/usuarios" element={
                  <PrivateRoute requiredRole="gerente">
                    <UsuariosPage />
                  </PrivateRoute>
                } />
                <Route path="/" element={<Navigate to="/login" />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </ErrorBoundary>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}

export default App;