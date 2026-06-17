import { EmptyState } from './EmptyState';

export const HistorialMovimientos = ({ ventasHoy, retiros, ingresos, isGerente, TIPOS_RETIRO_FIJOS, tiposRetiroPersonalizados, TIPOS_INGRESO_FIJOS, tiposIngresoPersonalizados, handleOpenEdit, handleEliminarVenta, ventasBrutas, notaCreditoTotal, efectivoCaja }) => {
  if (ventasHoy.length === 0 && retiros.length === 0 && ingresos.length === 0) {
    return <EmptyState title="No hay movimientos aún" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="text-left py-2">Hora</th>
            <th className="text-left py-2">Tipo</th>
            <th className="text-left py-2">Monto</th>
            <th className="text-left py-2">Método</th>
            <th className="text-left py-2">Observación</th>
            {isGerente && <th className="text-right py-2 w-20">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {[...ventasHoy, ...retiros, ...ingresos]
            .sort((a, b) => new Date(b.hora || b.fecha) - new Date(a.hora || a.fecha))
            .map((item) => {
              if (item.monto !== undefined && item.tipo && !item.esIngreso) {
                const tipoRetiro = TIPOS_RETIRO_FIJOS.find(t => t.id === item.tipo) || tiposRetiroPersonalizados.find(t => t.id === item.tipo);
                return (
                  <tr key={item.id} className="border-b border-line bg-orange-soft">
                    <td className="py-2 whitespace-nowrap text-body">
                      {item.hora ? new Date(item.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-soft text-orange">
                        💸 {tipoRetiro?.nombre || item.tipo}
                      </span>
                    </td>
                    <td className="py-2 font-bold text-red">
                      -${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 capitalize text-secondary">-</td>
                    <td className="py-2 text-muted max-w-xs truncate">{item.observacion || '-'}</td>
                    {isGerente && <td className="py-2"></td>}
                  </tr>
                );
              }

              if (item.monto !== undefined && item.tipo && item.esIngreso) {
                const tipoIngreso = TIPOS_INGRESO_FIJOS.find(t => t.id === item.tipo) || tiposIngresoPersonalizados.find(t => t.id === item.tipo);
                return (
                  <tr key={item.id} className="border-b border-line bg-green-soft">
                    <td className="py-2 whitespace-nowrap text-body">
                      {item.hora ? new Date(item.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-soft text-green">
                        🟢 {tipoIngreso?.nombre || item.tipo}
                      </span>
                    </td>
                    <td className="py-2 font-bold text-green">
                      +${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 capitalize text-secondary">-</td>
                    <td className="py-2 text-muted max-w-xs truncate">{item.observacion || '-'}</td>
                    {isGerente && <td className="py-2"></td>}
                  </tr>
                );
              }

              const esNotaCredito = item.tipoVenta === 'notaCredito' || (item.tipoVenta === 'mixta' && item.diferencia < 0);
              const esMixta = item.tipoVenta === 'mixta';
              const montoMostrar = item.total !== undefined
                ? item.total
                : (item.diferencia !== undefined ? Math.abs(item.diferencia) : 0);
              const tipoLabel = esNotaCredito
                ? (esMixta ? 'Mixta (NC)' : 'Nota Crédito')
                : (esMixta ? 'Mixta' : 'Venta');

              return (
                <tr key={item.id} className={`border-b border-line ${esNotaCredito ? 'bg-red-soft' : 'bg-green-soft'}`}>
                  <td className="py-2 whitespace-nowrap">
                    {item.hora ? new Date(item.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      esNotaCredito ? 'bg-red-soft text-red' : 'bg-green-soft text-green'
                    }`}>
                      {esNotaCredito ? '⬇️' : '⬆️'} {tipoLabel}
                    </span>
                  </td>
                  <td className={`py-2 font-bold ${esNotaCredito ? 'text-red' : 'text-green'}`}>
                    {esNotaCredito && <span className="text-red mr-1">-</span>}
                    ${montoMostrar.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 text-secondary">
                    {item.tipoPago?.map(p => {
                      const nombres = { efectivo: 'EF', tarjeta: 'TJ', debito: 'DB', mercadopago: 'MP', cuentadni: 'DNI' };
                      return nombres[p] || p;
                    }).join(', ') || '-'}
                    {(() => {
                      const base = item.diferencia > 0 ? item.diferencia : item.total || 0;
                      const descTotal = item.pagos?.reduce((s, pg) => {
                        if (!pg.descuentoTipo || !pg.descuentoValor) return s;
                        return s + (pg.descuentoTipo === 'porcentaje' ? base * pg.descuentoValor / 100 : pg.descuentoValor);
                      }, 0) || 0;
                      const parts = [];
                      if (descTotal > 0) parts.push(`Desc: -${descTotal.toLocaleString('es-AR')}`);
                      if (item.notaCreditoDescuento) parts.push(`NC: -${item.notaCreditoDescuento.toLocaleString('es-AR')}`);
                      if (item.tipoDescuento) parts.push(`[${item.tipoDescuento}]`);
                      return parts.length > 0 ? <span className="text-green text-xs ml-1">({parts.join(' ')})</span> : null;
                    })()}
                  </td>
                  <td className="py-2 text-muted max-w-xs truncate">{item.observacion || '-'}</td>
                  {isGerente && (
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="text-blue hover:text-blue mr-1 text-xs"
                        title="Editar"
                      >✏️</button>
                      <button
                        onClick={() => handleEliminarVenta(item)}
                        className="text-red hover:text-red text-xs"
                        title="Eliminar"
                      >🗑️</button>
                    </td>
                  )}
                </tr>
              );
            })}
        </tbody>
        <tfoot className="bg-table-header font-semibold">
          <tr>
            <td className="py-2 pl-2">TOTALES</td>
            <td className="py-2"></td>
            <td className="py-2">
              <span className="text-green">${ventasBrutas.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              <span className="text-red ml-2">NC: -${notaCreditoTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              {retiros.length > 0 && (
                <span className="text-orange ml-2">R: -${retiros.reduce((sum, r) => sum + r.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              )}
              {ingresos.length > 0 && (
                <span className="text-green ml-2">I: +${ingresos.reduce((sum, r) => sum + r.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              )}
            </td>
            <td className="py-2 text-blue" colSpan={isGerente ? 3 : 2}>
              Efectivo: ${efectivoCaja.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};