import React from 'react';

const TIPOS_RETIRO_FIJOS = [
  { id: 'cajaRoja', nombre: 'Caja roja', icono: '💰' },
  { id: 'gasto', nombre: 'Gasto', icono: '🧹' },
  { id: 'retiroCaro', nombre: 'Retiro Caro', icono: '👔' },
  { id: 'retiroFede', nombre: 'Retiro Fede', icono: '👔' },
  { id: 'errorMP', nombre: 'Error MP', icono: '⚠️' },
  { id: 'errorDNI', nombre: 'Error DNI', icono: '⚠️' },
  { id: 'errorTJ', nombre: 'Error TJ', icono: '⚠️' },
];

export const TablaReportes = ({ movimientosFiltrados, filasExpandidas, toggleFila, tiposRetiroPersonalizados, onReimprimirTicket }) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
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
                monto = m.diferencia > 0 ? m.diferencia : m.total;
                colorFila = esNotaCredito ? 'bg-red-50' : 'bg-green-50';
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
                colorFila = 'bg-orange-50';
              } else {
                tipo = m.estado === 'abierta' ? 'Apertura' : 'Cierre';
                detalle = `Saldo: $${m.saldoApertura || m.saldoCierre || 0}`;
                monto = m.estado === 'cerrada' ? (m.saldoCierre || 0) : (m.saldoApertura || 0);
                colorFila = 'bg-blue-50';
              }

              const fecha = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha || m.hora);

              return (
                <React.Fragment key={m.id}>
                <tr
                  className={`border-t ${colorFila} cursor-pointer hover:opacity-90`}
                  onClick={() => toggleFila(m.id)}
                >
                  <td className="px-4 py-2">
                    <button className="text-gray-500 hover:text-gray-700 mr-2">
                      {filasExpandidas[m.id] ? '▼' : '▶'}
                    </button>
                    {fecha.toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-2">{fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-2">{tipo}</td>
                  <td className="px-4 py-2 capitalize">{m.negocio || m.sucursal || '-'}</td>
                  <td className="px-4 py-2 max-w-xs truncate" title={detalle}>{detalle}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(monto).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-2">{m.tipoPago?.join(', ') || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{m.usuarioNombre || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    {m.origen === 'caja' && m.estado === 'cerrada' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onReimprimirTicket(m); }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="Reimprimir ticket de cierre"
                      >🧾</button>
                    )}
                  </td>
                </tr>
                {filasExpandidas[m.id] && (
                  <tr key={`${m.id}-detalle`} className="border-t bg-gray-50">
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
                                <tr key={idx} className="border-b">
                                  <td className="py-1">{p.nombre}</td>
                                  <td className="py-1">{p.cantidad}</td>
                                  <td className="py-1">${p.precio}</td>
                                  <td className="py-1">${(p.precio * p.cantidad).toLocaleString('es-AR')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {m.origen === 'retiros' && (
                          <p><strong>Tipo:</strong> {m.tipo} | <strong>Monto:</strong> ${m.monto} | <strong>Obs:</strong> {m.observacion || '-'}</p>
                        )}
                        {m.origen === 'caja' && (
                          <p>
                            <strong>Saldo Apertura:</strong> ${m.saldoApertura || 0} |
                            <strong> Saldo Cierre:</strong> ${m.saldoCierre || 0} |
                            <strong> Estado:</strong> {m.estado}
                          </p>
                        )}
                        {m.observacion && m.origen !== 'retiros' && (
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