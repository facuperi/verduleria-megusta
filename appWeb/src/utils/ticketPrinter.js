const getDireccion = (sucursal) => {
  if (sucursal === 'chiclana') return 'Chiclana 115';
  if (sucursal === 'belgrano') return 'Belgrano 84';
  return sucursal;
};

export const imprimirTicketAFavor = (diferencia, caja, userEmail) => {
  const monto = Math.abs(diferencia);
  const fecha = new Date().toLocaleString('es-AR');
  const direccion = getDireccion(caja.sucursal);

  const ticket = `====================================
      SANTOS Y SANTAS
    ${direccion}
    Tel: 2915245537
==================================
${fecha}
───────────────────────────────────
    NOTA DE CREDITO A FAVOR
───────────────────────────────────
  MONTO A FAVOR: $${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
───────────────────────────────────
  Este ticket acredita que el
  cliente tiene saldo a favor
  de $${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
───────────────────────────────────
  Negocio: ${(caja.sucursal || '').toUpperCase()}
  Atendido por: ${userEmail || 'Usuario'}
===================================
      Gracias por su compra!
         Vuelve pronto :)
==================================`;

  const printWindow = window.open('', '_blank', 'width=300,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Nota de Crédito</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 11px; white-space: pre; margin: 0; padding: 5px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>${ticket}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
};

const calcularIva = (total) => {
  const neto = Math.round(total / 1.21 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
};

export const imprimirTicketVenta = (ventaExitosa, caja, facturaData) => {
  if (!ventaExitosa || !caja) return;

  const fecha = new Date().toLocaleString('es-AR');
  const direccion = getDireccion(caja.sucursal);
  const ventaId = ventaExitosa.id.slice(-6).toUpperCase();
  const { neto, iva } = calcularIva(ventaExitosa.total);

  let ticket = `====================================
      SANTOS Y SANTAS
    ${direccion}
    Tel: 2915245537
===================================
${fecha}    Vta: ${ventaId}
───────────────────────────────────
PRODUCTO              CANT    IMP
───────────────────────────────────`;

  const ventasNormales = ventaExitosa.productos.filter(p => !p.esNotaCredito);
  const notasCredito = ventaExitosa.productos.filter(p => p.esNotaCredito);

  for (const item of ventasNormales) {
    const nombre = item.nombre.length > 18 ? item.nombre.substring(0, 16) + '..' : item.nombre.padEnd(18);
    const importe = (item.precio * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 });
    ticket += `
${nombre} ${item.cantidad.toString().padStart(3)}  ${importe.padStart(5)}`;
  }

  if (ventasNormales.length > 0) {
    ticket += `
───────────────────────────────────`;
  }

  if (notasCredito.length > 0) {
    ticket += `
NOTA CRÉDITO:`;
    for (const item of notasCredito) {
      const nombre = item.nombre.length > 18 ? item.nombre.substring(0, 16) + '..' : item.nombre.padEnd(18);
      const importe = (item.precio * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 });
      ticket += `
${nombre} ${item.cantidad.toString().padStart(3)} -${importe.padStart(5)}`;
    }
  }

  const totalFormateado = ventaExitosa.total.toLocaleString('es-AR', { minimumFractionDigits: 0 });
  const netoFormateado = neto.toLocaleString('es-AR', { minimumFractionDigits: 0 });
  const ivaFormateado = iva.toLocaleString('es-AR', { minimumFractionDigits: 0 });

  ticket += `
───────────────────────────────────
Subtotal (neto):      $${netoFormateado.padStart(8)}
IVA 21%:              $${ivaFormateado.padStart(8)}
───────────────────────────────────
TOTAL:                $${totalFormateado.padStart(8)}
───────────────────────────────────`;

  const metodosPago = ventaExitosa.tipoPago.map(p => {
    const nombres = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', debito: 'Débito', mercadopago: 'MercadoPago', cuentadni: 'Cuenta DNI' };
    return nombres[p] || p;
  }).join(', ');

  ticket += `
PAGO: ${metodosPago}`;

  if (facturaData) {
    const ptoVta = '00009';
    const nroFactura = String(facturaData.numero).padStart(8, '0');
    const fechaVto = facturaData.fechaVto ? `${facturaData.fechaVto.slice(6,8)}/${facturaData.fechaVto.slice(4,6)}/${facturaData.fechaVto.slice(0,4)}` : '-';
    const tipoFacturaLabel = facturaData.tipoFactura === 'A' ? 'FACTURA A' : 'FACTURA B';
    ticket += `
───────────────────────────────────
         ${tipoFacturaLabel}
 CAE: ${facturaData.cae}
 Vto: ${fechaVto}
 N°: ${ptoVta}-${nroFactura}`;
  }

  ticket += `
====================================
     Gracias por su compra!
        Vuelve pronto :)
====================================`;

  const printWindow = window.open('', '_blank', 'width=300,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Ticket de Venta</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 11px; white-space: pre; margin: 0; padding: 5px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>${ticket}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
};
