import { formatNum } from '../utils/format';

const TIPOS_RETIRO_FIJOS = [
  { id: 'cajaRoja', nombre: 'Caja roja', icono: '💰' },
  { id: 'gasto', nombre: 'Gasto', icono: '🧹' },
  { id: 'pagoProveedor', nombre: 'Pago Proveedor', icono: '📦' },
  { id: 'retiro', nombre: 'Retiro', icono: '💸' },
];

const TIPOS_INGRESO_FIJOS = [
  { id: 'ventaDirecta', nombre: 'Venta Directa', icono: '💰' },
  { id: 'deposito', nombre: 'Depósito', icono: '🏦' },
  { id: 'otroIngreso', nombre: 'Otro Ingreso', icono: '📥' },
];

export const TablaReportes = ({ movimientosFiltrados, filasExpandidas, toggleFila, tiposRetiroPersonalizados, tiposIngresoPersonalizados, onReimprimirTicket }) => {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-line overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-table-header">
            <tr>
              <th className="px-4 py-2 text-left">Fecha</th>
              <th className="px-4 py-2 text-left">Hora</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Negocio</th>
              <th className="px-4 py-2 text-left">Detalle</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2 text-left">Método</th>
              <th className="px-4 py-2 text-left">Usuario</th>
              <th className="px-4 py-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {movimientosFiltrados.map(m => {
              let tipo = '';
              let detalle = '';
              let monto = 0;
              let colorFila = '';

              if (m.origen === 'ventas') {
                const esNotaCredito = m.tipoVenta === 'notaCredito' || (m.tipoVenta === 'mixta' && m.diferencia < 0);
                tipo = esNotaCredito ? 'Nota Crédito' : 'Venta';
                detalle = m.productos?.map(p => `${p.nombre} x${p.cantidad}`).join(', ');
                monto = (m.pagos?.some(p => p.descuentoTipo)
                  ? m.pagos.reduce((s, p) => s + (p.monto || 0), 0)
                  : (m.total ?? (m.diferencia > 0 ? m.diferencia : m.totalNotaCredito || 0)));
                colorFila = esNotaCredito ? 'bg-red-soft' : 'bg-green-soft';
              } else if (m.origen === 'retiros') {
                const tipoFijo = TIPOS_RETIRO_FIJOS.find(t => t.id === m.tipo);
                const tipoPersonalizado = tiposRetiroPersonalizados[m.tipo];
                let nombreTipo = '';
                let iconoRetiro = '💸';
                if (tipoFijo) {
                  nombreTipo = tipoFijo.nombre;
                  iconoRetiro = tipoFijo.icono;
                } else if (tipoPersonalizado) {
                  nombreTipo = tipoPersonalizado.nombre;
                  iconoRetiro = tipoPersonalizado.icono || '💸';
                } else {
                  nombreTipo = m.tipo.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                }
                tipo = `${iconoRetiro} ${nombreTipo}`;
                detalle = m.observacion || '-';
                monto = -m.monto;
                colorFila = 'bg-orange-soft';
              } else if (m.origen === 'ingresos') {
                const tipoFijo = TIPOS_INGRESO_FIJOS.find(t => t.id === m.tipo);
                const tipoPersonalizado = tiposIngresoPersonalizados[m.tipo];
                let nombreTipo = '';
                let iconoIngreso = '🟢';
                if (tipoFijo) {
                  nombreTipo = tipoFijo.nombre;
                  iconoIngreso = tipoFijo.icono;
                } else if (tipoPersonalizado) {
                  nombreTipo = tipoPersonalizado.nombre;
                  iconoIngreso = tipoPersonalizado.icono || '🟢';
                } else {
                  nombreTipo = m.tipo.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                }
                tipo = `${iconoIngreso} ${nombreTipo}`;
                detalle = m.observacion || '-';
                monto = m.monto;
                colorFila = 'bg-green-soft';
              } else {
                tipo = m.estado === 'abierta' ? 'Apertura' : 'Cierre';
                detalle = `Saldo: $${m.saldoApertura || m.saldoCierre || 0}`;
                monto = m.estado === 'cerrada' ? (m.saldoCierre || 0) : (m.saldoApertura || 0);
                colorFila = 'bg-blue-soft';
              }

              const fecha = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha || m.hora);

              return (
                <React.Fragment key={m.id}>
                <tr
                  className={`border-t border-line ${colorFila} cursor-pointer hover:opacity-80`}
                  onClick={() => toggleFila(m.id)}
                >
                  <td className="px-4 py-2">
                    <button className="text-secondary hover:text-body mr-2">
                      {filasExpandidas[m.id] ? '▼' : '▶'}
                    </button>
                    {fecha.toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-2">{fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-2">{tipo}</td>
                  <td className="px-4 py-2 capitalize">{m.negocio || m.sucursal || '-'}</td>
                  <td className="px-4 py-2 max-w-xs truncate" title={detalle}>{detalle}</td>
                   <td className={`px-4 py-2 text-right font-semibold ${monto >= 0 ? 'text-green' : 'text-red'}`}>
                    ${Math.abs(monto).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-2">{m.tipoPago?.join(', ') || '-'}</td>
                  <td className="px-4 py-2 text-sm text-muted">{m.usuarioNombre || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    {m.origen === 'caja' && m.estado === 'cerrada' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onReimprimirTicket(m); }}
                        className="text-blue hover:text-blue text-sm"
                        title="Reimprimir ticket de cierre"
                      >🧾</button>
                    )}
                  </td>
                </tr>
                {filasExpandidas[m.id] && (
                  <tr key={`${m.id}-detalle`} className="border-t border-line bg-card">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="text-sm">
                        <p className="font-semibold mb-2">Detalle completo:</p>
                        {m.origen === 'ventas' && m.productos && (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left">
                                <th className="py-1">Producto</th>
                                <th className="py-1">Cantidad</th>
                                <th className="py-1">Precio</th>
                                <th className="py-1">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.productos.map((p, idx) => (
                                 <tr key={idx} className="border-b border-line">
                                  <td className="py-1">{p.nombre}</td>
                                  <td className="py-1">{p.cantidad}</td>
                                  <td className="py-1">${formatNum(p.precio)}</td>
                                  <td className="py-1">${(p.precio * p.cantidad).toLocaleString('es-AR')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {m.origen === 'ventas' && (
                          <div className="mt-2">
                            {m.notaCreditoDescuento > 0 && (
                              <p className="text-xs ml-2 mb-1"><strong>NC redimida:</strong> -${m.notaCreditoDescuento.toLocaleString('es-AR')}</p>
                            )}
                            {m.notaCreditoOriginal > 0 && (
                              <p className="text-xs ml-2 mb-1"><strong>Comp. original:</strong> ${m.notaCreditoOriginal.toLocaleString('es-AR')}</p>
                            )}
                            {m.nuevoSaldoFavor > 0 && (
                              <p className="text-xs ml-2 mb-1"><strong>NC generada:</strong> ${m.nuevoSaldoFavor.toLocaleString('es-AR')}</p>
                            )}
                          </div>
                        )}
                        {m.origen === 'ventas' && m.pagos && (
                          <div className="mt-2">
                            <p className="font-semibold mb-1">Métodos de pago:</p>
                            {m.tipoDescuento && (
                              <p className="text-xs ml-2 mb-1"><strong>Tipo de descuento:</strong> {m.tipoDescuento}</p>
                            )}
                            {m.pagos.map((pg, idx) => {
                              const tieneDesc = pg.descuentoTipo && pg.descuentoValor > 0;
                              const descEtiqueta = tieneDesc
                                ? (pg.descuentoTipo === 'porcentaje'
                                  ? `${pg.descuentoValor}%`
                                  : `$${pg.descuentoValor.toLocaleString('es-AR')}`)
                                : null;
                              const descValor = tieneDesc
                                ? (pg.descuentoTipo === 'porcentaje'
                                  ? (m.diferencia || m.total || 0) * pg.descuentoValor / 100
                                  : pg.descuentoValor)
                                : 0;
                              return (
                                <p key={idx} className="text-xs ml-2">
                                  {pg.metodo}: ${(pg.monto || 0).toLocaleString('es-AR')}
                                  {descValor > 0 && <span className="text-green"> ({descEtiqueta} desc s/$${(m.diferencia || m.total || 0).toLocaleString('es-AR')})</span>}
                                </p>
                              );
                            })}
                          </div>
                        )}
                        {m.origen === 'retiros' && (
                          <p><strong>Tipo:</strong> {m.tipo} | <strong>Monto:</strong> ${formatNum(m.monto)} | <strong>Obs:</strong> {m.observacion || '-'}</p>
                        )}
                        {m.origen === 'ingresos' && (
                          <p><strong>Tipo:</strong> {m.tipo} | <strong>Monto:</strong> ${formatNum(m.monto)} | <strong>Obs:</strong> {m.observacion || '-'}</p>
                        )}
                        {m.origen === 'caja' && (
                          <p>
                            <strong>Saldo Apertura:</strong> ${formatNum(m.saldoApertura || 0)} |
                            <strong> Saldo Cierre:</strong> ${formatNum(m.saldoCierre || 0)} |
                            <strong> Estado:</strong> {m.estado}
                          </p>
                        )}
                        {m.observacion && m.origen !== 'retiros' && m.origen !== 'ingresos' && (
                          <p className="mt-2"><strong>Observación:</strong> {m.observacion}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};