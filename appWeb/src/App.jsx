import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { LoginPage } from './pages/LoginPage';
import { VentasPage } from './pages/VentasPage';
import { StockPage } from './pages/StockPage';
import { MovimientosPage } from './pages/MovimientosPage';
import { CajaPage } from './pages/CajaPage';
import { ReportesPage } from './pages/ReportesPage';
import { UsuariosPage } from './pages/UsuariosPage';

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
        <div className="text-lg text-red-600">No tienes acceso a esta página</div>
      </div>
    );
  }

  return children;
};

function App() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  
  if (!apiKey || apiKey.includes('____')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuración Requerida</h1>
          <p className="text-gray-600 mb-4">Debes completar las credenciales de Firebase en el archivo <code>.env</code></p>
          <p className="text-sm text-gray-500">1. Ve a Firebase Console</p>
          <p className="text-sm text-gray-500">2. Project Settings - General</p>
          <p className="text-sm text-gray-500">3. Copia las credenciales al archivo <code>.env</code></p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <ErrorBoundary>
          <BrowserRouter>
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
          </BrowserRouter>
          </ErrorBoundary>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;