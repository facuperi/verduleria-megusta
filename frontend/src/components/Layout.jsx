import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../hooks/useDevice';

export const Layout = ({ children }) => {
  const { user, userRole, logout } = useAuth();
  const { isMobile } = useDevice();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
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
                        <a href="/ventas" className="px-3 py-2 rounded hover:bg-indigo-700">Ventas</a>
                        <a href="/inventario" className="px-3 py-2 rounded hover:bg-indigo-700">Inventario</a>
                      </>
                    )}
                    {(isMobile || !isMobile) && (
                      <a href="/stock" className="px-3 py-2 rounded hover:bg-indigo-700">Stock</a>
                    )}
                    {userRole === 'gerente' && !isMobile && (
                      <>
                        <a href="/caja" className="px-3 py-2 rounded hover:bg-indigo-700">Caja</a>
                        <a href="/reportes" className="px-3 py-2 rounded hover:bg-indigo-700">Reportes</a>
                        <a href="/usuarios" className="px-3 py-2 rounded hover:bg-indigo-700">Usuarios</a>
                      </>
                    )}
                    <button onClick={handleLogout} className="px-3 py-2 rounded hover:bg-indigo-700 text-left">
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
    </div>
  );
};