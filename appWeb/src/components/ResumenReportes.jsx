export const ResumenReportes = ({ ventasNormales, notasCredito, notaCreditoDescuento, retirosTotal, ingresosTotal, totalDescuentos, balance }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
      <div className="bg-green-soft p-4 rounded-lg border border-green-line">
        <p className="text-sm text-green">Ventas Normales</p>
        <p className="text-2xl font-bold text-green">${ventasNormales.toLocaleString('es-AR')}</p>
      </div>
      <div className="bg-red-soft p-4 rounded-lg border border-red-line">
        <p className="text-sm text-red">Notas de Crédito</p>
        <p className="text-2xl font-bold text-red">-${notasCredito.toLocaleString('es-AR')}</p>
      </div>
      <div className="bg-yellow-soft p-4 rounded-lg border border-yellow-line">
        <p className="text-sm text-yellow">NC Redimidas</p>
        <p className="text-2xl font-bold text-yellow">-${notaCreditoDescuento.toLocaleString('es-AR')}</p>
      </div>
      <div className="bg-orange-soft p-4 rounded-lg border border-orange-line">
        <p className="text-sm text-orange">Retiros</p>
        <p className="text-2xl font-bold text-orange">-${retirosTotal.toLocaleString('es-AR')}</p>
      </div>
      {ingresosTotal > 0 && (
        <div className="bg-green-soft p-4 rounded-lg border border-green-line">
          <p className="text-sm text-green">Ingresos</p>
          <p className="text-2xl font-bold text-green">+${ingresosTotal.toLocaleString('es-AR')}</p>
        </div>
      )}
      {totalDescuentos > 0 && (
        <div className="bg-amber-soft p-4 rounded-lg border border-amber-line">
          <p className="text-sm text-amber">Descuentos</p>
          <p className="text-2xl font-bold text-amber">-${totalDescuentos.toLocaleString('es-AR')}</p>
        </div>
      )}
      <div className={`p-4 rounded-lg border ${balance >= 0 ? 'bg-blue-soft border-blue-line' : 'bg-card border-line'}`}>
        <p className="text-sm text-secondary">Balance Neto</p>
        <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue' : 'text-secondary'}`}>
          ${balance.toLocaleString('es-AR')}
        </p>
      </div>
    </div>
  );
};
