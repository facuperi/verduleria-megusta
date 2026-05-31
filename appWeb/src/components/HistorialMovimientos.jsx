export const HistorialMovimientos = ({ ventasHoy, retiros, isGerente, TIPOS_RETIRO_FIJOS, tiposRetiroPersonalizados, handleOpenEdit, handleEliminarVenta, ventasBrutas, notaCreditoTotal, efectivoCaja }) => {
  if (ventasHoy.length === 0) {
    return <EmptyState title="No hay movimientos aún" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Hora</th>
            <th className="text-left py-2">Tipo</th>
            <th className="text-left py-2">Monto</th>
            <th className="text-left py-2">Método</th>
            <th className="text-left py-2">Observación</th>
            {isGerente && <th className="text-right py-2 w-20">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {[...ventasHoy, ...retiros]
            .sort((a, b) => new Date(b.hora || b.fecha) - new Date(a.hora || a.fecha))
            .map((item) => {
              if (item.monto !== undefined && item.tipo) {
                const tipoRetiro = TIPOS_RETIRO_FIJOS.find(t => t.id === item.tipo) || tiposRetiroPersonalizados.find(t => t.id === item.tipo);
                return (
                  <tr key={item.id} className="border-b bg-orange-50">
                    <td className="py-2 whitespace-nowrap">
                      {item.hora ? new Date(item.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        💸 {tipoRetiro?.nombre || item.tipo}
                      </span>
                    </td>
                    <td className="py-2 font-bold text-red-700">
                      -${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 capitalize text-gray-600">-</td>
                    <td className="py-2 text-gray-500 max-w-xs truncate">{item.observacion || '-'}</td>
                    {isGerente && <td className="py-2"></td>}
                  </tr>
                );
              }

              const esNotaCredito = item.tipoVenta === 'notaCredito' || (item.tipoVenta === 'mixta' && item.diferencia < 0);
              const esMixta = item.tipoVenta === 'mixta';
              const montoMostrar = item.diferencia !== undefined
                ? (item.diferencia < 0 ? Math.abs(item.diferencia) : item.diferencia)
                : item.total;
              const tipoLabel = esNotaCredito
                ? (esMixta ? 'Mixta (NC)' : 'Nota Crédito')
                : (esMixta ? 'Mixta' : 'Venta');

              return (
                <tr key={item.id} className={`border-b ${esNotaCredito ? 'bg-red-50' : 'bg-green-50'}`}>
                  <td className="py-2 whitespace-nowrap">
                    {item.hora ? new Date(item.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      esNotaCredito ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {esNotaCredito ? '⬇️' : '⬆️'} {tipoLabel}
                    </span>
                  </td>
                  <td className={`py-2 font-bold ${esNotaCredito ? 'text-red-700' : 'text-green-700'}`}>
                    {esNotaCredito && <span className="text-red-500 mr-1">-</span>}
                    ${montoMostrar.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 capitalize text-gray-600">
                    {item.tipoPago?.map(p => {
                      const nombres = { efectivo: 'EF', tarjeta: 'TJ', debito: 'DB', mercadopago: 'MP', cuentadni: 'DNI' };
                      return nombres[p] || p;
                    }).join(', ') || '-'}
                  </td>
                  <td className="py-2 text-gray-500 max-w-xs truncate">{item.observacion || '-'}</td>
                  {isGerente && (
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="text-blue-600 hover:text-blue-800 mr-1 text-xs"
                        title="Editar"
                      >✏️</button>
                      <button
                        onClick={() => handleEliminarVenta(item)}
                        className="text-red-600 hover:text-red-800 text-xs"
                        title="Eliminar"
                      >🗑️</button>
                    </td>
                  )}
                </tr>
              );
            })}
        </tbody>
        <tfoot className="bg-gray-100 font-semibold">
          <tr>
            <td className="py-2 pl-2">TOTALES</td>
            <td className="py-2"></td>
            <td className="py-2">
              <span className="text-green-700">${ventasBrutas.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              <span className="text-red-600 ml-2">NC: -${notaCreditoTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              {retiros.length > 0 && (
                <span className="text-orange-600 ml-2">R: -${retiros.reduce((sum, r) => sum + r.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              )}
            </td>
            <td className="py-2 text-blue-700" colSpan={isGerente ? 3 : 2}>
              Efectivo: ${efectivoCaja.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};