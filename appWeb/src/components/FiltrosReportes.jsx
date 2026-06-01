import { useState, useEffect } from 'react';

const TIPOS_RETIRO = [
  { id: 'cajaRoja', nombre: 'Caja roja', icono: '💰' },
  { id: 'gasto', nombre: 'Gasto', icono: '🧹' },
  { id: 'retiroCaro', nombre: 'Retiro Caro', icono: '👔' },
  { id: 'retiroFede', nombre: 'Retiro Fede', icono: '👔' },
  { id: 'errorMP', nombre: 'Error MP', icono: '⚠️' },
  { id: 'errorDNI', nombre: 'Error DNI', icono: '⚠️' },
  { id: 'errorTJ', nombre: 'Error TJ', icono: '⚠️' },
];

const TIPOS_MOVIMIENTO = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'ventas', nombre: 'Ventas' },
  { id: 'notasCredito', nombre: 'Notas de Crédito' },
  { id: 'retiros', nombre: 'Retiros' },
  { id: 'apertura', nombre: 'Apertura de Caja' },
  { id: 'cierre', nombre: 'Cierre de Caja' },
];

const NEGOCIOS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'chiclana', nombre: 'Chiclana' },
  { id: 'belgrano', nombre: 'Belgrano' },
];

const METODOS_PAGO = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'MercadoPago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

export const FiltrosReportes = ({
  fechaDesde, setFechaDesde,
  fechaHasta, setFechaHasta,
  negocio, setNegocio,
  tipoMovimiento, setTipoMovimiento,
  tipoRetiro, setTipoRetiro,
  metodoPago, setMetodoPago,
  facturaFilter, setFacturaFilter,
  productosSeleccionados, toggleProducto, limpiarProductos,
  busquedaProducto, setBusquedaProducto,
  mostrarSelectorProductos, setMostrarSelectorProductos,
  productos,
  cargarMovimientos, loading,
  movimientosFiltrados, exportarExcel,
}) => {
  const productosFiltrados = productos.filter(p =>
    p.nombre?.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigoInterno?.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigoBarras?.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  return (
    <div className="bg-gray-800/50 p-4 rounded-lg shadow-sm border border-gray-700/50 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Negocio</label>
          <select
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
            className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
          >
            {NEGOCIOS.map(n => (
              <option key={n.id} value={n.id}>{n.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Tipo Movimiento</label>
          <select
            value={tipoMovimiento}
            onChange={(e) => setTipoMovimiento(e.target.value)}
            className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
          >
            {TIPOS_MOVIMIENTO.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        {tipoMovimiento === 'retiros' && (
          <div>
            <label className="block text-sm font-semibold mb-1">Tipo Retiro</label>
            <select
              value={tipoRetiro}
              onChange={(e) => setTipoRetiro(e.target.value)}
              className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
            >
              <option value="todos">Todos</option>
              {TIPOS_RETIRO.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {(tipoMovimiento === 'ventas' || tipoMovimiento === 'todos') && (
          <div>
            <label className="block text-sm font-semibold mb-1">Método Pago</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
            >
              {METODOS_PAGO.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {(tipoMovimiento === 'ventas' || tipoMovimiento === 'todos') && (
          <div>
            <label className="block text-sm font-semibold mb-1">Facturación</label>
            <select
              value={facturaFilter}
              onChange={(e) => setFacturaFilter(e.target.value)}
              className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
            >
              <option value="todos">Todas</option>
              <option value="facturadas">Facturadas</option>
              <option value="sinFacturar">Sin Facturar</option>
            </select>
          </div>
        )}

        {tipoMovimiento === 'ventas' && (
          <div className="md:col-span-2 relative">
            <label className="block text-sm font-semibold mb-1">
              Productos {productosSeleccionados.length > 0 && `(${productosSeleccionados.length} seleccionados)`}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  onFocus={() => setMostrarSelectorProductos(true)}
                  placeholder={productosSeleccionados.length > 0 ? `${productosSeleccionados.length} productos seleccionados` : "Buscar por código o nombre..."}
                  className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
                />
                {mostrarSelectorProductos && (
                  <div className="absolute z-10 mt-1 bg-gray-800/50 border rounded shadow-sm border border-gray-700/50 max-h-64 overflow-y-auto w-full left-0">
                    <div className="p-2 bg-gray-700 sticky top-0 flex justify-between items-center">
                      <span className="text-xs text-gray-300">Productos disponibles</span>
                      <button
                        onClick={() => setMostrarSelectorProductos(false)}
                        className="text-gray-400 hover:text-gray-200 text-lg"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="p-2">
                      <input
                        type="text"
                        value={busquedaProducto}
                        onChange={(e) => setBusquedaProducto(e.target.value)}
                        placeholder="Buscar producto..."
                        className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-1 rounded text-sm mb-2"
                        autoFocus
                      />
                      {productosFiltrados.map(producto => (
                        <label
                          key={producto.id}
                          className="flex items-center gap-2 p-1 hover:bg-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={productosSeleccionados.includes(producto.id)}
                            onChange={() => toggleProducto(producto.id)}
                            className="rounded bg-gray-700 border-gray-600 text-gray-100"
                          />
                          <span className="text-xs text-gray-400 w-16">{producto.codigoInterno}</span>
                          <span className="text-sm truncate">{producto.nombre}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {productosSeleccionados.length > 0 && (
                <button
                  onClick={limpiarProductos}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
                >
                  Limpiar
                </button>
              )}
            </div>

            {productosSeleccionados.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {productosSeleccionados.map(id => {
                  const prod = productos.find(p => p.id === id);
                  return prod ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs"
                    >
                      {prod.codigoInterno}
                      <button
                        onClick={() => toggleProducto(id)}
                        className="text-indigo-500 hover:text-indigo-700"
                      >
                        ✕
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={cargarMovimientos}
          disabled={loading}
          className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Cargando...' : 'Buscar'}
        </button>
        {movimientosFiltrados.length > 0 && (
          <button
            onClick={exportarExcel}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          >
            📊 Exportar Excel
          </button>
        )}
      </div>
    </div>
  );
};