export const ResumenReportes = ({ ventasNormales, notasCredito, retirosTotal, totalDescuentos, balance }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-green-900/20 p-4 rounded-lg border border-green-700/30">
        <p className="text-sm text-green-400">Ventas Normales</p>
        <p className="text-2xl font-bold text-green-400">${ventasNormales.toLocaleString('es-AR')}</p>
      </div>
      <div className="bg-red-900/20 p-4 rounded-lg border border-red-700/30">
        <p className="text-sm text-red-400">Notas de Crédito</p>
        <p className="text-2xl font-bold text-red-400">-${notasCredito.toLocaleString('es-AR')}</p>
      </div>
      <div className="bg-orange-900/20 p-4 rounded-lg border border-orange-700/30">
        <p className="text-sm text-orange-400">Retiros</p>
        <p className="text-2xl font-bold text-orange-400">-${retirosTotal.toLocaleString('es-AR')}</p>
      </div>
      {totalDescuentos > 0 && (
        <div className="bg-amber-900/20 p-4 rounded-lg border border-amber-700/30">
          <p className="text-sm text-amber-400">Descuentos</p>
          <p className="text-2xl font-bold text-amber-400">-${totalDescuentos.toLocaleString('es-AR')}</p>
        </div>
      )}
      <div className={`p-4 rounded-lg border ${balance >= 0 ? 'bg-blue-900/20 border-blue-700/30' : 'bg-gray-800 border-gray-700'}`}>
        <p className="text-sm text-gray-200">Balance Neto</p>
        <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-400' : 'text-gray-300'}`}>
          ${balance.toLocaleString('es-AR')}
        </p>
      </div>
    </div>
  );
};
