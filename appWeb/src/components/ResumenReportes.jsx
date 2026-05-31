export const ResumenReportes = ({ ventasNormales, notasCredito, retirosTotal, totalDescuentos, balance }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <p className="text-sm text-green-700">Ventas Normales</p>
        <p className="text-2xl font-bold text-green-600">${ventasNormales.toLocaleString('es-AR')}</p>
      </div>
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <p className="text-sm text-red-700">Notas de Crédito</p>
        <p className="text-2xl font-bold text-red-600">-${notasCredito.toLocaleString('es-AR')}</p>
      </div>
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
        <p className="text-sm text-orange-700">Retiros</p>
        <p className="text-2xl font-bold text-orange-600">-${retirosTotal.toLocaleString('es-AR')}</p>
      </div>
      {totalDescuentos > 0 && (
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-700">Descuentos</p>
          <p className="text-2xl font-bold text-amber-600">-${totalDescuentos.toLocaleString('es-AR')}</p>
        </div>
      )}
      <div className={`p-4 rounded-lg border ${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
        <p className="text-sm text-gray-700">Balance Neto</p>
        <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
          ${balance.toLocaleString('es-AR')}
        </p>
      </div>
    </div>
  );
};
