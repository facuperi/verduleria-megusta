export const ResumenCaja = ({ caja, ventasBrutas, notaCreditoTotal, ventaNeta, efectivoCaja, ventasEfectivo, ventasTarjeta, ventasDebito, ventasMercadoPago, ventasCuentaDNI }) => {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-500">Saldo Apertura</p>
          <p className="font-semibold">${caja.saldoApertura}</p>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <p className="text-sm text-gray-500">Ventas Brutas</p>
          <p className="font-semibold text-green-600">${ventasBrutas}</p>
        </div>
        <div className="bg-red-50 p-3 rounded">
          <p className="text-sm text-gray-500">Notas Crédito</p>
          <p className="font-semibold text-red-600">-${notaCreditoTotal}</p>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <p className="text-sm text-gray-500">Venta Neta</p>
          <p className="font-semibold text-purple-600">${ventaNeta}</p>
        </div>
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-sm text-gray-500">Efectivo en Caja</p>
          <p className="font-semibold text-blue-600">${efectivoCaja}</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded">
        <p className="text-sm font-semibold mb-2">Ventas por Método:</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>Efectivo: <span className="font-semibold">${ventasEfectivo}</span></p>
          <p>Tarjeta: <span className="font-semibold">${ventasTarjeta}</span></p>
          <p>Débito: <span className="font-semibold">${ventasDebito}</span></p>
          <p>MercadoPago: <span className="font-semibold">${ventasMercadoPago}</span></p>
          <p>Cuenta DNI: <span className="font-semibold">${ventasCuentaDNI}</span></p>
        </div>
      </div>
    </>
  );
};