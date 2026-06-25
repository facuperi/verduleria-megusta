const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const AFIP_AUTH_URL = 'https://app.afipsdk.com/api/v1/afip/auth';
const AFIP_REQUEST_URL = 'https://app.afipsdk.com/api/v1/afip/requests';

const calcularIva = (total) => {
  const neto = Math.round(total / 1.105 * 100) / 100;
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
              Iva: { AlicIva: [{ Id: 4, BaseImp: neto, Importe: iva }] }
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
      iva,
      cbteTipo,
      docTipo,
      docNro
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
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }
    let uid;
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      uid = decoded.uid;
    } catch (e) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

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
        tipoFactura: ventaDoc.data().facturaTipo,
        cbteTipo: ventaDoc.data().facturaCbteTipo,
        docTipo: ventaDoc.data().facturaDocCliente ? 80 : 99,
        docNro: ventaDoc.data().facturaDocCliente ? parseInt(ventaDoc.data().facturaDocCliente) : 0
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
      iva: resultado.iva,
      cbteTipo: resultado.cbteTipo,
      docTipo: resultado.docTipo,
      docNro: resultado.docNro
    });

  } catch (error) {
    console.error('Error en facturación:', error);
    return res.status(500).json({ error: error.message });
  }
});

const { onCall, HttpsError } = require('firebase-functions/v2/https');

exports.crearUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
  }

  const callerUid = request.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().rol !== 'gerente') {
    throw new HttpsError('permission-denied', 'Solo gerentes pueden crear usuarios');
  }

  const { id, nombre, password, rol } = request.data;
  if (!id || !nombre || !password) {
    throw new HttpsError('invalid-argument', 'Faltan datos obligatorios');
  }

  const idNormalizado = id.toLowerCase().trim();
  const email = `${idNormalizado}@megusta.com`;

  const existingUsers = await admin.firestore()
    .collection('users')
    .where('id', '==', idNormalizado)
    .get();

  if (!existingUsers.empty) {
    throw new HttpsError('already-exists', 'Ya existe un usuario con ese ID');
  }

  let user;
  try {
    user = await admin.auth().createUser({ email, password, displayName: nombre });
  } catch (authErr) {
    if (authErr.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Ese ID ya está registrado en el sistema');
    }
    throw new HttpsError('internal', 'Error al crear el usuario: ' + authErr.message);
  }

  try {
    await admin.firestore().collection('users').doc(user.uid).set({
      id: idNormalizado,
      nombre,
      rol: rol || 'empleado',
      activo: true,
      creadoPor: callerUid,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (firestoreErr) {
    await admin.auth().deleteUser(user.uid);
    throw new HttpsError('internal', 'Error al guardar el usuario: ' + firestoreErr.message);
  }

  return { uid: user.uid };
});

exports.actualizarPassword = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
  }

  const callerUid = request.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().rol !== 'gerente') {
    throw new HttpsError('permission-denied', 'Solo gerentes pueden cambiar contraseñas');
  }

  const { uid, newPassword } = request.data;
  if (!uid || !newPassword) {
    throw new HttpsError('invalid-argument', 'Faltan datos obligatorios');
  }

  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres');
  }

  await admin.auth().updateUser(uid, { password: newPassword });

  return { success: true };
});

exports.eliminarUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
  }

  const callerUid = request.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().rol !== 'gerente') {
    throw new HttpsError('permission-denied', 'Solo gerentes pueden eliminar usuarios');
  }

  const { uid } = request.data;
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Falta el UID del usuario');
  }

  await admin.auth().deleteUser(uid);
  await admin.firestore().collection('users').doc(uid).delete();

  return { success: true };
});
