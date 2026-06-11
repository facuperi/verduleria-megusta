export const ResumenCaja = ({ caja, ventasBrutas, notaCreditoTotal, notaCreditoDescuentoTotal, ventaNeta, efectivoCaja, ventasEfectivo, ventasTarjeta, ventasDebito, ventasMPArista, ventasMPYanet, ventasCuentaDNI }) => {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
        <div className="bg-card p-3 rounded">
          <p className="text-sm text-muted">Saldo Apertura</p>
          <p className="font-semibold">${caja.saldoApertura}</p>
        </div>
        <div className="bg-green-soft p-3 rounded">
          <p className="text-sm text-muted">Ventas Brutas</p>
          <p className="font-semibold text-green">${ventasBrutas}</p>
        </div>
        <div className="bg-red-soft p-3 rounded">
          <p className="text-sm text-muted">Notas Crédito</p>
          <p className="font-semibold text-red">-${notaCreditoTotal}</p>
        </div>
        <div className="bg-purple-soft p-3 rounded">
          <p className="text-sm text-muted">Venta Neta</p>
          <p className="font-semibold text-purple">${ventaNeta}</p>
        </div>
        <div className="bg-yellow-soft p-3 rounded">
          <p className="text-sm text-muted">NC Redimidas</p>
          <p className="font-semibold text-yellow">-${notaCreditoDescuentoTotal}</p>
        </div>
        <div className="bg-blue-soft p-3 rounded">
          <p className="text-sm text-muted">Efectivo en Caja</p>
          <p className="font-semibold text-blue">${efectivoCaja}</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-soft rounded">
        <p className="text-sm font-semibold mb-2">Ventas por Método:</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>Efectivo: <span className="font-semibold">${ventasEfectivo}</span></p>
          <p>Tarjeta: <span className="font-semibold">${ventasTarjeta}</span></p>
          <p>Débito: <span className="font-semibold">${ventasDebito}</span></p>
            <p>MP Arista: <span className="font-semibold">${ventasMPArista}</span></p>
            <p>MP Yanet: <span className="font-semibold">${ventasMPYanet}</span></p>
          <p>Cuenta DNI: <span className="font-semibold">${ventasCuentaDNI}</span></p>
        </div>
      </div>
    </>
  );
};