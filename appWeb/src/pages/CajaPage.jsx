import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
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

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'MercadoPago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

export const CajaPage = () => {
  const { user, isGerente, selectedNegocio, setSelectedNegocio, clearSelectedNegocio } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [caja, setCaja] = useState(null);
  const [ventasHoy, setVentasHoy] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);
  
  // Modal de cierre de caja
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);

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
  const [saldoApertura, setSaldoApertura] = useState('');
  const [saldoCierre, setSaldoCierre] = useState('');

  // Editar venta
  const [editandoVenta, setEditandoVenta] = useState(null);
  const [nuevoTotal, setNuevoTotal] = useState('');
  const [nuevosPagos, setNuevosPagos] = useState([]);
  const [motivoEdicion, setMotivoEdicion] = useState('');

  const restriction = checkDeviceRestriction('aperturaCaja');
  const canAccess = !isMobile;

  useEffect(() => {
    if (!user) {
      setCaja(null);
      setVentasHoy([]);
      setRetiros([]);
      setLoading(false);
      return;
    }

    const fetchCaja = async () => {
      setLoading(true);
      try {
        const cajaQuery = query(
          collection(db, 'caja'),
          where('estado', '==', 'abierta'),
          where('abiertoPor', '==', user.uid)
        );
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          const cajaData = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
          setCaja(cajaData);
          if (cajaData.sucursal && cajaData.sucursal !== selectedNegocio) {
            setSelectedNegocio(cajaData.sucursal);
          }
          
          // Traer ventas de hoy para esta caja
          const fechaApertura = new Date(cajaData.fecha);
          const ventasQuery = query(
            collection(db, 'ventas'),
            where('fecha', '>=', fechaApertura),
            where('negocio', '==', cajaData.sucursal)
          );
          const ventasSnapshot = await getDocs(ventasQuery);
          const ventasDelTurno = ventasSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setVentasHoy(ventasDelTurno);
          
          // Traer retiros de esta caja
          const retirosQuery = query(
            collection(db, 'retirosCaja'),
            where('cajaId', '==', cajaData.id)
          );
          const retirosSnapshot = await getDocs(retirosQuery);
          const retirosDelTurno = retirosSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setRetiros(retirosDelTurno);
          
          // Traer tipos de retiro personalizados
          const tiposSnapshot = await getDocs(collection(db, 'tiposRetiro'));
          const tiposPersonalizados = tiposSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setTiposRetiroPersonalizados(tiposPersonalizados);
        } else {
          setCaja(null);
          setVentasHoy([]);
          setRetiros([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCaja();
  }, [user]);

  const abrirCaja = async () => {
    if (!selectedNegocio) return;
    setProcesando(true);
    try {
      const yaAbierta = await getDocs(query(
        collection(db, 'caja'),
        where('estado', '==', 'abierta'),
        where('abiertoPor', '==', user.uid)
      ));
      if (!yaAbierta.empty) {
        const existente = yaAbierta.docs[0].data();
        showToast(`Ya tenés una caja abierta en ${existente.sucursal || 'otra sucursal'}`, 'error');
        setProcesando(false);
        return;
      }

      const ahora = new Date();
      const docRef = await addDoc(collection(db, 'caja'), {
        estado: 'abierta',
        sucursal: selectedNegocio,
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
        sucursal: selectedNegocio,
        saldoApertura: parseFloat(saldoApertura) || 0,
        montoEfectivo: parseFloat(saldoApertura) || 0,
      });
      setSaldoApertura('');
    } catch (err) {
      console.error(err);
      showToast('Error al abrir caja', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const calcularVentas = () => {
    const ventasNormales = ventasHoy.filter(v => v.tipoVenta === 'normal' || v.tipoVenta === 'mixta');
    const notasCredito = ventasHoy.filter(v => v.tipoVenta === 'notaCredito' || v.totalNotaCredito > 0);
    
    const montoVentasNormales = ventasNormales.reduce((sum, v) => sum + (v.totalVenta || v.total), 0);
    const montoNotasCredito = notasCredito.reduce((sum, v) => sum + (v.totalNotaCredito || Math.abs(v.diferencia || v.total)), 0);
    
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
    
    const notasCreditoEfectivo = notasCredito.reduce((sum, v) => sum + (v.totalNotaCredito || Math.abs(v.diferencia || v.total)), 0);
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

  const cerrarCaja = async (imprimir = false) => {
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
      
      setCaja(null);
      setSaldoCierre('');
      setVentasHoy([]);
      setMostrarModalCierre(false);
      clearSelectedNegocio();
      
      if (imprimir) {
        setTimeout(() => imprimirTicketCierre(), 300);
      }
    } catch (err) {
      console.error(err);
      alert('Error al cerrar caja');
    } finally {
      setProcesando(false);
    }
  };

  const crearRetiro = async () => {
    if (!tipoRetiro || !montoRetiro) {
      showToast('Completá el tipo de retiro y el monto', 'warning');
      return;
    }
    
    const monto = parseFloat(montoRetiro);
    if (monto <= 0) {
      showToast('El monto debe ser mayor a 0', 'warning');
      return;
    }
    
    const { efectivoCaja: efectivoActual } = calcularVentas();
    if (monto > efectivoActual) {
      showToast(`No podés retirar más de lo que hay en efectivo ($${efectivoActual})`, 'warning');
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
      const retirosQuery = query(
        collection(db, 'retirosCaja'),
        where('cajaId', '==', caja.id)
      );
      const retirosSnapshot = await getDocs(retirosQuery);
      const retirosActualizados = retirosSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRetiros(retirosActualizados);
      
      setMostrarModalRetiro(false);
      setTipoRetiro('');
      setMontoRetiro('');
      setObservacionRetiro('');
      showToast('Retiro registrado con éxito', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al registrar retiro', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const crearTipoRetiro = async () => {
    if (!nombreNuevoTipo.trim()) {
      showToast('Ingresá un nombre para el tipo de retiro', 'warning');
      return;
    }
    
    const nuevoId = nombreNuevoTipo.toLowerCase().replace(/\s+/g, '');
    const existe = [...TIPOS_RETIRO_FIJOS, ...tiposRetiroPersonalizados].find(t => t.id === nuevoId);
    if (existe) {
      showToast('Ya existe un tipo de retiro con ese nombre', 'warning');
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
      showToast('Tipo de retiro creado con éxito', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al crear tipo de retiro', 'error');
    } finally {
      setProcesando(false);
    }
  };

const imprimirTicketCierre = () => {
    if (!caja) return;

    const ahora = new Date();
    const fechaCierre = ahora.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const fechaApertura = caja.fecha ? new Date(caja.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const direccion = caja.sucursal === 'chiclana' ? 'Chiclana 115' : caja.sucursal === 'belgrano' ? 'Belgrano 84' : caja.sucursal;
    const sucursalNombre = caja.sucursal === 'chiclana' ? 'CHICLANA' : caja.sucursal === 'belgrano' ? 'BELGRANO' : caja.sucursal.toUpperCase();

    const formatMonto = (monto) => monto.toLocaleString('es-AR').padStart(8);

    const gastosCajaRoja = retiros.filter(r => r.tipo === 'cajaRoja').reduce((sum, r) => sum + r.monto, 0);
    const gastosOtros = retiros.filter(r => r.tipo !== 'cajaRoja').reduce((sum, r) => sum + r.monto, 0);
    const totalGastos = gastosCajaRoja + gastosOtros;

    let ticket = `====================================
      SANTOS Y SANTAS
    ${direccion}
    Tel: 2915245537
===================================
     CIERRE DE CAJA
${fechaCierre}    ${sucursalNombre}
───────────────────────────────────
 APERTURA: ${fechaApertura}
 CIERRE:   ${fechaCierre}
───────────────────────────────────
 RESUMEN:
 Ventas Brutas:   $${formatMonto(ventasBrutas)}
 Notas Credito:   -$${formatMonto(notaCreditoTotal)}
 VENTA NETA:      $${formatMonto(ventaNeta)}
───────────────────────────────────
 X METODO DE PAGO:
 Efectivo:       $${formatMonto(ventasEfectivo)}
 Tarjeta:        $${formatMonto(ventasTarjeta)}
 Debito:         $${formatMonto(ventasDebito)}
 MercadoPago:    $${formatMonto(ventasMercadoPago)}
 Cuenta DNI:     $${formatMonto(ventasCuentaDNI)}
───────────────────────────────────
 GASTOS:
 Caja Roja:      $${formatMonto(gastosCajaRoja)}
 Otros Gastos:    $${formatMonto(gastosOtros)}
───────────────────────────────────
  SALDO APERTURA: $${formatMonto(caja.saldoApertura)}
  SALDO CIERRE:   $${formatMonto(parseFloat(saldoCierre) || 0)}
  SALDO SISTEMA:  $${formatMonto(saldoSistema)}
───────────────────────────────────
  DIFERENCIA:     $${formatMonto(diferencia)}
===================================
 FIRMA CAJERO:


───────────────────────────────────
 OBSERVACIONES: 



===================================`;

    const printWindow = window.open('', '_blank', 'width=300,height=700');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cierre de Caja</title>
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

  const handleOpenEdit = (venta) => {
    if (venta.cae) {
      showToast('No se puede modificar una venta facturada', 'warning');
      return;
    }
    setEditandoVenta(venta);
    setNuevoTotal(venta.total?.toString() || '0');
    setNuevosPagos(venta.tipoPago || ['efectivo']);
    setMotivoEdicion('');
  };

  const handleGuardarEdicion = async () => {
    if (!editandoVenta) return;
    if (!motivoEdicion.trim()) {
      showToast('Debés ingresar un motivo de modificación', 'warning');
      return;
    }

    setProcesando(true);
    try {
      await updateDoc(doc(db, 'ventas', editandoVenta.id), {
        total: parseFloat(nuevoTotal) || 0,
        tipoPago: nuevosPagos,
        modificadoPor: user.uid,
        modificadoPorNombre: user.email || 'Usuario',
        modificadoEn: new Date().toISOString(),
        motivoModificacion: motivoEdicion.trim(),
        valoresOriginales: {
          total: editandoVenta.total,
          tipoPago: editandoVenta.tipoPago,
        },
      });

      setVentasHoy(ventasHoy.map(v =>
        v.id === editandoVenta.id
          ? { ...v, total: parseFloat(nuevoTotal) || 0, tipoPago: nuevosPagos }
          : v
      ));

      setEditandoVenta(null);
      showToast('Venta modificada correctamente', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al modificar venta', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminarVenta = async (venta) => {
    if (venta.cae) {
      showToast('No se puede eliminar una venta facturada', 'warning');
      return;
    }

    const ok = await confirm(
      '¿Estás seguro de eliminar esta venta? El stock se restaurará automáticamente.',
      'Eliminar venta'
    );
    if (!ok) return;

    setProcesando(true);
    try {
      for (const item of (venta.productos || [])) {
        if (!item.productoId) continue;
        const productoRef = doc(db, 'productos', item.productoId);
        const productoDoc = await getDoc(productoRef);
        if (!productoDoc.exists()) continue;

        const productoData = productoDoc.data();
        const stockActual = productoData.stockPorNegocio?.[venta.negocio] || 0;
        const stockGlobalActual = productoData.stockGlobal || 0;
        const cambioStock = item.esNotaCredito ? -item.cantidad : item.cantidad;

        await updateDoc(productoRef, {
          [`stockPorNegocio.${venta.negocio}`]: stockActual + cambioStock,
          stockGlobal: stockGlobalActual + cambioStock,
        });
      }

      const cajaRef = doc(db, 'caja', caja.id);
      const cajaSnap = await getDoc(cajaRef);
      if (cajaSnap.exists()) {
        const cajaData = cajaSnap.data();
        const updateData = {};
        const metodos = venta.tipoPago || [];

        if (metodos.length === 1) {
          const campoKey = {
            efectivo: 'ventasEfectivo',
            tarjeta: 'ventasTarjeta',
            debito: 'ventasDebito',
            mercadopago: 'ventasMercadoPago',
            cuentadni: 'ventasCuentaDNI',
          }[metodos[0]];
          if (campoKey) {
            updateData[campoKey] = (cajaData[campoKey] || 0) - (venta.total || 0);
          }
          if (metodos[0] === 'efectivo') {
            updateData.montoEfectivo = (cajaData.montoEfectivo || 0) - (venta.total || 0);
          }
        }

        if (Object.keys(updateData).length > 0) {
          await updateDoc(cajaRef, updateData);
        }
      }

      await deleteDoc(doc(db, 'ventas', venta.id));
      setVentasHoy(ventasHoy.filter(v => v.id !== venta.id));
      showToast('Venta eliminada y stock restaurado', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar venta', 'error');
    } finally {
      setProcesando(false);
    }
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

      {selectedNegocio === null ? (
        <div className="max-w-lg mx-auto">
          <h3 className="text-xl font-semibold mb-6 text-center">¿En qué negocio estás?</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedNegocio('chiclana')}
              className="bg-white p-8 rounded-xl shadow hover:shadow-lg hover:bg-indigo-50 transition-all border-2 border-transparent hover:border-indigo-300"
            >
              <span className="text-4xl block mb-3">🏪</span>
              <span className="text-lg font-bold">Chiclana</span>
              <span className="text-sm text-gray-500 block mt-1">Chiclana 115</span>
            </button>
            <button
              onClick={() => setSelectedNegocio('belgrano')}
              className="bg-white p-8 rounded-xl shadow hover:shadow-lg hover:bg-indigo-50 transition-all border-2 border-transparent hover:border-indigo-300"
            >
              <span className="text-4xl block mb-3">🏪</span>
              <span className="text-lg font-bold">Belgrano</span>
              <span className="text-sm text-gray-500 block mt-1">Belgrano 84</span>
            </button>
          </div>
        </div>
      ) : !caja ? (
        <div className="max-w-md mx-auto">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Apertura de Caja</h3>
              <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium capitalize">{selectedNegocio}</span>
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
              disabled={procesando || !saldoApertura}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 mb-3"
            >
              {procesando ? 'Procesando...' : 'Abrir Caja'}
            </button>

            <button
              onClick={clearSelectedNegocio}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
            >
              ← Cambiar de negocio
            </button>
          </div>
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
                onClick={() => setMostrarModalCierre(true)}
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
                      {isGerente && <th className="text-right py-2 w-20">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ventasHoy.length === 0 && retiros.length === 0 ? (
                      <tr>
                        <td colSpan={isGerente ? 6 : 5} className="text-center py-4 text-gray-500">No hay movimientos aún</td>
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
                                {isGerente && <td className="py-2"></td>}
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
                              {isGerente && (
                                <td className="py-2 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => handleOpenEdit(item)}
                                    className="text-blue-600 hover:text-blue-800 mr-1 text-xs"
                                    title="Editar"
                                  >✏️</button>
                                  <button
                                    onClick={() => handleEliminarVenta(item)}
                                    className="text-red-600 hover:text-red-800 text-xs"
                                    title="Eliminar"
                                  >🗑️</button>
                                </td>
                              )}
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
                      <td className="py-2 text-blue-700" colSpan={isGerente ? 3 : 2}>
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

      {mostrarModalCierre && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-center">
              <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                🖨️ Cerrar Caja
              </h2>
            </div>
            
            <div className="p-5">
              <div className="bg-gray-50 rounded-lg p-4 mb-5">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  📊 Resumen del Día
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ventas Brutas:</span>
                    <span className="font-medium">${ventasBrutas.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Notas Crédito:</span>
                    <span className="font-medium text-red-600">-${notaCreditoTotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>💰 VENTA NETA:</span>
                    <span className="text-green-600">${ventaNeta.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-5">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Efectivo en Caja:</span>
                    <span className="font-medium">${efectivoCaja.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Saldo Sistema:</span>
                    <span className="font-medium">${saldoSistema.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Diferencia:</span>
                    <span className={diferencia === 0 ? 'text-green-600' : 'text-red-600'}>
                      ${diferencia.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
                
                {diferencia !== 0 && (
                  <div className="mt-3 p-2 bg-red-100 text-red-700 text-xs rounded flex items-center gap-1">
                    ⚠️ La diferencia no coincide con el saldo del sistema
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => cerrarCaja(true)}
                  disabled={procesando}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  🖨️ Cerrar Caja e Imprimir
                </button>
                
                <button
                  onClick={() => cerrarCaja(false)}
                  disabled={procesando}
                  className="w-full bg-gray-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  ❌ Cerrar sin Imprimir
                </button>
                
                <button
                  onClick={() => setMostrarModalCierre(false)}
                  className="w-full border border-gray-300 text-gray-600 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editandoVenta && isGerente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Modificar Venta</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Total</label>
              <input
                type="number"
                step="0.01"
                value={nuevoTotal}
                onChange={(e) => setNuevoTotal(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Métodos de pago</label>
              <div className="space-y-1">
                {METODOS_PAGO.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nuevosPagos.includes(m.id)}
                      onChange={() => {
                        setNuevosPagos(prev =>
                          prev.includes(m.id)
                            ? prev.filter(p => p !== m.id)
                            : [...prev, m.id]
                        );
                      }}
                      className="rounded"
                    />
                    {m.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">
                Motivo de modificación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoEdicion}
                onChange={(e) => setMotivoEdicion(e.target.value)}
                placeholder="Ej: Cliente pagó con tarjeta, no efectivo"
                className="w-full border p-2 rounded text-sm"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleGuardarEdicion}
                disabled={procesando || !motivoEdicion.trim()}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {procesando ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                onClick={() => setEditandoVenta(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50 font-medium"
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