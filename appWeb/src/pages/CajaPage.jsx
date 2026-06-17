import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ResumenCaja } from '../components/ResumenCaja';
import { HistorialMovimientos } from '../components/HistorialMovimientos';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { getDireccion, TELEFONO } from '../utils/ticketPrinter';
import { formatNum } from '../utils/format';

const TIPOS_RETIRO_FIJOS = [
  { id: 'cajaRoja', nombre: 'Caja roja', icono: '💰' },
  { id: 'gasto', nombre: 'Gasto', icono: '🧹' },
  { id: 'pagoProveedor', nombre: 'Pago Proveedor', icono: '📦' },
  { id: 'retiro', nombre: 'Retiro', icono: '💸' },
];

const TIPOS_INGRESO_FIJOS = [
  { id: 'ventaDirecta', nombre: 'Venta Directa', icono: '💰' },
  { id: 'deposito', nombre: 'Depósito', icono: '🏦' },
  { id: 'otroIngreso', nombre: 'Otro Ingreso', icono: '📥' },
];

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'Mercado Pago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

export const CajaPage = () => {
  const { user, isGerente } = useAuth();
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
  
  // Modal de ingreso
  const [ingresos, setIngresos] = useState([]);
  const [mostrarModalIngreso, setMostrarModalIngreso] = useState(false);
  const [tipoIngreso, setTipoIngreso] = useState('');
  const [montoIngreso, setMontoIngreso] = useState('');
  const [observacionIngreso, setObservacionIngreso] = useState('');
  
  // Tipos de ingreso personalizados
  const [tiposIngresoPersonalizados, setTiposIngresoPersonalizados] = useState([]);
  
  // Modal para crear tipo de ingreso
  const [mostrarModalNuevoTipoIngreso, setMostrarModalNuevoTipoIngreso] = useState(false);
  const [nombreNuevoTipoIngreso, setNombreNuevoTipoIngreso] = useState('');
  const [iconoNuevoTipoIngreso, setIconoNuevoTipoIngreso] = useState('💰');
  
  // Campos del formulario
  const [saldoApertura, setSaldoApertura] = useState('');
  const [saldoCierre, setSaldoCierre] = useState('');

  // Saldo anterior (última caja cerrada)
  const [saldoAnterior, setSaldoAnterior] = useState(null);
  const [mostrarPromptAnterior, setMostrarPromptAnterior] = useState(false);

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
          where('estado', '==', 'abierta')
        );
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          const cajaData = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
          setCaja(cajaData);
          
          const fechaApertura = new Date(cajaData.fecha);
          const ventasQuery = query(
            collection(db, 'ventas'),
            where('fecha', '>=', fechaApertura)
          );
          const ventasSnapshot = await getDocs(ventasQuery);
          setVentasHoy(ventasSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          
          const retirosQuery = query(
            collection(db, 'retirosCaja'),
            where('cajaId', '==', cajaData.id)
          );
          const retirosSnapshot = await getDocs(retirosQuery);
          setRetiros(retirosSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          
          const ingresosQuery = query(
            collection(db, 'ingresosCaja'),
            where('cajaId', '==', cajaData.id)
          );
          const ingresosSnapshot = await getDocs(ingresosQuery);
          setIngresos(ingresosSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          
          const tiposSnapshot = await getDocs(collection(db, 'tiposRetiro'));
          setTiposRetiroPersonalizados(tiposSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          
          const tiposIngresosSnapshot = await getDocs(collection(db, 'tiposIngreso'));
          setTiposIngresoPersonalizados(tiposIngresosSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          setCaja(null);
          setVentasHoy([]);
          setRetiros([]);
          setIngresos([]);
        }
      } catch (err) {
        console.error('Error al cargar caja:', err);
        showToast('Error al cargar datos de caja.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchCaja();
  }, [user]);

  useEffect(() => {
    if (caja || saldoAnterior !== null) return;
    (async () => {
      let anterior = 0;
      try {
        const snap = await getDoc(doc(db, 'ultimoCierre', 'unico'));
        if (snap.exists()) {
          anterior = snap.data().saldoCierre || 0;
        } else {
          const cajasSnap = await getDocs(query(
            collection(db, 'caja')
          ));
          if (!cajasSnap.empty) {
            const docs = cajasSnap.docs.map(d => d.data());
            docs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
            const ultimaCerrada = docs.find(d => d.estado === 'cerrada');
            if (ultimaCerrada) {
              anterior = ultimaCerrada.saldoCierre || 0;
              setDoc(doc(db, 'ultimoCierre', 'unico'), {
                saldoCierre: anterior,
                fecha: ultimaCerrada.fecha || new Date().toISOString(),
              }, { merge: true }).catch(() => {});
            }
          }
        }
      } catch (e) {
        anterior = 0;
      }
      setSaldoAnterior(anterior);
      setMostrarPromptAnterior(true);
    })();
  }, [caja]);

  const abrirCaja = async () => {
    setProcesando(true);
    try {
      const yaAbierta = await getDocs(query(
        collection(db, 'caja'),
        where('estado', '==', 'abierta')
      ));
      if (!yaAbierta.empty) {
        const existente = { id: yaAbierta.docs[0].id, ...yaAbierta.docs[0].data() };
        setCaja(existente);
        showToast('Conectado a caja abierta', 'success');
        setProcesando(false);
        return;
      }

      const ahora = new Date();
      const docRef = await addDoc(collection(db, 'caja'), {
        estado: 'abierta',
        saldoApertura: parseFloat(saldoApertura) || 0,
        saldoAnterior: saldoAnterior || 0,
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
        saldoApertura: parseFloat(saldoApertura) || 0,
        saldoAnterior: saldoAnterior || 0,
        montoEfectivo: parseFloat(saldoApertura) || 0,
      });
      setSaldoApertura('');
      setSaldoAnterior(null);
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
    
    const montoVentasNormales = ventasNormales.reduce((sum, v) => sum + (v.total || v.totalVenta), 0);
    const montoNotasCredito = notasCredito.reduce((sum, v) => sum + (v.totalNotaCredito || Math.abs(v.diferencia || v.total)), 0);
    
    const sumarPagos = (metodo) => ventasNormales.reduce((sum, v) => {
      if (v.pagos && v.pagos.length > 0) {
        const pago = v.pagos.find(p => p.metodo === metodo);
        return sum + (pago?.monto || 0);
      }
      return sum + (v.tipoPago?.includes(metodo) ? (v.total || v.diferencia || 0) : 0);
    }, 0);

    const ventasEfectivo = sumarPagos('efectivo');
    const ventasTarjeta = sumarPagos('tarjeta');
    const ventasDebito = sumarPagos('debito');
    const ventasMercadoPago = sumarPagos('mercadopago');
    const ventasCuentaDNI = sumarPagos('cuentadni');
    
    const notasCreditoEfectivo = notasCredito.reduce((sum, v) => sum + (v.totalNotaCredito || Math.abs(v.diferencia || v.total)), 0);
    const totalRetiros = retiros.reduce((sum, r) => sum + r.monto, 0);
    const totalIngresos = ingresos.reduce((sum, r) => sum + r.monto, 0);
    
    const ventasBrutas = montoVentasNormales;
    const notaCreditoTotal = montoNotasCredito;
    const ventaNeta = ventasBrutas - notaCreditoTotal;
    const efectivoCaja = (caja?.saldoApertura || 0) + ventasEfectivo + totalIngresos - totalRetiros;
    const saldoSistema = efectivoCaja;
    const diferencia = (parseFloat(saldoCierre) || 0) - saldoSistema;

    const notaCreditoDescuentoTotal = ventasHoy.reduce((sum, v) => sum + (v.notaCreditoDescuento || 0), 0);

    const totalDescuentos = ventasHoy.reduce((sum, v) => {
      if (!v.pagos) return sum;
      const base = v.diferencia > 0 ? v.diferencia : v.total || 0;
      return sum + v.pagos.reduce((s, p) => {
        if (!p.descuentoTipo || !p.descuentoValor) return s;
        return s + (p.descuentoTipo === 'porcentaje' ? base * p.descuentoValor / 100 : p.descuentoValor);
      }, 0);
    }, 0);

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
      totalRetiros,
      totalIngresos,
      totalDescuentos,
      notaCreditoDescuentoTotal,
    };
  };

  const cerrarCaja = async (imprimir = false) => {
    setProcesando(true);
    try {
      const ahora = new Date();
      const { ventasEfectivo, ventasTarjeta, ventasDebito, ventasMercadoPago, ventasCuentaDNI, ventasBrutas, notaCreditoTotal, ventaNeta, efectivoCaja, saldoSistema, diferencia, totalDescuentos, totalRetiros, totalIngresos, notaCreditoDescuentoTotal } = calcularVentas();
      
      const gastosCajaRoja = retiros.filter(r => r.tipo === 'cajaRoja').reduce((sum, r) => sum + r.monto, 0);
      const gastosOtros = retiros.filter(r => r.tipo !== 'cajaRoja').reduce((sum, r) => sum + r.monto, 0);
      
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
        totalDescuentos,
        notaCreditoDescuento: notaCreditoDescuentoTotal,
        totalRetiros,
        totalIngresos,
        gastosCajaRoja,
        gastosOtros,
        efectivoCaja,
        saldoSistema,
        saldoCierre: parseFloat(saldoCierre) || 0,
        diferencia,
        cerradoPor: user.uid,
        cerradoPorNombre: user.email || 'Usuario',
        horaCierre: ahora.toISOString(),
      });

      try {
        await setDoc(doc(db, 'ultimoCierre', 'unico'), {
          saldoCierre: parseFloat(saldoCierre) || 0,
          fecha: ahora.toISOString(),
          cajaId: caja.id,
        }, { merge: true });
      } catch (e) {
        console.error('Error al guardar ultimoCierre:', e);
      }
      
      setCaja(null);
      setSaldoCierre('');
      setVentasHoy([]);
      setMostrarModalCierre(false);
      
      if (imprimir) {
        setTimeout(() => imprimirTicketCierre(), 300);
      }
    } catch (err) {
      console.error(err);
      const msg = err.code === 'permission-denied'
        ? 'La caja fue cerrada en otro dispositivo. Recargá la página.'
        : 'Error al cerrar caja';
      showToast(msg, 'error');
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
      const msg = err.code === 'permission-denied'
        ? 'La caja fue cerrada en otro dispositivo. Recargá la página.'
        : 'Error al registrar retiro';
      showToast(msg, 'error');
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

  const crearIngreso = async () => {
    if (!tipoIngreso || !montoIngreso) {
      showToast('Completá el tipo de ingreso y el monto', 'warning');
      return;
    }
    
    const monto = parseFloat(montoIngreso);
    if (monto <= 0) {
      showToast('El monto debe ser mayor a 0', 'warning');
      return;
    }
    
    setProcesando(true);
    try {
      const ahora = new Date();
      await addDoc(collection(db, 'ingresosCaja'), {
        esIngreso: true,
        tipo: tipoIngreso,
        monto: monto,
        observacion: observacionIngreso || '',
        cajaId: caja.id,
        usuarioId: user.uid,
        usuarioNombre: user.email || 'Usuario',
        fecha: ahora.toISOString(),
        hora: ahora.toISOString(),
      });
      
      // Recargar ingresos
      const ingresosQuery = query(
        collection(db, 'ingresosCaja'),
        where('cajaId', '==', caja.id)
      );
      const ingresosSnapshot = await getDocs(ingresosQuery);
      const ingresosActualizados = ingresosSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setIngresos(ingresosActualizados);
      
      setMostrarModalIngreso(false);
      setTipoIngreso('');
      setMontoIngreso('');
      setObservacionIngreso('');
      showToast('Ingreso registrado con éxito', 'success');
    } catch (err) {
      console.error(err);
      const msg = err.code === 'permission-denied'
        ? 'La caja fue cerrada en otro dispositivo. Recargá la página.'
        : 'Error al registrar ingreso';
      showToast(msg, 'error');
    } finally {
      setProcesando(false);
    }
  };

  const crearTipoIngreso = async () => {
    if (!nombreNuevoTipoIngreso.trim()) {
      showToast('Ingresá un nombre para el tipo de ingreso', 'warning');
      return;
    }
    
    const nuevoId = nombreNuevoTipoIngreso.toLowerCase().replace(/\s+/g, '');
    const existe = [...TIPOS_INGRESO_FIJOS, ...tiposIngresoPersonalizados].find(t => t.id === nuevoId);
    if (existe) {
      showToast('Ya existe un tipo de ingreso con ese nombre', 'warning');
      return;
    }
    
    setProcesando(true);
    try {
      const docRef = await addDoc(collection(db, 'tiposIngreso'), {
        nombre: nombreNuevoTipoIngreso,
        icono: iconoNuevoTipoIngreso,
      });
      
      setTiposIngresoPersonalizados([...tiposIngresoPersonalizados, { id: docRef.id, nombre: nombreNuevoTipoIngreso, icono: iconoNuevoTipoIngreso }]);
      
      setMostrarModalNuevoTipoIngreso(false);
      setNombreNuevoTipoIngreso('');
      setIconoNuevoTipoIngreso('💰');
      showToast('Tipo de ingreso creado con éxito', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al crear tipo de ingreso', 'error');
    } finally {
      setProcesando(false);
    }
  };

const imprimirTicketCierre = () => {
    if (!caja) return;

    const ahora = new Date();
    const fechaCierre = ahora.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const fechaApertura = caja.fecha ? new Date(caja.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const direccion = getDireccion();

    const formatMonto = (monto) => monto.toLocaleString('es-AR').padStart(8);

    const gastosCajaRoja = retiros.filter(r => r.tipo === 'cajaRoja').reduce((sum, r) => sum + r.monto, 0);
    const gastosOtros = retiros.filter(r => r.tipo !== 'cajaRoja').reduce((sum, r) => sum + r.monto, 0);
    const totalIngresos = ingresos.reduce((sum, r) => sum + r.monto, 0);

    let ticket = `====================================
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
    Ventas Brutas:   $${formatMonto(ventasBrutas)}
    Notas Credito:   -$${formatMonto(notaCreditoTotal)}
    NC Redimidas:    -$${formatMonto(notaCreditoDescuentoTotal)}
    Descuentos:      -$${formatMonto(totalDescuentos)}
    VENTA NETA:      $${formatMonto(ventaNeta)}
───────────────────────────────────
  X METODO DE PAGO:
  Efectivo:       $${formatMonto(ventasEfectivo)}
  Tarjeta:        $${formatMonto(ventasTarjeta)}
  Debito:         $${formatMonto(ventasDebito)}
  Mercado Pago:   $${formatMonto(ventasMercadoPago)}
  Cuenta DNI:     $${formatMonto(ventasCuentaDNI)}
───────────────────────────────────
  GASTOS:
   Caja Roja:       -$${formatMonto(gastosCajaRoja)}
   Otros Gastos:    -$${formatMonto(gastosOtros)}
   Ingresos:        +$${formatMonto(totalIngresos)}
───────────────────────────────────
  EFECTIVO CAJA ANTERIOR: $${formatMonto(caja.saldoAnterior || 0)}
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
      const msg = err.code === 'permission-denied'
        ? 'La caja fue cerrada en otro dispositivo. Recargá la página.'
        : 'Error al modificar venta';
      showToast(msg, 'error');
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
        const stockActual = productoData.stock || 0;
        const cambioStock = item.esNotaCredito ? -item.cantidad : item.cantidad;

        await updateDoc(productoRef, {
          stock: stockActual + cambioStock,
        });
      }

      const cajaRef = doc(db, 'caja', caja.id);
      const cajaSnap = await getDoc(cajaRef);
      if (cajaSnap.exists()) {
        const cajaData = cajaSnap.data();
        const updateData = {};
        const pagosVenta = venta.pagos || [];
        if (pagosVenta.length > 0) {
          for (const pago of pagosVenta) {
            const monto = pago.monto || 0;
            const campoKey = {
              efectivo: 'ventasEfectivo',
              tarjeta: 'ventasTarjeta',
              debito: 'ventasDebito',
              mercadopago: 'ventasMercadoPago',
              cuentadni: 'ventasCuentaDNI',
            }[pago.metodo];
            if (campoKey) {
              updateData[campoKey] = (cajaData[campoKey] || 0) - monto;
            }
            if (pago.metodo === 'efectivo') {
              updateData.montoEfectivo = (cajaData.montoEfectivo || 0) - monto;
            }
          }
        } else {
          const metodos = venta.tipoPago || [];
          for (const metodo of metodos) {
            const campoKey = {
              efectivo: 'ventasEfectivo',
              tarjeta: 'ventasTarjeta',
              debito: 'ventasDebito',
              mercadopago: 'ventasMercadoPago',
              cuentadni: 'ventasCuentaDNI',
            }[metodo];
            if (campoKey) {
              updateData[campoKey] = (cajaData[campoKey] || 0) - (venta.total || 0);
            }
            if (metodo === 'efectivo') {
              updateData.montoEfectivo = (cajaData.montoEfectivo || 0) - (venta.total || 0);
            }
          }
        }

        if (venta.notaCreditoDescuento) {
          updateData.notaCreditoDescuento = (cajaData.notaCreditoDescuento || 0) - venta.notaCreditoDescuento;
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
      const msg = err.code === 'permission-denied'
        ? 'La caja fue cerrada en otro dispositivo. Recargá la página.'
        : 'Error al eliminar venta';
      showToast(msg, 'error');
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return <Layout><LoadingSkeleton type="page" /></Layout>;
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-soft border border-yellow-line text-yellow px-4 py-3 rounded">
          {restriction.message || 'La caja solo puede abrirse desde PC'}
        </div>
      </Layout>
    );
  }

  const { ventasEfectivo, ventasTarjeta, ventasDebito, ventasMercadoPago, ventasCuentaDNI, ventasBrutas, notaCreditoTotal, ventaNeta, efectivoCaja, saldoSistema, diferencia, totalDescuentos, montoVentasNormales, montoNotasCredito, notaCreditoDescuentoTotal } = calcularVentas();

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Gestión de Caja</h2>

      {!caja ? (
        <div className="max-w-md mx-auto">
          <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
            <h3 className="text-xl font-semibold mb-4">Apertura de Caja</h3>

            {mostrarPromptAnterior && (
              <div className="mb-4 p-4 bg-indigo-soft border border-indigo-line rounded-lg">
                <p className="text-sm font-semibold mb-3">Monto anterior de caja: <span className="text-lg">${saldoAnterior?.toLocaleString('es-AR')}</span></p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSaldoApertura(saldoAnterior.toString()); setMostrarPromptAnterior(false); }}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm font-medium"
                  >Aceptar</button>
                  <button
                    onClick={() => setMostrarPromptAnterior(false)}
                    className="flex-1 bg-surface text-body py-2 px-4 rounded hover:bg-elevated text-sm font-medium"
                  >Modificar</button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Saldo de Apertura (Efectivo)</label>
              <input
                type="number"
                step="0.01"
                value={saldoApertura}
                onChange={(e) => setSaldoApertura(e.target.value)}
                className="w-full border border-line-input bg-input text-body p-2 rounded"
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

            </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card p-6 rounded-lg shadow-sm border border-line">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Caja Abierta</h3>
                </div>
                <span className="bg-green-soft text-green px-3 py-1 rounded-full text-sm">Abierta</span>
              </div>
              
               <ResumenCaja caja={caja} ventasBrutas={ventasBrutas} notaCreditoTotal={notaCreditoTotal} notaCreditoDescuentoTotal={notaCreditoDescuentoTotal} ventaNeta={ventaNeta} efectivoCaja={efectivoCaja} ventasEfectivo={ventasEfectivo} ventasTarjeta={ventasTarjeta} ventasDebito={ventasDebito} ventasMercadoPago={ventasMercadoPago} ventasCuentaDNI={ventasCuentaDNI} />
            </div>

            <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Cierre de Caja</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMostrarModalRetiro(true)}
                    disabled={!efectivoCaja || efectivoCaja <= 0}
                    className="text-sm bg-red-soft text-red px-3 py-1 rounded hover:bg-red-soft disabled:opacity-50"
                    title="Nuevo Retiro"
                  >
                    💸 Nuevo Retiro
                  </button>
                  <button
                    onClick={() => setMostrarModalIngreso(true)}
                    className="text-sm bg-green-soft text-green px-3 py-1 rounded hover:bg-green-soft"
                    title="Nuevo Ingreso"
                  >
                    🟢 Nuevo Ingreso
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
                  className="w-full border border-line-input bg-input text-body p-2 rounded"
                  placeholder="0.00"
                />
              </div>

              {saldoCierre && (
                <div className="mb-4 p-3 bg-yellow-soft rounded text-sm">
                  <p>Diferencia: <span className={`font-semibold ${diferencia === 0 ? 'text-green' : 'text-red'}`}>${formatNum(diferencia)}</span></p>
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

          <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
            <h3 className="text-xl font-semibold mb-4">Historial de Movimientos</h3>
            <HistorialMovimientos ventasHoy={ventasHoy} retiros={retiros} ingresos={ingresos} isGerente={isGerente} TIPOS_RETIRO_FIJOS={TIPOS_RETIRO_FIJOS} tiposRetiroPersonalizados={tiposRetiroPersonalizados} TIPOS_INGRESO_FIJOS={TIPOS_INGRESO_FIJOS} tiposIngresoPersonalizados={tiposIngresoPersonalizados} handleOpenEdit={handleOpenEdit} handleEliminarVenta={handleEliminarVenta} ventasBrutas={ventasBrutas} notaCreditoTotal={notaCreditoTotal} efectivoCaja={efectivoCaja} />
          </div>
        </div>
      )}

      <Modal open={mostrarModalRetiro} onClose={() => { setMostrarModalRetiro(false); setTipoRetiro(''); setMontoRetiro(''); setObservacionRetiro(''); }} title="Nuevo Retiro">
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
              className="flex-1 border border-line-input bg-input text-body p-2 rounded"
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
            className="w-full border border-line-input bg-input text-body p-2 rounded"
            placeholder="0.00"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Observación (opcional)</label>
          <textarea
            value={observacionRetiro}
            onChange={(e) => setObservacionRetiro(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
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
            className="px-4 py-2 border border-line-input rounded hover:bg-elevated"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={mostrarModalNuevoTipo} onClose={() => { setMostrarModalNuevoTipo(false); setNombreNuevoTipo(''); setIconoNuevoTipo('💰'); }} title="Nuevo Tipo de Retiro">
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Nombre</label>
          <input
            type="text"
            value={nombreNuevoTipo}
            onChange={(e) => setNombreNuevoTipo(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
            placeholder="Ej: Gasto Diario"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Icono</label>
          <select
            value={iconoNuevoTipo}
            onChange={(e) => setIconoNuevoTipo(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
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
            className="px-4 py-2 border border-line-input rounded hover:bg-elevated"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={mostrarModalIngreso} onClose={() => { setMostrarModalIngreso(false); setTipoIngreso(''); setMontoIngreso(''); setObservacionIngreso(''); }} title="Nuevo Ingreso">
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Tipo de Ingreso</label>
          <div className="flex gap-2">
            <select
              value={tipoIngreso}
              onChange={(e) => {
                if (e.target.value === '__nuevo__') {
                  setMostrarModalNuevoTipoIngreso(true);
                } else {
                  setTipoIngreso(e.target.value);
                }
              }}
              className="flex-1 border border-line-input bg-input text-body p-2 rounded"
            >
              <option value="">-- Seleccionar --</option>
              {TIPOS_INGRESO_FIJOS.map(t => (
                <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>
              ))}
              {tiposIngresoPersonalizados.map(t => (
                <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>
              ))}
              <option value="__nuevo__">+ Crear nuevo tipo</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">
            Monto
          </label>
          <input
            type="number"
            step="0.01"
            value={montoIngreso}
            onChange={(e) => setMontoIngreso(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
            placeholder="0.00"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Observación (opcional)</label>
          <textarea
            value={observacionIngreso}
            onChange={(e) => setObservacionIngreso(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
            placeholder="Ej: Depósito bancario, venta directa..."
            rows={2}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={crearIngreso}
            disabled={procesando || !tipoIngreso || !montoIngreso}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {procesando ? 'Registrando...' : 'Confirmar Ingreso'}
          </button>
          <button
            onClick={() => {
              setMostrarModalIngreso(false);
              setTipoIngreso('');
              setMontoIngreso('');
              setObservacionIngreso('');
            }}
            className="px-4 py-2 border border-line-input rounded hover:bg-elevated"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={mostrarModalNuevoTipoIngreso} onClose={() => { setMostrarModalNuevoTipoIngreso(false); setNombreNuevoTipoIngreso(''); setIconoNuevoTipoIngreso('💰'); }} title="Nuevo Tipo de Ingreso">
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Nombre</label>
          <input
            type="text"
            value={nombreNuevoTipoIngreso}
            onChange={(e) => setNombreNuevoTipoIngreso(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
            placeholder="Ej: Venta Directa"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Icono</label>
          <select
            value={iconoNuevoTipoIngreso}
            onChange={(e) => setIconoNuevoTipoIngreso(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
          >
            <option value="💰">💰 Dinero</option>
            <option value="🏦">🏦 Banco</option>
            <option value="📥">📥 Ingreso</option>
            <option value="🔄">🔄 Devolución</option>
            <option value="💳">💳 Tarjeta</option>
            <option value="📦">📦 Insumo</option>
            <option value="💡">💡 Otro</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={crearTipoIngreso}
            disabled={procesando || !nombreNuevoTipoIngreso.trim()}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {procesando ? 'Creando...' : 'Crear Tipo'}
          </button>
          <button
            onClick={() => {
              setMostrarModalNuevoTipoIngreso(false);
              setNombreNuevoTipoIngreso('');
              setIconoNuevoTipoIngreso('💰');
            }}
            className="px-4 py-2 border border-line-input rounded hover:bg-elevated"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={mostrarModalCierre} onClose={() => setMostrarModalCierre(false)} noClose className="max-w-md overflow-hidden p-0">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-center">
          <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            🖨️ Cerrar Caja
          </h2>
        </div>
        
        <div className="p-5">
          <div className="bg-card rounded-lg p-4 mb-5">
            <h3 className="font-semibold text-secondary mb-3 flex items-center gap-2">
              📊 Resumen del Día
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Ventas Brutas:</span>
                <span className="font-medium">${ventasBrutas.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Notas Crédito:</span>
                <span className="font-medium text-red">-${notaCreditoTotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="border-t border-line pt-2 mt-2 flex justify-between font-bold">
                <span>💰 VENTA NETA:</span>
                <span className="text-green">${ventaNeta.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg p-4 mb-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Efectivo en Caja:</span>
                <span className="font-medium">${efectivoCaja.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Saldo Sistema:</span>
                <span className="font-medium">${saldoSistema.toLocaleString('es-AR')}</span>
              </div>
              <div className="border-t border-line pt-2 mt-2 flex justify-between font-bold">
                <span>Diferencia:</span>
                <span className={diferencia === 0 ? 'text-green' : 'text-red'}>
                  ${diferencia.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
            
            {diferencia !== 0 && (
              <div className="mt-3 p-2 bg-red-soft text-red text-xs rounded flex items-center gap-1">
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
              className="w-full bg-surface text-body py-3 px-4 rounded-lg font-semibold hover:bg-elevated disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              ❌ Cerrar sin Imprimir
            </button>
            
            <button
              onClick={() => setMostrarModalCierre(false)}
              className="w-full border border-line-input text-secondary py-2 px-4 rounded-lg hover:bg-elevated transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editandoVenta && isGerente} onClose={() => setEditandoVenta(null)} title="Modificar Venta">
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Total</label>
          <input
            type="number"
            step="0.01"
            value={nuevoTotal}
            onChange={(e) => setNuevoTotal(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
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
              Motivo de modificación <span className="text-red">*</span>
          </label>
          <textarea
            value={motivoEdicion}
            onChange={(e) => setMotivoEdicion(e.target.value)}
            placeholder="Ej: Cliente pagó con tarjeta, no efectivo"
            className="w-full border border-line-input bg-input text-body p-2 rounded text-sm"
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
            className="px-4 py-2 border border-line-input rounded hover:bg-elevated font-medium"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </Layout>
  );
};

export default CajaPage;