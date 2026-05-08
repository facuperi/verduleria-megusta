import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

const NEGOCIOS = [
  { id: 'chiclana', nombre: 'Chiclana' },
  { id: 'belgrano', nombre: 'Belgrano' },
];

const TIPOS_RETIRO_FIJOS = [
  { id: 'cajaRoja', nombre: 'Caja roja', icono: '💰' },
  { id: 'gasto', nombre: 'Gasto', icono: '🧹' },
  { id: 'retiroCaro', nombre: 'Retiro Caro', icono: '👔' },
  { id: 'retiroFede', nombre: 'Retiro Fede', icono: '👔' },
  { id: 'errorMP', nombre: 'Error MP', icono: '⚠️' },
  { id: 'errorDNI', nombre: 'Error DNI', icono: '⚠️' },
  { id: 'errorTJ', nombre: 'Error TJ', icono: '⚠️' },
];

export const CajaPage = () => {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [caja, setCaja] = useState(null);
  const [ventasHoy, setVentasHoy] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  
  // Modal de retiro
  const [mostrarModalRetiro, setMostrarModalRetiro] = useState(false);
  const [tipoRetiro, setTipoRetiro] = useState('');
  const [montoRetiro, setMontoRetiro] = useState('');
  const [observacionRetiro, setObservacionRetiro] = useState('');
  
  // Tipos de retiro personalizados
  const [tiposRetiroPersonalizados, setTiposRetiroPersonalizados] = useState([]);
  
  // Modal para crear tipo de retiro
  const [mostrarModalNuevoTipo, setMostrarModalNuevoTipo] = useState(false);
  const [nombreNuevoTipo, setNombreNuevoTipo] = useState('');
  const [iconoNuevoTipo, setIconoNuevoTipo] = useState('💰');
  
  // Campos del formulario
  const [negocioSeleccionado, setNegocioSeleccionado] = useState('');
  const [saldoApertura, setSaldoApertura] = useState('');
  const [saldoCierre, setSaldoCierre] = useState('');

  const restriction = checkDeviceRestriction('aperturaCaja');
  const canAccess = !isMobile;

  useEffect(() => {
    const fetchCaja = async () => {
      try {
        const cajaQuery = query(
          collection(db, 'caja'),
          where('estado', '==', 'abierta')
        );
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          const cajaData = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
          setCaja(cajaData);
          setNegocioSeleccionado(cajaData.sucursal);
          
          // Traer ventas de hoy para esta caja
          const ventasSnapshot = await getDocs(collection(db, 'ventas'));
          const fechaApertura = cajaData.fecha?.toDate ? cajaData.fecha.toDate() : new Date(cajaData.fecha);
          const ventasDelTurno = ventasSnapshot.docs
            .filter(d => {
              const fechaVenta = d.data().fecha?.toDate ? d.data().fecha.toDate() : new Date(d.data().fecha);
              return fechaVenta >= fechaApertura && d.data().negocio === cajaData.sucursal;
            })
            .map(d => ({ id: d.id, ...d.data() }));
          setVentasHoy(ventasDelTurno);
          
          // Traer retiros de esta caja
          const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
          const retirosDelTurno = retirosSnapshot.docs
            .filter(d => d.data().cajaId === cajaData.id)
            .map(d => ({ id: d.id, ...d.data() }));
          setRetiros(retirosDelTurno);
          
          // Traer tipos de retiro personalizados
          const tiposSnapshot = await getDocs(collection(db, 'tiposRetiro'));
          const tiposPersonalizados = tiposSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setTiposRetiroPersonalizados(tiposPersonalizados);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCaja();
  }, []);

  const abrirCaja = async () => {
    if (!negocioSeleccionado) {
      alert('Seleccioná un negocio');
      return;
    }
    setProcesando(true);
    try {
      const ahora = new Date();
      const docRef = await addDoc(collection(db, 'caja'), {
        estado: 'abierta',
        sucursal: negocioSeleccionado,
        saldoApertura: parseFloat(saldoApertura) || 0,
        montoEfectivo: parseFloat(saldoApertura) || 0,
        abiertoPor: user.uid,
        abiertoPorNombre: user.email || 'Usuario',
        fecha: ahora.toISOString(),
        hora: ahora.toISOString(),
        ventasEfectivo: 0,
        ventasTarjeta: 0,
        ventasDebito: 0,
        ventasMercadoPago: 0,
        ventasCuentaDNI: 0,
      });
      setCaja({ 
        id: docRef.id, 
        estado: 'abierta', 
        sucursal: negocioSeleccionado,
        saldoApertura: parseFloat(saldoApertura) || 0,
        montoEfectivo: parseFloat(saldoApertura) || 0,
      });
      setSaldoApertura('');
    } catch (err) {
      console.error(err);
      alert('Error al abrir caja');
    } finally {
      setProcesando(false);
    }
  };

  const calcularVentas = () => {
    const ventasNormales = ventasHoy.filter(v => v.tipoVenta === 'normal' || v.tipoVenta === 'mixta');
    const notasCredito = ventasHoy.filter(v => v.tipoVenta === 'notaCredito' || (v.tipoVenta === 'mixta' && v.diferencia < 0));
    
    const montoVentasNormales = ventasNormales.reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
    const montoNotasCredito = notasCredito.reduce((sum, v) => sum + Math.abs(v.diferencia || v.total), 0);
    
    const ventasEfectivo = ventasNormales
      .filter(v => v.tipoPago?.includes('efectivo'))
      .reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
    
    const ventasTarjeta = ventasNormales
      .filter(v => v.tipoPago?.includes('tarjeta'))
      .reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
    
    const ventasDebito = ventasNormales
      .filter(v => v.tipoPago?.includes('debito'))
      .reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
    
    const ventasMercadoPago = ventasNormales
      .filter(v => v.tipoPago?.includes('mercadopago'))
      .reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
    
    const ventasCuentaDNI = ventasNormales
      .filter(v => v.tipoPago?.includes('cuentadni'))
      .reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
    
    const notasCreditoEfectivo = notasCredito.reduce((sum, v) => sum + Math.abs(v.diferencia || v.total), 0);
    const totalRetiros = retiros.reduce((sum, r) => sum + r.monto, 0);
    
    const ventasBrutas = montoVentasNormales;
    const notaCreditoTotal = montoNotasCredito;
    const ventaNeta = ventasBrutas - notaCreditoTotal;
    const efectivoCaja = (caja?.saldoApertura || 0) + ventasEfectivo - totalRetiros;
    const saldoSistema = efectivoCaja;
    const diferencia = (parseFloat(saldoCierre) || 0) - saldoSistema;

    return { 
      ventasEfectivo, 
      ventasTarjeta, 
      ventasDebito,
      ventasMercadoPago, 
      ventasCuentaDNI, 
      ventasBrutas,
      notaCreditoTotal,
      ventaNeta,
      efectivoCaja,
      saldoSistema, 
      diferencia,
      montoVentasNormales,
      montoNotasCredito,
      totalRetiros
    };
  };

  const cerrarCaja = async () => {
    setProcesando(true);
    try {
      const ahora = new Date();
      const { ventasEfectivo, ventasTarjeta, ventasDebito, ventasMercadoPago, ventasCuentaDNI, ventasBrutas, notaCreditoTotal, ventaNeta, efectivoCaja, saldoSistema, diferencia } = calcularVentas();
      
      await updateDoc(doc(db, 'caja', caja.id), {
        estado: 'cerrada',
        ventasEfectivo,
        ventasTarjeta,
        ventasDebito,
        ventasMercadoPago,
        ventasCuentaDNI,
        ventasBrutas,
        notaCreditoTotal,
        ventaNeta,
        efectivoCaja,
        saldoSistema,
        saldoCierre: parseFloat(saldoCierre) || 0,
        diferencia,
        cerradoPor: user.uid,
        cerradoPorNombre: user.email || 'Usuario',
        horaCierre: ahora.toISOString(),
      });
      
      alert('Caja cerrada con éxito');
      setCaja(null);
      setSaldoCierre('');
      setVentasHoy([]);
    } catch (err) {
      console.error(err);
      alert('Error al cerrar caja');
    } finally {
      setProcesando(false);
    }
  };

  const crearRetiro = async () => {
    if (!tipoRetiro || !montoRetiro) {
      alert('Completá el tipo de retiro y el monto');
      return;
    }
    
    const monto = parseFloat(montoRetiro);
    if (monto <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }
    
    const { efectivoCaja: efectivoActual } = calcularVentas();
    if (monto > efectivoActual) {
      alert(`No podés retirar más de lo que hay en efectivo ($${efectivoActual})`);
      return;
    }
    
    setProcesando(true);
    try {
      const ahora = new Date();
      await addDoc(collection(db, 'retirosCaja'), {
        tipo: tipoRetiro,
        monto: monto,
        observacion: observacionRetiro || '',
        cajaId: caja.id,
        negocio: caja.sucursal,
        usuarioId: user.uid,
        usuarioNombre: user.email || 'Usuario',
        fecha: ahora.toISOString(),
        hora: ahora.toISOString(),
      });
      
      // Actualizar efectivo en caja
      const nuevoEfectivoCaja = efectivoActual - monto;
      await updateDoc(doc(db, 'caja', caja.id), {
        montoEfectivo: nuevoEfectivoCaja,
      });
      
      // Actualizar estado local de la caja
      setCaja({ ...caja, montoEfectivo: nuevoEfectivoCaja });
      
      // Recargar retiros
      const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
      const retirosActualizados = retirosSnapshot.docs
        .filter(d => d.data().cajaId === caja.id)
        .map(d => ({ id: d.id, ...d.data() }));
      setRetiros(retirosActualizados);
      
      setMostrarModalRetiro(false);
      setTipoRetiro('');
      setMontoRetiro('');
      setObservacionRetiro('');
      alert('Retiro registrado con éxito');
    } catch (err) {
      console.error(err);
      alert('Error al registrar retiro');
    } finally {
      setProcesando(false);
    }
  };

  const crearTipoRetiro = async () => {
    if (!nombreNuevoTipo.trim()) {
      alert('Ingresá un nombre para el tipo de retiro');
      return;
    }
    
    const nuevoId = nombreNuevoTipo.toLowerCase().replace(/\s+/g, '');
    const existe = [...TIPOS_RETIRO_FIJOS, ...tiposRetiroPersonalizados].find(t => t.id === nuevoId);
    if (existe) {
      alert('Ya existe un tipo de retiro con ese nombre');
      return;
    }
    
    setProcesando(true);
    try {
      const docRef = await addDoc(collection(db, 'tiposRetiro'), {
        nombre: nombreNuevoTipo,
        icono: iconoNuevoTipo,
      });
      
      setTiposRetiroPersonalizados([...tiposRetiroPersonalizados, { id: docRef.id, nombre: nombreNuevoTipo, icono: iconoNuevoTipo }]);
      
      setMostrarModalNuevoTipo(false);
      setNombreNuevoTipo('');
      setIconoNuevoTipo('💰');
      alert('Tipo de retiro creado con éxito');
    } catch (err) {
      console.error(err);
      alert('Error al crear tipo de retiro');
    } finally {
      setProcesando(false);
    }
  };

  const imprimirTicketCierre = () => {
    if (!caja) return;
    
    const fecha = new Date().toLocaleString();
    const ticket = `
╔══════════════════════════════╗
║       CIERRE DE CAJA         ║
╠══════════════════════════════╣
║ Fecha: ${fecha}
║ Negocio: ${caja.sucursal}
║
║ ─────────────────────────────
║ RESUMEN:
║ Ventas Brutas:    $${ventasBrutas.toLocaleString('es-AR')}
║ Notas Crédito:    -$${notaCreditoTotal.toLocaleString('es-AR')}
║ Venta Neta:       $${ventaNeta.toLocaleString('es-AR')}
║ ─────────────────────────────
║
║ POR MÉTODO DE PAGO:
║ Efectivo:         $${ventasEfectivo.toLocaleString('es-AR')}
║ Tarjeta:          $${ventasTarjeta.toLocaleString('es-AR')}
║ Débito:           $${ventasDebito.toLocaleString('es-AR')}
║ MercadoPago:      $${ventasMercadoPago.toLocaleString('es-AR')}
║ Cuenta DNI:       $${ventasCuentaDNI.toLocaleString('es-AR')}
║
║ ─────────────────────────────
║ Efectivo en Caja: $${efectivoCaja.toLocaleString('es-AR')}
║ Saldo Apertura:   $${caja.saldoApertura.toLocaleString('es-AR')}
║ Saldo Sistema:    $${saldoSistema.toLocaleString('es-AR')}
║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
    
    const printWindow = window.open('', '_blank', 'width=300,height=500');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cierre de Caja</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 11px; white-space: pre; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${ticket}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          {restriction.message || 'La caja solo puede abrirse desde PC'}
        </div>
      </Layout>
    );
  }

  const { ventasEfectivo, ventasTarjeta, ventasDebito, ventasMercadoPago, ventasCuentaDNI, ventasBrutas, notaCreditoTotal, ventaNeta, efectivoCaja, saldoSistema, diferencia, montoVentasNormales, montoNotasCredito } = calcularVentas();

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Gestión de Caja</h2>

      {!caja ? (
        <div className="bg-white p-6 rounded-lg shadow max-w-md">
          <h3 className="text-xl font-semibold mb-4">Apertura de Caja</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Seleccionar Negocio</label>
            <select
              value={negocioSeleccionado}
              onChange={(e) => setNegocioSeleccionado(e.target.value)}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">-- Seleccionar --</option>
              {NEGOCIOS.map(n => (
                <option key={n.id} value={n.id}>{n.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Saldo de Apertura (Efectivo)</label>
            <input
              type="number"
              step="0.01"
              value={saldoApertura}
              onChange={(e) => setSaldoApertura(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="0.00"
            />
          </div>

          <button
            onClick={abrirCaja}
            disabled={procesando || !negocioSeleccionado || !saldoApertura}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {procesando ? 'Procesando...' : 'Abrir Caja'}
          </button>
        </div>
) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Caja Abierta</h3>
                  <p className="text-sm text-gray-500">Negocio: <span className="font-semibold capitalize">{caja.sucursal}</span></p>
                </div>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Abierta</span>
              </div>
              
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
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Cierre de Caja</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMostrarModalRetiro(true)}
                    disabled={!efectivoCaja || efectivoCaja <= 0}
                    className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 disabled:opacity-50"
                    title="Nuevo Retiro"
                  >
                    💸 Nuevo Retiro
                  </button>
                  <button
                    onClick={imprimirTicketCierre}
                    className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                  >
                    🖨️
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Saldo en Caja (Efectivo)</label>
                <input
                  type="number"
                  step="0.01"
                  value={saldoCierre}
                  onChange={(e) => setSaldoCierre(e.target.value)}
                  className="w-full border p-2 rounded"
                  placeholder="0.00"
                />
              </div>

              {saldoCierre && (
                <div className="mb-4 p-3 bg-yellow-50 rounded text-sm">
                  <p>Diferencia: <span className={`font-semibold ${diferencia === 0 ? 'text-green-600' : 'text-red-600'}`}>${diferencia}</span></p>
                </div>
              )}

              <button
                onClick={cerrarCaja}
                disabled={procesando || !saldoCierre}
                className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Cerrar Caja'}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4">Historial de Movimientos</h3>
            
            {ventasHoy.length === 0 ? (
              <p className="text-gray-500">No hay movimientos aún</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Hora</th>
                      <th className="text-left py-2">Tipo</th>
                      <th className="text-left py-2">Monto</th>
                      <th className="text-left py-2">Método</th>
                      <th className="text-left py-2">Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasHoy.length === 0 && retiros.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-gray-500">No hay movimientos aún</td>
                      </tr>
                    ) : (
                      [...ventasHoy, ...retiros]
                        .sort((a, b) => new Date(b.hora || b.fecha) - new Date(a.hora || a.fecha))
                        .map((item) => {
                          if (item.monto !== undefined && item.tipo) {
                            const tipoRetiro = TIPOS_RETIRO_FIJOS.find(t => t.id === item.tipo) || tiposRetiroPersonalizados.find(t => t.id === item.tipo);
                            return (
                              <tr key={item.id} className="border-b bg-orange-50">
                                <td className="py-2 whitespace-nowrap">
                                  {item.hora ? new Date(item.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                                <td className="py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                    💸 {tipoRetiro?.nombre || item.tipo}
                                  </span>
                                </td>
                                <td className="py-2 font-bold text-red-700">
                                  -${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                </td>
                                <td className="py-2 capitalize text-gray-600">-</td>
                                <td className="py-2 text-gray-500 max-w-xs truncate">{item.observacion || '-'}</td>
                              </tr>
                            );
                          }
                          
                          const esNotaCredito = item.tipoVenta === 'notaCredito' || (item.tipoVenta === 'mixta' && item.diferencia < 0);
                          const esMixta = item.tipoVenta === 'mixta';
                          const montoMostrar = item.diferencia !== undefined 
                            ? (item.diferencia < 0 ? Math.abs(item.diferencia) : item.diferencia)
                            : item.total;
                          const tipoLabel = esNotaCredito 
                            ? (esMixta ? 'Mixta (NC)' : 'Nota Crédito') 
                            : (esMixta ? 'Mixta' : 'Venta');
                          
                          return (
                            <tr key={item.id} className={`border-b ${esNotaCredito ? 'bg-red-50' : 'bg-green-50'}`}>
                              <td className="py-2 whitespace-nowrap">
                                {item.hora ? new Date(item.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td className="py-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  esNotaCredito ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {esNotaCredito ? '⬇️' : '⬆️'} {tipoLabel}
                                </span>
                              </td>
                              <td className={`py-2 font-bold ${esNotaCredito ? 'text-red-700' : 'text-green-700'}`}>
                                {esNotaCredito && <span className="text-red-500 mr-1">-</span>}
                                ${montoMostrar.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                              </td>
                              <td className="py-2 capitalize text-gray-600">
                                {item.tipoPago?.map(p => {
                                  const nombres = { efectivo: 'EF', tarjeta: 'TJ', debito: 'DB', mercadopago: 'MP',cuentadni: 'DNI' };
                                  return nombres[p] || p;
                                }).join(', ') || '-'}
                              </td>
                              <td className="py-2 text-gray-500 max-w-xs truncate">{item.observacion || '-'}</td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td className="py-2 pl-2">TOTALES</td>
                      <td className="py-2"></td>
                      <td className="py-2">
                        <span className="text-green-700">${ventasBrutas.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                        <span className="text-red-600 ml-2">NC: -${notaCreditoTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                        {retiros.length > 0 && (
                          <span className="text-orange-600 ml-2">R: -${retiros.reduce((sum, r) => sum + r.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                        )}
                      </td>
                      <td className="py-2 text-blue-700" colSpan={2}>
                        Efectivo: ${efectivoCaja.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {mostrarModalRetiro && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Nuevo Retiro</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Tipo de Retiro</label>
              <div className="flex gap-2">
                <select
                  value={tipoRetiro}
                  onChange={(e) => {
                    if (e.target.value === '__nuevo__') {
                      setMostrarModalNuevoTipo(true);
                    } else {
                      setTipoRetiro(e.target.value);
                    }
                  }}
                  className="flex-1 border p-2 rounded"
                >
                  <option value="">-- Seleccionar --</option>
                  {TIPOS_RETIRO_FIJOS.map(t => (
                    <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>
                  ))}
                  {tiposRetiroPersonalizados.map(t => (
                    <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>
                  ))}
                  <option value="__nuevo__">+ Crear nuevo tipo</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">
                Monto (disponible: ${efectivoCaja || 0})
              </label>
              <input
                type="number"
                step="0.01"
                value={montoRetiro}
                onChange={(e) => setMontoRetiro(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="0.00"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Observación (opcional)</label>
              <textarea
                value={observacionRetiro}
                onChange={(e) => setObservacionRetiro(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="Ej: Limpieza, retiro para caja fuerte..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={crearRetiro}
                disabled={procesando || !tipoRetiro || !montoRetiro}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {procesando ? 'Registrando...' : 'Confirmar Retiro'}
              </button>
              <button
                onClick={() => {
                  setMostrarModalRetiro(false);
                  setTipoRetiro('');
                  setMontoRetiro('');
                  setObservacionRetiro('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalNuevoTipo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Nuevo Tipo de Retiro</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Nombre</label>
              <input
                type="text"
                value={nombreNuevoTipo}
                onChange={(e) => setNombreNuevoTipo(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="Ej: Gasto Diario"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Icono</label>
              <select
                value={iconoNuevoTipo}
                onChange={(e) => setIconoNuevoTipo(e.target.value)}
                className="w-full border p-2 rounded"
              >
                <option value="💰">💰 Dinero</option>
                <option value="🧹">🧹 Limpieza</option>
                <option value="👔">👔 Gerente</option>
                <option value="⚠️">⚠️ Error</option>
                <option value="📦">📦 Insumo</option>
                <option value="🚚">🚚 Envío</option>
                <option value="🍕">🍕 Comida</option>
                <option value="💡">💡 Servicio</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={crearTipoRetiro}
                disabled={procesando || !nombreNuevoTipo.trim()}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {procesando ? 'Creando...' : 'Crear Tipo'}
              </button>
              <button
                onClick={() => {
                  setMostrarModalNuevoTipo(false);
                  setNombreNuevoTipo('');
                  setIconoNuevoTipo('💰');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CajaPage;