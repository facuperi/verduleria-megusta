import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../hooks/useDevice';
import { Modal } from './Modal';

export const Layout = ({ children }) => {
  const navigate = useNavigate();
  const { user, userRole, logout } = useAuth();
  const { isMobile } = useDevice();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold">Tienda de Ropa</span>
            </div>
            
            {user && (
              <>
                <button
                  className="md:hidden flex items-center px-4"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                  </svg>
                </button>

                <div className={`md:flex md:items-center ${menuOpen ? 'absolute top-16 left-0 right-0 bg-indigo-600 p-4' : 'hidden'}`}>
                  <div className="flex flex-col md:flex-row md:space-x-4 space-y-2 md:space-y-0">
                    {!isMobile && (
                      <>
                        <Link to="/ventas" className="px-3 py-2 rounded hover:bg-indigo-700">Ventas</Link>
                        <Link to="/stock" className="px-3 py-2 rounded hover:bg-indigo-700">Stock</Link>
                      </>
                    )}
                    {isMobile && (
                      <Link to="/stock" className="px-3 py-2 rounded hover:bg-indigo-700">Stock</Link>
                    )}
                    <Link to="/caja" className="px-3 py-2 rounded hover:bg-indigo-700">Caja</Link>
                    {!isMobile && userRole === 'gerente' && (
                      <>
                        <Link to="/movimientos" className="px-3 py-2 rounded hover:bg-indigo-700">Movimientos</Link>
                        <Link to="/reportes" className="px-3 py-2 rounded hover:bg-indigo-700">Reportes</Link>
                        <Link to="/usuarios" className="px-3 py-2 rounded hover:bg-indigo-700">Usuarios</Link>
                      </>
                    )}
                    <button onClick={() => setShowLogoutModal(true)} className="px-3 py-2 rounded hover:bg-indigo-700 text-left">
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      <Modal open={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Cerrar sesión">
        <p className="text-gray-600 mb-6">¿Estás seguro de que quieres cerrar sesión?</p>
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
          >
            Sí, cerrar sesión
          </button>
          <button
            onClick={() => setShowLogoutModal(false)}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
};