import { EmptyState } from './EmptyState';

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'MercadoPago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

const calcularDescuento = (pago, totalBase = 0) => {
  if (!pago.descuentoTipo || !pago.descuentoValor) return 0;
  const valor = parseFloat(pago.descuentoValor) || 0;
  if (pago.descuentoTipo === 'porcentaje') return totalBase * valor / 100;
  if (pago.descuentoTipo === 'fijo') return valor;
  return 0;
};

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
  totalDescuentos,
  totalConDescuento,
  error,
  tipoPrecioGlobal,
  onCambiarCantidad,
  onQuitarDelCarrito,
  onTogglePrecioGlobal,
  onToggleNotaCredito,
  onPagoChange,
  onDescuentoTipo,
  onMontoBlur,
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
        <div className="bg-gray-800/50 p-4 rounded-lg shadow-sm border border-gray-700/50 mb-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700/50">
            <span className="text-sm font-semibold text-gray-300">Tipo de precio</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold transition-colors ${tipoPrecioGlobal === 'efectivo' ? 'text-green-400' : 'text-gray-500'}`}>
                Efectivo
              </span>
              <button
                onClick={onTogglePrecioGlobal}
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${tipoPrecioGlobal === 'tarjeta' ? 'bg-blue-600' : 'bg-green-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${tipoPrecioGlobal === 'tarjeta' ? 'translate-x-7' : 'translate-x-0'}`} />
              </button>
              <span className={`text-xs font-semibold transition-colors ${tipoPrecioGlobal === 'tarjeta' ? 'text-blue-400' : 'text-gray-500'}`}>
                Tarjeta
              </span>
            </div>
          </div>
          {carrito.map((item, index) => {
            const precio = item.precioSeleccionado === 'tarjeta' ? item.precioTarjeta : item.precioEfectivo;
            const itemKey = `${item.id}-${item.precioSeleccionado}`;
            return (
              <div key={itemKey} className={`py-2 border-b ${item.esNotaCredito ? 'bg-red-900/20 -mx-4 px-4' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${item.esNotaCredito ? 'text-red-700' : ''}`}>
                      {item.esNotaCredito && '⚠️ '}{item.nombre}
                    </p>
                    <p className="text-xs text-gray-400">
                      ${precio} x {item.cantidad}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onCambiarCantidad(item.id, item.precioSeleccionado, item.cantidad - 1)}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      -
                    </button>
                    <span className="text-sm">{item.cantidad}</span>
                    <button
                      onClick={() => onCambiarCantidad(item.id, item.precioSeleccionado, item.cantidad + 1)}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => onQuitarDelCarrito(item.id, item.precioSeleccionado)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-end">
                  <button
                    onClick={() => onToggleNotaCredito(item.id, item.precioSeleccionado)}
                    className={`text-xs px-2 py-0.5 rounded border ${item.esNotaCredito ? 'bg-red-600 text-white border-red-600' : 'bg-gray-700 text-gray-300 border-gray-300'}`}
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
                  <div className="flex items-center justify-between bg-green-900/20 p-2 rounded mt-1">
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
                  <p className="text-gray-300">Sin costo adicional</p>
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
                className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded text-sm"
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {carrito.length > 0 && (
        <div className="bg-gray-800/50 p-4 rounded-lg shadow-sm border border-gray-700/50 mb-4">
          <h4 className="font-semibold mb-2">Métodos de Pago</h4>
          {pagosSeleccionados.map((pago, idx) => {
            const desc = calcularDescuento(pago, diferencia);
            const montoReal = Math.max(0, (parseFloat(pago.monto) || 0) - desc);
            return (
              <div key={idx} className="flex gap-1 mb-2 items-center flex-wrap">
                <select
                  value={pago.metodo}
                  onChange={(e) => onPagoChange(idx, 'metodo', e.target.value)}
                  className="flex-1 min-w-[100px] border border-gray-600 bg-gray-700 text-gray-100 rounded p-2 text-sm"
                >
                  {METODOS_PAGO.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={pago.monto}
                  onChange={(e) => onPagoChange(idx, 'monto', e.target.value)}
                  onBlur={() => onMontoBlur(idx)}
                  className="w-20 border border-gray-600 bg-gray-700 text-gray-100 rounded p-2 text-sm text-right"
                  placeholder="0"
                />
                <input
                  type="number"
                  value={pago.descuentoValor}
                  onChange={(e) => onPagoChange(idx, 'descuentoValor', e.target.value)}
                  className={`w-16 border border-gray-600 bg-gray-700 text-gray-100 rounded p-2 text-sm text-right ${!pago.descuentoTipo ? 'opacity-40' : ''}`}
                  placeholder="0"
                  disabled={!pago.descuentoTipo}
                />
                <button
                  onClick={() => onDescuentoTipo(idx, 'porcentaje')}
                  className={`px-2 py-2 text-sm font-bold rounded border ${pago.descuentoTipo === 'porcentaje' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-700 text-gray-300 border-gray-300'}`}
                  title="Descuento porcentual"
                >
                  %
                </button>
                <button
                  onClick={() => onDescuentoTipo(idx, 'fijo')}
                  className={`px-2 py-2 text-sm font-bold rounded border ${pago.descuentoTipo === 'fijo' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-700 text-gray-300 border-gray-300'}`}
                  title="Descuento fijo en $"
                >
                  $D
                </button>
                {pago.descuentoTipo && desc > 0 && (
                  <span className="text-xs text-green-700 font-semibold whitespace-nowrap">
                    ${montoReal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                )}
                {pagosSeleccionados.length > 1 && (
                  <button onClick={() => onQuitarMetodoPago(idx)} className="text-red-500 hover:text-red-700">✕</button>
                )}
              </div>
            );
          })}
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
              {totalDescuentos > 0 && (
                <p className="text-sm text-green-700">Descuentos: -${totalDescuentos.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
              )}
              <p className="text-sm font-semibold">Total a pagar: ${totalConDescuento.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
              <p className={`text-sm ${totalPagos === totalConDescuento ? 'text-green-600' : 'text-red-600'}`}>
                Pagos: ${totalPagos.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <button
              onClick={onRealizarVenta}
              disabled={vendiendo || !caja || totalPagos !== totalConDescuento}
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
