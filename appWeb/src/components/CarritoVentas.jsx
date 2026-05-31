import { EmptyState } from './EmptyState';

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'MercadoPago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

export const CarritoVentas = ({
  carrito,
  totalVenta,
  totalNotaCredito,
  diferencia,
  total,
  observacion,
  pagosSeleccionados,
  vendiendo,
  caja,
  totalPagos,
  error,
  onCambiarCantidad,
  onQuitarDelCarrito,
  onCambiarTipoPrecio,
  onToggleNotaCredito,
  onPagoChange,
  onAgregarMetodoPago,
  onQuitarMetodoPago,
  onObservacionChange,
  onImprimirAFavor,
  onRealizarVenta,
}) => {
  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Carrito</h3>

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">{error}</div>
      )}

      {carrito.length === 0 ? (
        <EmptyState title="El carrito está vacío" icon="🛒" />
      ) : (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          {carrito.map((item, index) => {
            const precio = item.precioSeleccionado === 'tarjeta' ? item.precioTarjeta : item.precioEfectivo;
            const itemKey = `${item.id}-${item.precioSeleccionado}`;
            return (
              <div key={itemKey} className={`py-2 border-b ${item.esNotaCredito ? 'bg-red-50 -mx-4 px-4' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${item.esNotaCredito ? 'text-red-700' : ''}`}>
                      {item.esNotaCredito && '⚠️ '}{item.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      ${precio} x {item.cantidad}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onCambiarCantidad(item.id, item.precioSeleccionado, item.cantidad - 1)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      -
                    </button>
                    <span className="text-sm">{item.cantidad}</span>
                    <button
                      onClick={() => onCambiarCantidad(item.id, item.precioSeleccionado, item.cantidad + 1)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => onQuitarDelCarrito(item.id, item.precioSeleccionado)}
                    className="text-red-600 hover:text-red-800 ml-2"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <select
                    value={item.precioSeleccionado}
                    onChange={(e) => onCambiarTipoPrecio(index, e.target.value)}
                    className="text-xs border rounded px-1 py-0.5"
                  >
                    <option value="efectivo">Efectivo: ${item.precioEfectivo}</option>
                    <option value="tarjeta">Tarjeta: ${item.precioTarjeta}</option>
                  </select>
                  <button
                    onClick={() => onToggleNotaCredito(item.id, item.precioSeleccionado)}
                    className={`text-xs px-2 py-0.5 rounded border ${item.esNotaCredito ? 'bg-red-600 text-white border-red-600' : 'bg-gray-100 text-gray-600 border-gray-300'}`}
                  >
                    {item.esNotaCredito ? 'Nota Crédito' : 'Venta'}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="mt-4 pt-4 border-t">
            {totalNotaCredito > 0 && (
              <div className="text-sm mb-2">
                <p className="text-red-600">Nota Crédito: -${totalNotaCredito}</p>
                {diferencia < 0 && (
                  <div className="flex items-center justify-between bg-green-50 p-2 rounded mt-1">
                    <p className="text-green-700 font-semibold">A favor: $${Math.abs(diferencia)}</p>
                    <button
                      onClick={onImprimirAFavor}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      🖨️ Imprimir Ticket
                    </button>
                  </div>
                )}
                {diferencia > 0 && (
                  <p className="text-blue-600">El cliente debe pagar: ${diferencia}</p>
                )}
                {diferencia === 0 && (
                  <p className="text-gray-600">Sin costo adicional</p>
                )}
              </div>
            )}
            <p className="text-xl font-bold">Total: ${total}</p>
          </div>

          {totalNotaCredito > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-semibold mb-1">Observación / Motivo</label>
              <textarea
                value={observacion}
                onChange={(e) => onObservacionChange(e.target.value)}
                placeholder="Ej: Error de precio, cliente devolvió producto..."
                className="w-full border p-2 rounded text-sm"
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {carrito.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h4 className="font-semibold mb-2">Métodos de Pago</h4>
          {pagosSeleccionados.map((pago, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <select
                value={pago.metodo}
                onChange={(e) => onPagoChange(idx, 'metodo', e.target.value)}
                className="flex-1 border rounded p-2 text-sm"
              >
                {METODOS_PAGO.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
              <input
                type="number"
                value={pago.monto}
                onChange={(e) => onPagoChange(idx, 'monto', e.target.value)}
                className="w-28 border rounded p-2 text-sm text-right"
                placeholder="0"
              />
              {pagosSeleccionados.length > 1 && (
                <button onClick={() => onQuitarMetodoPago(idx)} className="text-red-500 hover:text-red-700">✕</button>
              )}
            </div>
          ))}
          <button
            onClick={onAgregarMetodoPago}
            disabled={pagosSeleccionados.length >= METODOS_PAGO.length}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            + Agregar método de pago
          </button>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div>
              <p className="text-sm">Total: ${totalVenta.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
              <p className={`text-sm font-semibold ${totalPagos === total ? 'text-green-600' : 'text-red-600'}`}>
                Pagos: ${totalPagos.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <button
              onClick={onRealizarVenta}
              disabled={vendiendo || !caja || totalPagos !== total}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {vendiendo ? 'Vendiendo...' : '💵 Vender'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
