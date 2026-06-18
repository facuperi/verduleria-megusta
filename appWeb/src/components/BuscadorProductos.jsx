import { formatNum } from '../utils/format';

export const BuscadorProductos = ({
  busqueda,
  productosFiltrados,
  productos,
  agregarComoNotaCredito,
  onBusquedaChange,
  onToggleNotaCredito,
  onProductClick,
  scanError,
}) => {
  return (
    <>
      <div className="bg-card p-4 rounded-lg shadow-sm border border-line mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold">Buscar producto (código de barras o nombre)</h3>
          <button
            onClick={onToggleNotaCredito}
            className={`px-3 py-1 rounded text-xs font-semibold border ${agregarComoNotaCredito ? 'bg-red-600 text-white border-red-600' : 'bg-elevated text-secondary border-line'}`}
          >
            {agregarComoNotaCredito ? '⚠️ Nota Crédito' : 'Agregar como Nota Crédito'}
          </button>
        </div>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          placeholder="Escaneá o escribí para buscar..."
          className="w-full border border-line-input bg-input text-body p-2 rounded"
        />

        {scanError && (
          <div className="mt-2 p-2 bg-red-soft text-red text-sm rounded flex items-center gap-1 font-semibold">
            ⚠️ Código <strong>{scanError}</strong> no encontrado en la base de datos
          </div>
        )}

        {busqueda && (
          <div className="mt-2 max-h-60 overflow-y-auto">
            {productosFiltrados.length === 0 ? (
              <p className="text-muted">No se encontraron productos</p>
            ) : (
              productosFiltrados.map(producto => (
                <div
                  key={producto.id}
                  onClick={() => onProductClick(producto)}
                  className="p-2 hover:bg-elevated cursor-pointer border-b border-line flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">{producto.nombre}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green">${formatNum(producto.precio)}</p>
                    {(producto.tipo === 'pesable' || producto.tipo === 'pesableConStock') && <p className="text-xs text-muted">(x kg)</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {productos
          .filter(() => true)
          .map(producto => (
            <div
              key={producto.id}
              onClick={() => onProductClick(producto)}
              className={`bg-card p-3 rounded-lg shadow-sm border border-line cursor-pointer hover:bg-elevated ${agregarComoNotaCredito ? 'ring-2 ring-red' : ''} ${producto.tipo === 'pesable' || producto.tipo === 'pesableConStock' ? 'ring-1 ring-amber' : ''}`}
            >
              <h4 className="font-semibold text-sm">{producto.nombre}</h4>
              <div className="mt-1 flex justify-between items-center text-sm">
                <span className="text-green">${formatNum(producto.precio)}</span>
                {(producto.tipo === 'pesable' || producto.tipo === 'pesableConStock') && <span className="text-xs text-amber font-medium">Pesable</span>}
              </div>
              {producto.tipo === 'noPesable' && (
                <p className="text-xs text-muted mt-1">
                  Stock: {producto.stock || 0}
                </p>
              )}
              {producto.tipo === 'pesableConStock' && (
                <p className="text-xs text-muted mt-1">
                  Stock: {producto.stock || 0} kg
                </p>
              )}
            </div>
          ))}
      </div>
    </>
  );
};
