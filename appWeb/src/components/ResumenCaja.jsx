import { formatNum } from '../utils/format';

export const ResumenCaja = ({ caja, ventasBrutas, notaCreditoTotal, notaCreditoDescuentoTotal, ventaNeta, efectivoCaja, ventasEfectivo, ventasTarjeta, ventasDebito, ventasMercadoPago, ventasCuentaDNI }) => {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
        <div className="bg-card p-3 rounded truncate">
          <p className="text-sm text-muted truncate">Saldo Apertura</p>
          <p className="font-semibold truncate">${formatNum(caja.saldoApertura)}</p>
        </div>
        <div className="bg-green-soft p-3 rounded truncate">
          <p className="text-sm text-muted truncate">Ventas Brutas</p>
          <p className="font-semibold text-green truncate">${formatNum(ventasBrutas)}</p>
        </div>
        <div className="bg-red-soft p-3 rounded truncate">
          <p className="text-sm text-muted truncate">Notas Crédito</p>
          <p className="font-semibold text-red truncate">-${formatNum(notaCreditoTotal)}</p>
        </div>
        <div className="bg-purple-soft p-3 rounded truncate">
          <p className="text-sm text-muted truncate">Venta Neta</p>
          <p className="font-semibold text-purple truncate">${formatNum(ventaNeta)}</p>
        </div>
        <div className="bg-yellow-soft p-3 rounded truncate">
          <p className="text-sm text-muted truncate">NC Redimidas</p>
          <p className="font-semibold text-yellow truncate">-${formatNum(notaCreditoDescuentoTotal)}</p>
        </div>
        <div className="bg-blue-soft p-3 rounded truncate">
          <p className="text-sm text-muted truncate">Efectivo en Caja</p>
          <p className="font-semibold text-blue truncate">${formatNum(efectivoCaja)}</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-soft rounded">
        <p className="text-sm font-semibold mb-2">Ventas por Método:</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="truncate">Efectivo: <span className="font-semibold">${formatNum(ventasEfectivo)}</span></p>
          <p className="truncate">Tarjeta: <span className="font-semibold">${formatNum(ventasTarjeta)}</span></p>
          <p className="truncate">Débito: <span className="font-semibold">${formatNum(ventasDebito)}</span></p>
          <p className="truncate">Mercado Pago: <span className="font-semibold">${formatNum(ventasMercadoPago)}</span></p>
          <p className="truncate">Cuenta DNI: <span className="font-semibold">${formatNum(ventasCuentaDNI)}</span></p>
        </div>
      </div>
    </>
  );
};