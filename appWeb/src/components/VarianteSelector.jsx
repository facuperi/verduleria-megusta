import React from 'react';

export const VarianteSelector = ({ open, productos, onSeleccionar, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-2">Seleccionar producto</h3>
        <p className="text-sm text-secondary mb-4">
          El código escaneado corresponde a varios productos:
        </p>
        <div className="space-y-2">
          {productos.map(p => (
            <button
              key={p.id}
              onClick={() => onSeleccionar(p)}
              className="w-full text-left p-3 rounded border border-line hover:bg-elevated hover:border-amber transition-colors"
            >
              <div className="font-semibold">{p.nombre}</div>
              {p.filtro && (
                <div className="text-xs text-secondary mt-0.5">{p.filtro}</div>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 text-secondary text-sm hover:text-body transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
