const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

const AFIP_AUTH_URL = 'https://app.afipsdk.com/api/v1/afip/auth';
const AFIP_REQUEST_URL = 'https://app.afipsdk.com/api/v1/afip/requests';

const calcularIva = (total) => {
  const neto = Math.round(total / 1.21 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
};

const getTokenAndSign = async () => {
  const cert = Buffer.from(process.env.AFIP_CERT, 'base64').toString('utf8');
  const key = Buffer.from(process.env.AFIP_KEY, 'base64').toString('utf8');

  const response = await fetch(AFIP_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AFIP_ACCESS_TOKEN.trim()}`
    },
    body: JSON.stringify({
      environment: 'prod',
      tax_id: process.env.AFIP_CUIT,
      wsid: 'wsfe',
      cert: cert,
      key: key
    })
  });

  const data = await response.json();
  if (data.error || !data.token) {
    throw new Error(`Error AFIP SDK: ${data.message || JSON.stringify(data)}`);
  }
  return { token: data.token, sign: data.sign };
};

const getLastVoucher = async (token, sign, cbteTipo) => {
  const response = await fetch(AFIP_REQUEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AFIP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      environment: 'prod',
      method: 'FECompUltimoAutorizado',
      wsid: 'wsfe',
      params: {
        Auth: { Token: token, Sign: sign, Cuit: process.env.AFIP_CUIT },
        PtoVta: parseInt(process.env.AFIP_PTO_VTA),
        CbteTipo: cbteTipo
      }
    })
  });
  const data = await response.json();
  return data.FECompUltimoAutorizadoResult?.CbteNro || 0;
};

const crearFacturaAfip = async (token, sign, numeroFactura, total, tipoFactura, documentoCliente) => {
  const { neto, iva } = calcularIva(total);
  const fechaStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

  let cbteTipo = tipoFactura === 'A' ? 1 : 6;
  let docTipo = tipoFactura === 'A' ? 80 : 99;
  let docNro = tipoFactura === 'A' ? parseInt(documentoCliente) : 0;
  let condicionIva = tipoFactura === 'A' ? 1 : 5;

  const response = await fetch(AFIP_REQUEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AFIP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      environment: 'prod',
      method: 'FECAESolicitar',
      wsid: 'wsfe',
      params: {
        Auth: { Token: token, Sign: sign, Cuit: process.env.AFIP_CUIT },
        FeCAEReq: {
          FeCabReq: { CantReg: 1, PtoVta: parseInt(process.env.AFIP_PTO_VTA), CbteTipo: cbteTipo },
          FeDetReq: {
            FECAEDetRequest: [{
              Concepto: 1,
              DocTipo: docTipo,
              DocNro: docNro,
              CbteDesde: numeroFactura,
              CbteHasta: numeroFactura,
              CbteFch: fechaStr,
              ImpTotal: total,
              ImpTotConc: 0,
              ImpNeto: neto,
              ImpOpEx: 0,
              ImpIVA: iva,
              ImpTrib: 0,
              MonId: 'PES',
              MonCotiz: 1,
              CondicionIVAReceptorId: condicionIva,
              Iva: { AlicIva: [{ Id: 5, BaseImp: neto, Importe: iva }] }
            }]
          }
        }
      }
    })
  });

  const data = await response.json();

  if (data.FECAESolicitarResult?.FeDetResp?.FECAEDetResponse?.[0]?.CAE) {
    return {
      cae: data.FECAESolicitarResult.FeDetResp.FECAEDetResponse[0].CAE,
      fechaVto: data.FECAESolicitarResult.FeDetResp.FECAEDetResponse[0].CAEFchVto,
      numero: numeroFactura,
      tipoFactura,
      neto,
      iva
    };
  }

  const errorMsg = data.FECAESolicitarResult?.Errors?.Err?.[0]?.Msg ||
                   data.FECAESolicitarResult?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs?.[0]?.Msg ||
                   'Error al crear factura';
  throw new Error(errorMsg);
};

exports.facturarVenta = functions.https.onRequest({
  secrets: ['AFIP_ACCESS_TOKEN', 'AFIP_CUIT', 'AFIP_PTO_VTA', 'AFIP_CERT', 'AFIP_KEY']
}, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { ventaId, total, tipoFactura, documentoCliente } = req.body;

    if (!ventaId || !total) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    if (!tipoFactura || !['A', 'B'].includes(tipoFactura)) {
      return res.status(400).json({ error: 'Tipo de factura inválido' });
    }

    if (tipoFactura === 'A' && (!documentoCliente || documentoCliente.length !== 11)) {
      return res.status(400).json({ error: 'Para Factura A se requiere CUIT de 11 dígitos' });
    }

    const db = admin.firestore();
    const ventaRef = db.collection('ventas').doc(ventaId);
    const ventaDoc = await ventaRef.get();

    if (ventaDoc.exists && ventaDoc.data().cae) {
      return res.json({
        yaFacturado: true,
        cae: ventaDoc.data().cae,
        numero: ventaDoc.data().facturaNumero,
        fechaVto: ventaDoc.data().facturaFechaVto,
        tipoFactura: ventaDoc.data().facturaTipo
      });
    }

    const { token, sign } = await getTokenAndSign();
    const cbteTipo = tipoFactura === 'A' ? 1 : 6;
    const ultimoNumero = await getLastVoucher(token, sign, cbteTipo);
    const nuevoNumero = ultimoNumero + 1;

    const resultado = await crearFacturaAfip(token, sign, nuevoNumero, parseFloat(total), tipoFactura, documentoCliente);

    await ventaRef.update({
      cae: resultado.cae,
      facturaNumero: resultado.numero,
      facturaFechaVto: resultado.fechaVto,
      facturaTipo: `Factura ${tipoFactura}`,
      facturaPtoVta: parseInt(process.env.AFIP_PTO_VTA),
      facturaCbteTipo: cbteTipo,
      facturaNeto: resultado.neto,
      facturaIva: resultado.iva,
      facturaDocCliente: documentoCliente || null,
      facturaFecha: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      cae: resultado.cae,
      numero: resultado.numero,
      fechaVto: resultado.fechaVto,
      tipoFactura: resultado.tipoFactura,
      neto: resultado.neto,
      iva: resultado.iva
    });

  } catch (error) {
    console.error('Error en facturación:', error);
    return res.status(500).json({ error: error.message });
  }
});
