import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDevice } from '../hooks/useDevice';
import { Modal } from './Modal';

const navItems = [
  { path: '/ventas', label: 'Ventas', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { path: '/stock', label: 'Stock', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { path: '/caja', label: 'Caja', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const gerenteItems = [
  { path: '/movimientos', label: 'Movimientos', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { path: '/reportes', label: 'Reportes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/usuarios', label: 'Usuarios', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
];

export const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, logout } = useAuth();
  const { isMobile } = useDevice();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const isActive = (path) => location.pathname === path;

  const allItems = [
    ...navItems,
    ...(userRole === 'gerente' ? gerenteItems : []),
  ];

  const NavLink = ({ item, onClick }) => (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive(item.path)
          ? 'bg-card text-body'
          : 'text-muted hover:bg-card hover:text-body'
      }`}
    >
      <svg className={`w-5 h-5 shrink-0 ${isActive(item.path) ? 'text-indigo' : 'text-icon'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
      </svg>
      {item.label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-page text-body flex">
      {user && !isMobile && (
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
          <div className="flex flex-col flex-1 min-h-0 bg-sidebar border-r border-line">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <h1 className="text-base font-bold text-body leading-tight">ME GUSTA</h1>
                <p className="text-xs text-muted leading-tight">Verdulería</p>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {allItems.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}
            </nav>

            <div className="px-3 py-4 border-t border-line">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card mb-2">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-body truncate">
                    {user?.email?.split('@')[0] || 'Usuario'}
                  </p>
                  <p className="text-xs text-muted capitalize">{userRole}</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-card transition-colors mb-1"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 shrink-0 text-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 shrink-0 text-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </button>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-card hover:text-red transition-colors"
              >
                <svg className="w-5 h-5 shrink-0 text-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {user && isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex flex-col flex-1 max-w-xs w-full bg-sidebar">
            <div className="flex items-center justify-between px-4 py-4 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-xs">M</span>
                </div>
                <div>
                  <h1 className="text-sm font-bold text-body leading-tight">ME GUSTA</h1>
                  <p className="text-[10px] text-muted leading-tight">Verdulería</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-card">
                <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {allItems.map((item) => (
                <NavLink key={item.path} item={item} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>

            <div className="px-3 py-4 border-t border-line">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card mb-2">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-body truncate">
                    {user?.email?.split('@')[0] || 'Usuario'}
                  </p>
                  <p className="text-xs text-muted capitalize">{userRole}</p>
                </div>
              </div>
              <button
                onClick={() => { setSidebarOpen(false); toggleTheme(); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-card transition-colors mb-1"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 shrink-0 text-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 shrink-0 text-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </button>
              <button
                onClick={() => { setSidebarOpen(false); setShowLogoutModal(true); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-card hover:text-red transition-colors"
              >
                <svg className="w-5 h-5 shrink-0 text-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 flex flex-col ${user ? 'md:pl-64' : ''}`}>
        {user && (
          <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-line md:hidden">
            <div className="flex items-center justify-between px-4 h-14">
              <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-elevated">
                <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">M</span>
                </div>
                <span className="font-bold text-body text-sm">ME GUSTA</span>
              </div>
              <div className="w-10" />
            </div>
          </header>
        )}

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <Modal open={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Cerrar sesión">
        <p className="text-secondary mb-6">¿Estás seguro de que quieres cerrar sesión?</p>
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Sí, cerrar sesión
          </button>
          <button
            onClick={() => setShowLogoutModal(false)}
            className="flex-1 bg-surface text-body py-2 px-4 rounded-lg hover:bg-elevated transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
};
