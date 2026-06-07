export const BuscadorProductos = ({
  busqueda,
  productosFiltrados,
  productos,
  sucursal,
  agregarComoNotaCredito,
  inputRef,
  onBusquedaChange,
  onKeyDown,
  onToggleNotaCredito,
  onProductClick,
}) => {
  return (
    <>
      <div className="bg-card p-4 rounded-lg shadow-sm border border-line mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold">Buscar producto (código de barras, código interno o nombre)</h3>
          <button
            onClick={onToggleNotaCredito}
            className={`px-3 py-1 rounded text-xs font-semibold border ${agregarComoNotaCredito ? 'bg-red-600 text-white border-red-600' : 'bg-elevated text-secondary border-line'}`}
          >
            {agregarComoNotaCredito ? '⚠️ Nota Crédito' : 'Agregar como Nota Crédito'}
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escaneá o escribí para buscar..."
          className="w-full border border-line-input bg-input text-body p-2 rounded"
        />

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
                    <p className="text-sm text-muted">{producto.codigoInterno}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green">EF: ${producto.precioEfectivo}</p>
                    <p className="text-blue">TJ: ${producto.precioTarjeta}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {sucursal && (
        <p className="text-sm text-muted mb-2">Vendiendo en: <span className="font-semibold capitalize">{sucursal}</span></p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {productos
          .filter(p => agregarComoNotaCredito || (p.stockPorNegocio?.[sucursal] || 0) > 0)
          .map(producto => (
            <div
              key={producto.id}
              onClick={() => onProductClick(producto)}
              className={`bg-card p-3 rounded-lg shadow-sm border border-line cursor-pointer hover:bg-elevated ${agregarComoNotaCredito ? 'ring-2 ring-red' : ''}`}
            >
              <h4 className="font-semibold text-sm">{producto.nombre}</h4>
              <p className="text-xs text-muted">{producto.codigoInterno}</p>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-green">EF: ${producto.precioEfectivo}</span>
                <span className="text-blue">TJ: ${producto.precioTarjeta}</span>
              </div>
              <p className="text-xs text-muted mt-1">
                Stock: {producto.stockPorNegocio?.[sucursal] || 0}
              </p>
            </div>
          ))}
      </div>
    </>
  );
};
