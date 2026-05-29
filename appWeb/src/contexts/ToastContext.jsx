import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const TYPE_STYLES = {
  success: { bg: 'bg-green-500', icon: '✓' },
  error: { bg: 'bg-red-500', icon: '✕' },
  info: { bg: 'bg-blue-500', icon: 'ℹ' },
  warning: { bg: 'bg-orange-500', icon: '⚠' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => {
          const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
          return (
            <div
              key={toast.id}
              onClick={() => removeToast(toast.id)}
              className={`${style.bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-90 animate-slide-in`}
            >
              <span className="text-lg font-bold leading-none">{style.icon}</span>
              <span className="text-sm font-medium leading-tight">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
