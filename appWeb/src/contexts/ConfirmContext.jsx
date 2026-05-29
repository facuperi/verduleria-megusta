import { createContext, useContext, useState, useCallback } from 'react';

const ConfirmContext = createContext(null);

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState({
    isOpen: false,
    message: '',
    title: 'Confirmar',
    resolve: null,
    confirmText: 'Sí, confirmar',
    cancelText: 'Cancelar',
  });

  const confirm = useCallback((message, title = 'Confirmar', confirmText = 'Sí, confirmar', cancelText = 'Cancelar') => {
    return new Promise((resolve) => {
      setState({ isOpen: true, message, title, resolve, confirmText, cancelText });
    });
  }, []);

  const handleConfirm = () => {
    state.resolve(true);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    state.resolve(false);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleOverlayClick = () => {
    handleCancel();
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleOverlayClick}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">{state.title}</h3>
            <p className="text-gray-600 mb-6">{state.message}</p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors font-medium"
              >
                {state.confirmText}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400 transition-colors font-medium"
              >
                {state.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
