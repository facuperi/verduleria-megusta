import { formatNum } from '../utils/format';
import { EmptyState } from './EmptyState';

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'Mercado Pago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

const calcularDescuento = (pago, totalBase = 0) => {
  if (!pago.descuentoTipo || !pago.descuentoValor) return 0;
  const valor = parseFloat(pago.descuentoValor) || 0;
  if (pago.descuentoTipo === 'porcentaje') return totalBase * valor / 100;
  if (pago.descuentoTipo === 'fijo') return valor;
  return 0;
};

const esPesable = (tipo) => tipo === 'pesable' || tipo === 'pesableConStock';

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
  tiposDescuento,
  tipoDescuento,
  pesoActual,
  conectandoBalanza,
  onChangeTipoDescuento,
  onAbrirModalTipoDesc,
  onCambiarCantidad,
  onQuitarDelCarrito,
  onToggleNotaCredito,
  onPagoChange,
  onDescuentoTipo,
  onDescuento10,
  onMontoBlur,
  onAgregarMetodoPago,
  onQuitarMetodoPago,
  onObservacionChange,
  onImprimirAFavor,
  onRealizarVenta,
  onConectarBalanza,
  notaCreditoOriginal,
  mostrarInputNC,
  notaCreditoDescuento,
  sobranteNC,
  onNotaCreditoChange,
  onToggleInputNC,
}) => {
  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Carrito</h3>

      {error && (
        <div className="bg-red-soft text-red px-4 py-2 rounded mb-4">{error}</div>
      )}

      {carrito.length === 0 ? (
        <EmptyState title="El carrito está vacío" icon="🛒" />
      ) : (
        <div className="bg-card p-4 rounded-lg shadow-sm border border-line mb-4">
          {carrito.map((item, index) => {
            const precio = esPesable(item.tipo) ? (item.precio || 0) * (item.peso || 0) : item.precio;
            const itemKey = `${item.id}`;
            return (
              <div key={itemKey} className={`py-2 border-b border-line ${item.esNotaCredito ? 'bg-red-soft -mx-4 px-4' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${item.esNotaCredito ? 'text-red' : ''}`}>
                      {item.esNotaCredito && '⚠️ '}{item.nombre}
                    </p>
                    <p className="text-xs text-muted">
                      {esPesable(item.tipo)
                        ? `$${formatNum(item.precio)} x ${item.peso}kg = $${formatNum(precio)}`
                        : `$${formatNum(precio)} x ${item.cantidad}`}
                    </p>
                  </div>
                  {!esPesable(item.tipo) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onCambiarCantidad(item.id, item.cantidad - 1)}
                        className="text-muted hover:text-body"
                      >
                        -
                      </button>
                      <span className="text-sm">{item.cantidad}</span>
                      <button
                        onClick={() => onCambiarCantidad(item.id, item.cantidad + 1)}
                        className="text-muted hover:text-body"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => onQuitarDelCarrito(item.id)}
                    className="text-red hover:text-red ml-2"
                  >
                    ✕
                  </button>
                </div>
                {!esPesable(item.tipo) && (
                  <div className="mt-1 flex items-center justify-end">
                    <button
                      onClick={() => onToggleNotaCredito(item.id)}
                      className={`text-xs px-2 py-0.5 rounded border ${item.esNotaCredito ? 'bg-red-600 text-white border-red-600' : 'bg-elevated text-secondary border-line'}`}
                    >
                      {item.esNotaCredito ? 'Nota Crédito' : 'Venta'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-4 pt-4 border-t border-line">
            {totalNotaCredito > 0 && (
              <div className="text-sm mb-2">
                <p className="text-red">Nota Crédito: -${formatNum(totalNotaCredito)}</p>
                {diferencia < 0 && (
                  <div className="flex items-center justify-between bg-green-soft p-2 rounded mt-1">
                    <p className="text-green font-semibold">A favor: $${formatNum(Math.abs(diferencia))}</p>
                    <button
                      onClick={onImprimirAFavor}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      🖨️ Imprimir Ticket
                    </button>
                  </div>
                )}
                {diferencia > 0 && (
                  <p className="text-blue">El cliente debe pagar: ${formatNum(diferencia)}</p>
                )}
                {diferencia === 0 && (
                  <p className="text-secondary">Sin costo adicional</p>
                )}
              </div>
            )}
            <p className="text-xl font-bold">Total: ${formatNum(total)}</p>
          </div>

          {totalNotaCredito > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-semibold mb-1">Observación / Motivo</label>
              <textarea
                value={observacion}
                onChange={(e) => onObservacionChange(e.target.value)}
                placeholder="Ej: Error de precio, cliente devolvió producto..."
                className="w-full border border-line-input bg-input text-body p-2 rounded text-sm"
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {carrito.length > 0 && (
        <div className="bg-card p-4 rounded-lg shadow-sm border border-line mb-4">
          <h4 className="font-semibold mb-2">Métodos de Pago</h4>
          {pagosSeleccionados.map((pago, idx) => {
            const desc = calcularDescuento(pago, diferencia);
            const montoReal = Math.max(0, (parseFloat(pago.monto) || 0) - desc);
            return (
              <div key={idx} className="flex gap-1 mb-1.5 items-center">
                <select
                  value={pago.metodo}
                  onChange={(e) => onPagoChange(idx, 'metodo', e.target.value)}
                  className="w-24 border border-line-input bg-input text-body rounded px-1.5 py-1 text-xs"
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
                  className="w-16 border border-line-input bg-input text-body rounded px-1.5 py-1 text-xs text-right"
                  placeholder="0"
                />
                <input
                  type="number"
                  value={pago.descuentoValor}
                  onChange={(e) => onPagoChange(idx, 'descuentoValor', e.target.value)}
                  className={`w-12 border border-line-input bg-input text-body rounded px-1.5 py-1 text-xs text-right ${!pago.descuentoTipo ? 'opacity-40' : ''}`}
                  placeholder="0"
                  disabled={!pago.descuentoTipo}
                />
                <button
                  onClick={() => onDescuentoTipo(idx, 'porcentaje')}
                  className={`px-1.5 py-1 text-xs font-bold rounded border leading-none ${pago.descuentoTipo === 'porcentaje' && pago.descuentoValor != 10 ? 'bg-blue-600 text-white border-blue-600' : 'bg-elevated text-secondary border-line'}`}
                  title="Descuento %"
                >
                  %
                </button>
                <button
                  onClick={() => onDescuento10(idx)}
                  className={`px-1.5 py-1 text-xs font-bold rounded border leading-none ${pago.descuentoTipo === 'porcentaje' && pago.descuentoValor == 10 ? 'bg-blue-600 text-white border-blue-600' : 'bg-elevated text-secondary border-line'}`}
                  title="10% de descuento"
                >
                  10%
                </button>
                <button
                  onClick={() => onDescuentoTipo(idx, 'fijo')}
                  className={`px-1.5 py-1 text-xs font-bold rounded border leading-none ${pago.descuentoTipo === 'fijo' ? 'bg-blue-600 text-white border-blue-600' : 'bg-elevated text-secondary border-line'}`}
                  title="Descuento fijo en $"
                >
                  $D
                </button>
                {pago.descuentoTipo && desc > 0 && (
                  <span className="text-[10px] text-green font-semibold whitespace-nowrap">
                    -${montoReal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                )}
                {pagosSeleccionados.length > 1 && (
                  <button onClick={() => onQuitarMetodoPago(idx)} className="text-red hover:text-red text-xs ml-0.5">✕</button>
                )}
              </div>
            );
          })}
          <button
              onClick={onAgregarMetodoPago}
              disabled={pagosSeleccionados.length >= METODOS_PAGO.length}
              className="text-sm text-blue hover:text-blue disabled:opacity-50"
          >
            + Agregar método de pago
          </button>

          <div className="mt-3 pt-3 border-t border-line">
            <button
              onClick={onToggleInputNC}
              className={`text-sm px-3 py-1.5 rounded font-semibold border ${mostrarInputNC ? 'bg-purple-600 text-white border-purple-600' : 'bg-elevated text-secondary border-line'}`}
            >
              {mostrarInputNC ? '✕ Quitar Ticket NC' : '➕ Ticket Nota de Crédito'}
            </button>
            {mostrarInputNC && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={notaCreditoOriginal}
                  onChange={(e) => onNotaCreditoChange(e.target.value)}
                  className="w-32 border border-line-input bg-input text-body rounded p-2 text-sm text-right"
                  placeholder="Monto NC"
                />
                <span className="text-sm text-secondary">del comprobante</span>
                {notaCreditoDescuento > 0 && (
                  <span className="text-sm text-purple font-semibold">
                    -${notaCreditoDescuento.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                )}
                {sobranteNC > 0 && (
                  <span className="text-sm text-green font-semibold">
                    Sobrante: ${sobranteNC.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            )}
          </div>

          {totalDescuentos > 0 && (
            <div className="mt-3 pt-3 border-t border-line">
              <label className="block text-sm font-semibold mb-1">Tipo de descuento</label>
              <div className="flex gap-2">
                <select
                  value={tipoDescuento}
                  onChange={(e) => onChangeTipoDescuento(e.target.value)}
                  className="flex-1 border border-line-input bg-input text-body p-2 rounded text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {tiposDescuento.map(t => (
                    <option key={t.id} value={t.nombre}>{t.icono} {t.nombre}</option>
                  ))}
                </select>
                <button
                  onClick={onAbrirModalTipoDesc}
                  className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >+</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-sm">Total: ${totalVenta.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
                {totalDescuentos > 0 && (
                  <p className="text-sm text-green">Descuentos: -${totalDescuentos.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
                )}
                {notaCreditoDescuento > 0 && (
                  <p className="text-sm text-purple">NC aplicada: -${notaCreditoDescuento.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
                )}
                <p className="text-sm font-semibold">Total a pagar: ${totalConDescuento.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
                <p className={`text-sm ${totalPagos === totalConDescuento ? 'text-green' : 'text-red'}`}>
                  Pagos: ${totalPagos.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pesoActual !== null && (
                  <span className="text-sm font-semibold text-amber">
                    ⚖️ Peso: {pesoActual} kg
                  </span>
                )}
                <button
                  onClick={onConectarBalanza}
                  disabled={conectandoBalanza}
                  className="text-xs px-2 py-1 rounded border bg-elevated text-secondary border-line hover:bg-card disabled:opacity-50"
                >
                  {conectandoBalanza ? 'Conectando...' : '🔗 Balanza'}
                </button>
              </div>
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