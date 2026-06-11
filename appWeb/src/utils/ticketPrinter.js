export const TELEFONO = '2915245537';

export const getDireccion = (sucursal) => {
  if (sucursal === 'chiclana') return 'Chiclana 115';
  if (sucursal === 'belgrano') return 'Belgrano 84';
  return sucursal;
};

export const getSucursalNombre = (sucursal) => {
  if (sucursal === 'chiclana') return 'CHICLANA';
  if (sucursal === 'belgrano') return 'BELGRANO';
  return (sucursal || '').toUpperCase();
};

export const imprimirTicketAFavor = (diferencia, caja, userEmail) => {
  const monto = Math.abs(diferencia);
  const fecha = new Date().toLocaleString('es-AR');
  const direccion = getDireccion(caja.sucursal);

  const ticket = `====================================
      SANTOS Y SANTAS
    ${direccion}
    Tel: ${TELEFONO}
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
          body { font-family: 'Courier New', monospace; font-size: 11px; font-weight: 600; white-space: pre; margin: 0; padding: 5px; }
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

export const imprimirTicketCajaCerrada = (caja) => {
  try {
    if (!caja || caja.estado !== 'cerrada') return;

    const formatMonto = (monto) => (monto || 0).toLocaleString('es-AR').padStart(8);
    const direccion = getDireccion(caja.sucursal);
    const sucursalNombre = getSucursalNombre(caja.sucursal);
    const fechaApertura = caja.fecha ? new Date(caja.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const fechaCierre = caja.horaCierre ? new Date(caja.horaCierre).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

    const ticket = `====================================
      SANTOS Y SANTAS
    ${direccion}
    Tel: ${TELEFONO}
===================================
     CIERRE DE CAJA
${fechaCierre}    ${sucursalNombre}
───────────────────────────────────
 APERTURA: ${fechaApertura}
 CIERRE:   ${fechaCierre}
───────────────────────────────────
  RESUMEN:
   Ventas Brutas:   $${formatMonto((caja.ventaNeta || 0) + (caja.totalDescuentos || 0) + (caja.notaCreditoTotal || 0))}
   Notas Credito:   -$${formatMonto(caja.notaCreditoTotal)}
   Descuentos:      -$${formatMonto(caja.totalDescuentos || 0)}
   VENTA NETA:      $${formatMonto(caja.ventaNeta)}
───────────────────────────────────
  GASTOS:
   Caja Roja:       -$${formatMonto(caja.gastosCajaRoja || 0)}
   Otros Gastos:    -$${formatMonto(caja.gastosOtros || 0)}
   Ingresos:        +$${formatMonto(caja.totalIngresos || 0)}
───────────────────────────────────
  X METODO DE PAGO:
  Efectivo:       $${formatMonto(caja.ventasEfectivo)}
  Tarjeta:        $${formatMonto(caja.ventasTarjeta)}
  Debito:         $${formatMonto(caja.ventasDebito)}
  MP Arista:      $${formatMonto(caja.ventasMPArista)}
  MP Yanet:       $${formatMonto(caja.ventasMPYanet)}
  Cuenta DNI:     $${formatMonto(caja.ventasCuentaDNI)}
───────────────────────────────────
  EFECTIVO CAJA ANTERIOR: $${formatMonto(caja.saldoAnterior || 0)}
  SALDO APERTURA: $${formatMonto(caja.saldoApertura)}
  SALDO CIERRE:   $${formatMonto(caja.saldoCierre)}
  SALDO SISTEMA:  $${formatMonto(caja.saldoSistema)}
───────────────────────────────────
  DIFERENCIA:     $${formatMonto(caja.diferencia)}
===================================
 FIRMA CAJERO:


───────────────────────────────────
 OBSERVACIONES: 



===================================`;

    const printWindow = window.open('', '_blank', 'width=300,height=700');
    if (!printWindow) {
      console.error('Popup bloqueado. Permití popups para este sitio.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Cierre de Caja</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 11px; font-weight: 600; white-space: pre; margin: 0; padding: 5px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${ticket}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  } catch (err) {
    console.error('Error al imprimir ticket de cierre:', err);
  }
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
    Tel: ${TELEFONO}
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

  if (ventaExitosa.notaCreditoDescuento) {
    ticket += `
 Nota Credito:   -$${ventaExitosa.notaCreditoDescuento.toLocaleString('es-AR').padStart(8)}`;
  }

  ticket += `
  PAGOS:`;
  if (ventaExitosa.pagos && ventaExitosa.pagos.length > 0) {
    for (const p of ventaExitosa.pagos) {
      const nombres = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', debito: 'Débito', mercadopago: 'MercadoPago', mercadopagoarista: 'MP Arista', mercadopagoyanet: 'MP Yanet', cuentadni: 'Cuenta DNI' };
      const nombre = (nombres[p.metodo] || p.metodo).padEnd(10);
      const montoReal = p.montoReal || 0;
      const desc = (p.monto || 0) - montoReal;
      if (desc > 0) {
        ticket += `
 ${nombre} $${montoReal.toLocaleString('es-AR').padStart(8)} (-${p.descuentoTipo === 'porcentaje' ? p.descuentoValor + '%' : '$' + p.descuentoValor.toLocaleString('es-AR')})`;
      } else {
        ticket += `
 ${nombre} $${(p.monto || 0).toLocaleString('es-AR').padStart(8)}`;
      }
    }
  } else {
    for (const metodo of ventaExitosa.tipoPago) {
      const nombres = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', debito: 'Débito', mercadopago: 'MercadoPago', mercadopagoarista: 'MP Arista', mercadopagoyanet: 'MP Yanet', cuentadni: 'Cuenta DNI' };
      ticket += `
 ${(nombres[metodo] || metodo).padEnd(10)}`;
    }
  }

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
          body { font-family: 'Courier New', monospace; font-size: 11px; font-weight: 600; white-space: pre; margin: 0; padding: 5px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>${ticket}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
};
