import QRCode from 'qrcode'
import {
  COMERCIO_NOMBRE,
  COMERCIO_CUIT,
  COMERCIO_CUIT_SIN_GUIONES,
  COMERCIO_ING_BRUTOS,
  COMERCIO_DIRECCION,
  COMERCIO_TELEFONO,
  AFIP_QR_BASE_URL
} from './constants'

export const TELEFONO = COMERCIO_TELEFONO

export const getDireccion = () => COMERCIO_DIRECCION

export const getSucursalNombre = () => ''

const normalizarTipoFactura = (tipo) => {
  if (tipo === 'Factura A' || tipo === 'A') return 'A'
  if (tipo === 'Factura B' || tipo === 'B') return 'B'
  return 'B'
}

const generarQrUrl = (facturaData, total) => {
  const tipo = normalizarTipoFactura(facturaData.tipoFactura)
  const cbteTipo = facturaData.cbteTipo || (tipo === 'A' ? 1 : 6)
  const docTipo = facturaData.docTipo || (tipo === 'A' ? 80 : 99)
  const docNro = facturaData.docNro || 0

  const fecha = new Date().toISOString().split('T')[0]
  const ptoVta = parseInt(import.meta.env.VITE_AFIP_PTO_VTA) || 9

  const payload = {
    ver: 1,
    fecha,
    cuit: parseInt(COMERCIO_CUIT_SIN_GUIONES),
    ptoVta,
    tipoCmp: cbteTipo,
    nroCmp: facturaData.numero,
    importe: total,
    moneda: 'ARS',
    ctz: 1,
    tipoDocRec: docTipo,
    nroDocRec: docNro,
    tipoCodAut: 'E',
    codAut: parseInt(facturaData.cae)
  }

  const json = JSON.stringify(payload)
  const base64 = btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${AFIP_QR_BASE_URL}?p=${base64}`
}

const getQrAscii = async (url) => {
  try {
    return await QRCode.toString(url, { type: 'utf8', small: true })
  } catch {
    return ''
  }
}

export const imprimirTicketAFavor = (diferencia, caja, userEmail) => {
  const monto = Math.abs(diferencia);
  const fecha = new Date().toLocaleString('es-AR');
  const direccion = getDireccion();

  const ticket = `====================================
       ME GUSTA
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
  const neto = Math.round(total / 1.105 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
};

export const imprimirTicketCajaCerrada = (caja) => {
  try {
    if (!caja || caja.estado !== 'cerrada') return;

    const formatMonto = (monto) => (monto || 0).toLocaleString('es-AR').padStart(8);
  const direccion = getDireccion();
    const fechaApertura = caja.fecha ? new Date(caja.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const fechaCierre = caja.horaCierre ? new Date(caja.horaCierre).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

    const ticket = `====================================
       ME GUSTA
    ${direccion}
    Tel: ${TELEFONO}
===================================
     CIERRE DE CAJA
                ${fechaCierre}
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
  Mercado Pago:   $${formatMonto(caja.ventasMercadoPago)}
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

export const imprimirTicketVenta = async (ventaExitosa, caja, facturaData) => {
  if (!ventaExitosa || !caja) return;

  const fecha = new Date().toLocaleString('es-AR');
  const direccion = getDireccion();
  const ventaId = ventaExitosa.id.slice(-6).toUpperCase();
  const subtotal = ventaExitosa.subtotal || ventaExitosa.total;
  const { neto, iva } = calcularIva(subtotal);

  let ticket = `====================================
      ME GUSTA
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
    if (item.esFrutasVerduras) {
      const nombre = 'Frutas y Verduras'.padEnd(18);
      const importe = (item.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 });
      ticket += `
${nombre}  1   ${importe.padStart(5)}`;
      continue;
    }
    const nombre = item.nombre.length > 18 ? item.nombre.substring(0, 16) + '..' : item.nombre.padEnd(18);
    const importe = item.peso
      ? (item.precio * item.peso).toLocaleString('es-AR', { minimumFractionDigits: 0 })
      : (item.precio * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 });
    const cantDisplay = item.peso ? `${(item.peso).toFixed(3)}kg` : item.cantidad.toString().padStart(3);
    ticket += `
${nombre} ${cantDisplay.padStart(7)}  ${importe.padStart(5)}`;
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
  const tieneDeuda = ventaExitosa.pagos?.some(p => p.metodo === 'deuda');
  const esSoloEfectivo = (ventaExitosa.tipoPago?.every(m => m === 'efectivo'))
    && !tieneDeuda;

  const descuentoTotal = subtotal - ventaExitosa.total;
  const descuentoPagos = descuentoTotal - (ventaExitosa.notaCreditoDescuento || 0);

  if (facturaData) {
    ticket += `
───────────────────────────────────
TRANSPARENCIA FISCAL
${COMERCIO_NOMBRE}
CUIT: ${COMERCIO_CUIT}
Ing. Brutos: ${COMERCIO_ING_BRUTOS}
${COMERCIO_DIRECCION}
───────────────────────────────────`;
  }

  if (!esSoloEfectivo) {
    ticket += `
Subtotal (neto):      $${netoFormateado.padStart(8)}
IVA 10.5%:            $${ivaFormateado.padStart(8)}`;
  } else {
    ticket += `
Subtotal:             $${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 0 }).padStart(8)}`;
  }

  if (descuentoPagos > 0) {
    ticket += `
Descuento:           -$${descuentoPagos.toLocaleString('es-AR', { minimumFractionDigits: 0 }).padStart(8)}`;
  }

  if (ventaExitosa.notaCreditoDescuento) {
    ticket += `
Nota Crédito:        -$${ventaExitosa.notaCreditoDescuento.toLocaleString('es-AR', { minimumFractionDigits: 0 }).padStart(8)}`;
  }

  ticket += `
───────────────────────────────────
TOTAL:                $${totalFormateado.padStart(8)}
───────────────────────────────────`;

  ticket += `
  PAGOS:`;
  if (ventaExitosa.pagos && ventaExitosa.pagos.length > 0) {
    for (const p of ventaExitosa.pagos) {
      const nombres = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', debito: 'Débito', mercadopago: 'MercadoPago', cuentadni: 'Cuenta DNI' };
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
      const nombres = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', debito: 'Débito', mercadopago: 'MercadoPago', cuentadni: 'Cuenta DNI' };
      ticket += `
 ${(nombres[metodo] || metodo).padEnd(10)}`;
    }
  }

  if (facturaData) {
    const ptoVta = String(parseInt(import.meta.env.VITE_AFIP_PTO_VTA) || 9).padStart(5, '0');
    const nroFactura = String(facturaData.numero).padStart(8, '0');
    const fechaVto = facturaData.fechaVto ? `${facturaData.fechaVto.slice(6,8)}/${facturaData.fechaVto.slice(4,6)}/${facturaData.fechaVto.slice(0,4)}` : '-';
    const tipo = normalizarTipoFactura(facturaData.tipoFactura);
    const tipoFacturaLabel = tipo === 'A' ? 'FACTURA A' : 'FACTURA B';
    ticket += `
───────────────────────────────────
         ${tipoFacturaLabel}
 CAE: ${facturaData.cae}
 Vto: ${fechaVto}
 N°: ${ptoVta}-${nroFactura}`;

    const qrUrl = generarQrUrl(facturaData, ventaExitosa.total);
    const qrAscii = await getQrAscii(qrUrl);
    if (qrAscii) {
      ticket += `
───────────────────────────────────
${qrAscii}
ORIENTACION AL CONSUMIDOR DE
PROVINCIA DE BUENOS AIRES
MUCHAS GRACIAS POR SU COMPRA`;
    }
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
