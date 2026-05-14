const FIREBASE_FUNCTIONS_URL = 'https://us-central1-TU_PROYECTO.cloudfunctions.net/facturar';

export async function facturarVenta(ventaId, productos, total, negocio, tipoPago) {
  try {
    const response = await fetch(FIREBASE_FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ventaId,
        productos,
        total,
        negocio,
        tipoPago
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al facturar');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al facturar:', error);
    throw error;
  }
}

export function necesitaFactura(tipoPago) {
  const metodosAuto = ['tarjeta', 'debito', 'cuentadni'];
  return metodosAuto.some(m => tipoPago.includes(m));
}

export function puedeFacturarManual(tipoPago) {
  return true;
}

export function calcularIva(total) {
  const neto = Math.round(total / 1.21 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
}