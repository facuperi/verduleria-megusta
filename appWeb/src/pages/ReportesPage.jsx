import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, getDoc, updateDoc, doc } from "firebase/firestore";
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';
import { FiltrosReportes } from '../components/FiltrosReportes';
import { EmptyState } from '../components/EmptyState';
import { ResumenReportes } from '../components/ResumenReportes';
import { TablaReportes } from '../components/TablaReportes';
import { imprimirTicketCajaCerrada } from '../utils/ticketPrinter';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { VarianteSelector } from '../components/VarianteSelector';

export const ReportesPage = () => {
  const { isGerente } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();

  // ==== PASO 1: Estados base ====
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('todos');
  const [tipoRetiro, setTipoRetiro] = useState('todos');
  const [tipoIngreso, setTipoIngreso] = useState('todos');
  const [metodoPago, setMetodoPago] = useState('todos');
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filasExpandidas, setFilasExpandidas] = useState({});
  const [retirosPendientes, setRetirosPendientes] = useState(0);
  const [migrando, setMigrando] = useState(false);
  const [migrandoCajas, setMigrandoCajas] = useState(false);
  const [cajasPendientes, setCajasPendientes] = useState(0);
  const [tiposRetiroPersonalizados, setTiposRetiroPersonalizados] = useState({});
  const [tiposIngresoPersonalizados, setTiposIngresoPersonalizados] = useState({});
  const [productos, setProductos] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [facturaFilter, setFacturaFilter] = useState('todos');
  const [filtroActivo, setFiltroActivo] = useState('todos');
  const [flashGreenId, setFlashGreenId] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [varianteModal, setVarianteModal] = useState(null);

  const filtrosUnicos = [...new Set(productos.map(p => p.filtro).filter(Boolean))];

  const restriction = checkDeviceRestriction('reportes');
  const canAccess = !isMobile && isGerente;

  // ==== Migrar retiros old (agregar campo negocio) ====
  const migrarRetiros = async () => {
    setMigrando(true);
    try {
      // 1. Obtener todos los retiros
      const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
      const retiros = retirosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 2. Filtrar los que NO tienen campo negocio
      const retirosSinNegocio = retiros.filter(r => r.negocio === undefined);
      
      if (retirosSinNegocio.length === 0) {
        showToast('No hay retiros para migrar', 'info');
        setMigrando(false);
        return;
      }
      
      // 3. Para cada retiro sin negocio, buscar la caja y obtener la sucursal
      let actualizados = 0;
      for (const retiro of retirosSinNegocio) {
        if (retiro.cajaId) {
          const cajaDoc = await getDoc(doc(db, 'caja', retiro.cajaId));
          if (cajaDoc.exists()) {
            const cajaData = cajaDoc.data();
            if (cajaData.sucursal !== undefined) {
              await updateDoc(doc(db, 'retirosCaja', retiro.id), {
                negocio: cajaData.sucursal
              });
              actualizados++;
            }
          }
        }
      }
      
      const remaining = (await getDocs(collection(db, 'retirosCaja')))
        .docs.map(d => d.data())
        .filter(r => r.negocio === undefined).length;
      setRetirosPendientes(remaining);
      showToast(`Se actualizaron ${actualizados} retiros`, 'success');
    } catch (err) {
      console.error('Error al migrar:', err);
      showToast('Error al migrar retiros', 'error');
    } finally {
      setMigrando(false);
    }
  };

  // ==== Migrar cajas viejas (backfill ventasBrutas, etc) ====
  const migrarCajas = async () => {
    setMigrandoCajas(true);
    try {
      const cajaSnapshot = await getDocs(collection(db, 'caja'));
      const cajas = cajaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const cajasViejas = cajas.filter(c => c.estado === 'cerrada' && !c.ventasBrutas && c.ventasBrutas !== 0);

      if (cajasViejas.length === 0) {
        showToast('No hay cajas para migrar', 'info');
        setMigrandoCajas(false);
        return;
      }

      let actualizadas = 0;
      for (const caja of cajasViejas) {
        const apertura = caja.fecha ? new Date(caja.fecha) : null;
        const cierre = caja.horaCierre ? new Date(caja.horaCierre) : (apertura ? new Date(apertura.getTime() + 86400000) : null);
        if (!apertura || !cierre) continue;

        const ventasSnapshot = await getDocs(collection(db, 'ventas'));
        const ventas = ventasSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(v => {
            const vFecha = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);
            return vFecha >= apertura && vFecha <= cierre && (v.negocio === caja.sucursal);
          });

        const ventasNormales = ventas.filter(v => v.tipoVenta === 'normal' || v.tipoVenta === 'mixta');
        const notasCredito = ventas.filter(v => v.tipoVenta === 'notaCredito' || v.totalNotaCredito > 0);

        const montoVentasNormales = ventasNormales.reduce((sum, v) => sum + (v.totalVenta || v.total), 0);
        const montoNotasCredito = notasCredito.reduce((sum, v) => sum + (v.totalNotaCredito || Math.abs(v.diferencia || v.total)), 0);

        const sumarPagos = (metodo, ventas) => ventas.reduce((sum, v) => {
          if (v.pagos && v.pagos.length > 0) {
            const pago = v.pagos.find(p => p.metodo === metodo);
            return sum + (pago?.monto || 0);
          }
          return sum + (v.tipoPago?.includes(metodo) ? (v.total || v.diferencia || 0) : 0);
        }, 0);

        const ventasEfectivo = sumarPagos('efectivo', ventasNormales);
        const ventasTarjeta = sumarPagos('tarjeta', ventasNormales);
        const ventasDebito = sumarPagos('debito', ventasNormales);
        const ventasMercadoPago = sumarPagos('mercadopago', ventasNormales);
        const ventasCuentaDNI = sumarPagos('cuentadni', ventasNormales);

        const ventaNeta = montoVentasNormales - montoNotasCredito;
        const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
        const retiros = retirosSnapshot.docs.map(d => d.data()).filter(r => r.cajaId === caja.id);
        const totalRetiros = retiros.reduce((sum, r) => sum + r.monto, 0);
        const efectivoCaja = (caja.saldoApertura || 0) + ventasEfectivo - totalRetiros;
        const saldoSistema = efectivoCaja;
        const diferencia = (caja.saldoCierre || 0) - saldoSistema;

        const notaCreditoDescuentoTotal = ventas.reduce((sum, v) => sum + (v.notaCreditoDescuento || 0), 0);

        await updateDoc(doc(db, 'caja', caja.id), {
          ventasBrutas: montoVentasNormales,
          notaCreditoTotal: montoNotasCredito,
          notaCreditoDescuento: notaCreditoDescuentoTotal,
          ventaNeta,
          ventasEfectivo,
          ventasTarjeta,
          ventasDebito,
          ventasMercadoPago,
          ventasCuentaDNI,
          efectivoCaja,
          saldoSistema,
          diferencia,
        });
        actualizadas++;
      }

      const remainingCajas = (await getDocs(collection(db, 'caja')))
        .docs.map(d => d.data())
        .filter(c => c.estado === 'cerrada' && !c.ventasBrutas && c.ventasBrutas !== 0).length;
      setCajasPendientes(remainingCajas);
      showToast(`Se actualizaron ${actualizadas} cajas`, 'success');
    } catch (err) {
      console.error('Error al migrar cajas:', err);
      showToast('Error al migrar cajas', 'error');
    } finally {
      setMigrandoCajas(false);
    }
  };

  // ==== Verificar retiros pendientes al inicio ====
  useEffect(() => {
    const verificarRetiros = async () => {
      const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
      const retiros = retirosSnapshot.docs.map(doc => doc.data());
      const sinNegocio = retiros.filter(r => r.negocio === undefined).length;
      setRetirosPendientes(sinNegocio);

      const productosSnapshot = await getDocs(collection(db, 'productos'));
      setProductos(productosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const cajaSnapshot = await getDocs(collection(db, 'caja'));
      const cajasSinDatos = cajaSnapshot.docs
        .map(doc => doc.data())
        .filter(c => c.estado === 'cerrada' && !c.ventasBrutas && c.ventasBrutas !== 0)
        .length;
      setCajasPendientes(cajasSinDatos);
    };
    if (canAccess) {
      verificarRetiros();
    }
  }, [canAccess]);

  // ==== PASO 2: Función de carga de datos ====
  const cargarMovimientos = async () => {
    if (!fechaDesde || !fechaHasta) {
      showToast('Seleccioná fecha desde y hasta', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Extraer día/mes/año de los strings de fecha
      const [anioDesde, mesDesde, diaDesde] = fechaDesde.split('-').map(Number);
      const [anioHasta, mesHasta, diaHasta] = fechaHasta.split('-').map(Number);

      // Función para comparar solo fecha (sin hora)
      const esFechaEnRango = (fechaInput) => {
        let fecha;
        if (fechaInput?.toDate) {
          fecha = fechaInput.toDate();
        } else if (fechaInput) {
          fecha = new Date(fechaInput);
        } else {
          return false;
        }
        
        // Comparar solo año, mes, día (sin hora)
        const fAnio = fecha.getFullYear();
        const fMes = fecha.getMonth() + 1; // getMonth() devuelve 0-11
        const fDia = fecha.getDate();
        
        // Comparar como string YYYY-MM-DD para evitar problemas de timezone
        const fechaStr = `${fAnio}-${String(fMes).padStart(2, '0')}-${String(fDia).padStart(2, '0')}`;
        const desdeStr = `${anioDesde}-${String(mesDesde).padStart(2, '0')}-${String(diaDesde).padStart(2, '0')}`;
        const hastaStr = `${anioHasta}-${String(mesHasta).padStart(2, '0')}-${String(diaHasta).padStart(2, '0')}`;
        
        return fechaStr >= desdeStr && fechaStr <= hastaStr;
      };

      // 1. Cargar ventas
      const ventasSnapshot = await getDocs(collection(db, 'ventas'));
      let ventasData = ventasSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), origen: 'ventas' }))
        .filter(v => esFechaEnRango(v.fecha));

      // 2. Cargar retiros
      const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
      let retirosData = retirosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), origen: 'retiros' }))
        .filter(r => esFechaEnRango(r.fecha));

      // 2b. Cargar ingresos
      const ingresosSnapshot = await getDocs(collection(db, 'ingresosCaja'));
      let ingresosData = ingresosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), origen: 'ingresos', esIngreso: true }))
        .filter(r => esFechaEnRango(r.fecha));

      // 3. Cargar cajas (aperturas/cierres)
      const cajaSnapshot = await getDocs(collection(db, 'caja'));
      let cajaData = cajaSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), origen: 'caja' }))
        .filter(c => esFechaEnRango(c.fecha));

      // Unir todo
      const todos = [...ventasData, ...retirosData, ...ingresosData, ...cajaData];
      
      // Ordenar por fecha descendente
      todos.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || a.hora);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || b.hora);
        return fechaB - fechaA;
      });

      setMovimientos(todos);
      
      // Cargar tipos de retiros personalizados
      const tiposSnapshot = await getDocs(collection(db, 'tiposRetiro'));
      const tiposObj = {};
      tiposSnapshot.docs.forEach(doc => {
        tiposObj[doc.id] = { nombre: doc.data().nombre, icono: doc.data().icono };
      });
      setTiposRetiroPersonalizados(tiposObj);

      // Cargar tipos de ingresos personalizados
      const tiposIngresoSnapshot = await getDocs(collection(db, 'tiposIngreso'));
      const tiposIngresoObj = {};
      tiposIngresoSnapshot.docs.forEach(doc => {
        tiposIngresoObj[doc.id] = { nombre: doc.data().nombre, icono: doc.data().icono };
      });
      setTiposIngresoPersonalizados(tiposIngresoObj);
      
      // Aplicar filtros automáticamente después de cargar
      aplicarFiltros(todos);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==== PASO 3: Aplicar filtros secundarios ====
  const aplicarFiltros = (data) => {
    // Esta función se llama internamente para filtrar
    // Se aplica en el render
  };

  const toggleProducto = (productoId) => {
    setProductosSeleccionados(prev => {
      if (prev.includes(productoId)) {
        return prev.filter(id => id !== productoId);
      } else {
        return [...prev, productoId];
      }
    });
  };

  const limpiarProductos = () => {
    setProductosSeleccionados([]);
    setBusquedaProducto('');
  };

  useBarcodeScanner((codigo) => {
    const matches = productos.filter(p => p.codigoBarras === codigo);
    if (matches.length === 1) {
      const p = matches[0];
      setProductosSeleccionados(prev => prev.includes(p.id) ? prev : [...prev, p.id]);
      setFlashGreenId(p.id);
      setTimeout(() => setFlashGreenId(null), 2000);
      showToast(`✅ ${p.nombre} agregado al filtro`, 'success');
    } else if (matches.length > 1) {
      setVarianteModal(matches);
    } else {
      setScanError(codigo);
      setTimeout(() => setScanError(null), 4000);
    }
  });

  const handleVariantSelect = (producto) => {
    setVarianteModal(null);
    setProductosSeleccionados(prev => prev.includes(producto.id) ? prev : [...prev, producto.id]);
    setFlashGreenId(producto.id);
    setTimeout(() => setFlashGreenId(null), 2000);
    showToast(`✅ ${producto.nombre} agregado al filtro`, 'success');
  };

  const movimientosFiltrados = movimientos
    .filter(m => {
      // Filtro por tipo de movimiento
      if (tipoMovimiento === 'todos') return true;
      if (tipoMovimiento === 'ventasNC') return m.origen === 'ventas';
      if (tipoMovimiento === 'retiros') return m.origen === 'retiros';
      if (tipoMovimiento === 'ingresos') return m.origen === 'ingresos';
      if (tipoMovimiento === 'apertura') return m.origen === 'caja' && m.estado === 'abierta';
      if (tipoMovimiento === 'cierre') return m.origen === 'caja' && m.estado === 'cerrada';
      return true;
    })
    .filter(m => {
      // Filtro por tipo de retiro
      if (tipoMovimiento !== 'retiros' || tipoRetiro === 'todos') return true;
      return m.tipo === tipoRetiro;
    })
    .filter(m => {
      if (tipoMovimiento !== 'ingresos' || tipoIngreso === 'todos') return true;
      return m.tipo === tipoIngreso;
    })
    .filter(m => {
      // Filtro por método de pago
      if (tipoMovimiento !== 'ventasNC' && tipoMovimiento !== 'todos') return true;
      if (metodoPago === 'todos') return true;
      return m.tipoPago?.includes(metodoPago);
    })
    .filter(m => {
      // Filtro por categoría de producto
      if (filtroActivo === 'todos') return true;
      if (m.origen !== 'ventas') return true;
      const productosVenta = m.productos?.map(p => p.productoId || p.id) || [];
      return productosVenta.some(pid => {
        const prod = productos.find(p => p.id === pid);
        return prod?.filtro === filtroActivo;
      });
    })
    .filter(m => {
      // Filtro por productos seleccionados
      if (tipoMovimiento !== 'ventasNC' || productosSeleccionados.length === 0) return true;
      const productosVenta = m.productos?.map(p => p.productoId || p.id) || [];
      return productosVenta.some(pid => productosSeleccionados.includes(pid));
    })
    .filter(m => {
      // Filtro por facturación
      if (tipoMovimiento !== 'ventasNC' && tipoMovimiento !== 'todos') return true;
      if (facturaFilter === 'facturadas') return !!m.cae;
      if (facturaFilter === 'sinFacturar') return !m.cae;
      return true;
    })
    ;

  // ==== PASO 4: Calcular resumen ====
  const ventasNormales = movimientosFiltrados
    .filter(m => m.origen === 'ventas' && m.tipoVenta !== 'notaCredito' && !(m.tipoVenta === 'mixta' && m.diferencia < 0))
    .reduce((sum, m) => sum + (m.total || m.diferencia || 0), 0);

  const notasCredito = movimientosFiltrados
    .filter(m => m.tipoVenta === 'notaCredito' || (m.tipoVenta === 'mixta' && m.diferencia < 0))
    .reduce((sum, m) => sum + Math.abs(m.total || m.diferencia || 0), 0);

  const retirosTotal = movimientosFiltrados
    .filter(m => m.origen === 'retiros')
    .reduce((sum, m) => sum + m.monto, 0);

  const ingresosTotal = movimientosFiltrados
    .filter(m => m.origen === 'ingresos')
    .reduce((sum, m) => sum + m.monto, 0);

  const totalDescuentos = movimientosFiltrados
    .filter(m => m.origen === 'ventas')
    .reduce((sum, m) => {
      if (!m.pagos) return sum;
      const base = m.diferencia > 0 ? m.diferencia : m.total || 0;
      return sum + m.pagos.reduce((s, p) => {
        if (!p.descuentoTipo || !p.descuentoValor) return s;
        return s + (p.descuentoTipo === 'porcentaje' ? base * p.descuentoValor / 100 : p.descuentoValor);
      }, 0);
    }, 0);

  const notaCreditoDescuento = movimientosFiltrados
    .filter(m => m.origen === 'ventas')
    .reduce((sum, m) => sum + (m.notaCreditoDescuento || 0), 0);

  const balance = ventasNormales - notasCredito - notaCreditoDescuento + ingresosTotal - retirosTotal;

  // ==== PASO 8: Detalle expandible ====
  const toggleFila = (id) => {
    setFilasExpandidas(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // ==== Exportar a Excel ====
  const exportarExcel = async () => {
    // Cargar tipos de retiro personalizados
    const TIPOS_FIJOS = ['cajaRoja', 'gasto', 'retiroCaro', 'retiroFede', 'errorMP', 'errorDNI', 'errorTJ'];
    const tiposPersonalizados = {};
    try {
      const tiposSnapshot = await getDocs(collection(db, 'tiposRetiro'));
      tiposSnapshot.docs.forEach(doc => {
        tiposPersonalizados[doc.id] = doc.data().nombre;
      });
    } catch (e) {
      console.log('No se pudieron cargar tipos de retiro personalizados');
    }

    const datos = movimientosFiltrados.map(m => {
      let tipo = '';
      let detalle = '';
      let monto = 0;
      
      if (m.origen === 'ventas') {
        const esNotaCredito = m.tipoVenta === 'notaCredito' || (m.tipoVenta === 'mixta' && m.diferencia < 0);
        tipo = esNotaCredito ? 'Nota Crédito' : 'Venta';
        detalle = m.productos?.map(p => `${p.nombre} x${p.cantidad}`).join(', ');
        monto = (m.pagos?.some(p => p.descuentoTipo)
          ? m.pagos.reduce((s, p) => s + (p.monto || 0), 0)
          : (m.total ?? (m.diferencia > 0 ? m.diferencia : m.totalNotaCredito || 0)));
      } else if (m.origen === 'retiros') {
        // Determinar nombre del tipo: si es fijo usar mapeo, si es personalizado buscar en Firestore
        let nombreTipo = m.tipo;
        if (!TIPOS_FIJOS.includes(m.tipo)) {
          // Es un tipo personalizado, buscar nombre
          nombreTipo = tiposPersonalizados[m.tipo] || m.tipo;
        }
        // Formatear nombre: "retiroCaro" -> "Retiro Caro"
        const tipoFormateado = nombreTipo
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        tipo = tipoFormateado;
        detalle = m.observacion || '-';
        monto = -m.monto;
      } else if (m.origen === 'ingresos') {
        const tiposIngresoFijos = [
          { id: 'ventaDirecta', nombre: 'Venta Directa' },
          { id: 'deposito', nombre: 'Depósito' },
          { id: 'otroIngreso', nombre: 'Otro Ingreso' },
        ];
        const fijo = tiposIngresoFijos.find(t => t.id === m.tipo);
        if (fijo) {
          tipo = fijo.nombre;
        } else {
          tipo = tiposIngresoPersonalizados[m.tipo]?.nombre || m.tipo;
        }
        detalle = m.observacion || '-';
        monto = m.monto;
      } else {
        tipo = m.estado === 'abierta' ? 'Apertura' : 'Cierre';
        detalle = `Saldo: $${m.saldoApertura || m.saldoCierre || 0}`;
        monto = m.estado === 'cerrada' ? (m.saldoCierre || 0) : (m.saldoApertura || 0);
      }
      
      const fecha = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha || m.hora);
      
      return {
        Fecha: fecha.toLocaleDateString('es-AR'),
        Hora: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        Tipo: tipo,
        Negocio: (m.negocio || m.sucursal || '-').charAt(0).toUpperCase() + (m.negocio || m.sucursal || '-').slice(1),
        Detalle: detalle,
        Monto: monto,
        'Método de Pago': m.tipoPago?.join(', ') || '-',
        'CAE': m.cae || '-',
        'N° Factura': m.cae ? `${String(m.facturaPtoVta || 9).padStart(4, '0')}-${String(m.facturaNumero).padStart(8, '0')}` : '-',
        'Tipo Factura': m.facturaTipo || '-',
        'Neto': m.cae ? m.facturaNeto : '-',
        'IVA': m.cae ? m.facturaIva : '-',
        Usuario: m.usuarioNombre || '-'
      };
    });

    // Crear workbook y escribir
    const ws = XLSX.utils.json_to_sheet(datos);
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 12 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 18 }, // Tipo
      { wch: 12 }, // Negocio
      { wch: 45 }, // Detalle
      { wch: 12 }, // Monto
      { wch: 15 }, // Método
      { wch: 18 }, // CAE
      { wch: 16 }, // N° Factura
      { wch: 14 }, // Tipo Factura
      { wch: 12 }, // Neto
      { wch: 10 }, // IVA
      { wch: 25 }, // Usuario
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reportes');
    
    // Descargar archivo
    const nombreArchivo = `reporte_${fechaDesde}_${fechaHasta}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-soft border border-yellow-line text-yellow px-4 py-3 rounded">
          {restriction.message || 'Solo los gerentes pueden ver reportes desde PC'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Reportes</h2>
        <div className="flex gap-2">
          {retirosPendientes > 0 && (
            <button
              onClick={migrarRetiros}
              disabled={migrando}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 text-sm disabled:opacity-50"
            >
              {migrando ? 'Migrando...' : `⚠️ Actualizar ${retirosPendientes} retiros old`}
            </button>
          )}
          {cajasPendientes > 0 && (
            <button
              onClick={migrarCajas}
              disabled={migrandoCajas}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 text-sm disabled:opacity-50"
            >
              {migrandoCajas ? 'Migrando...' : `⚠️ Actualizar ${cajasPendientes} cajas old`}
            </button>
          )}
        </div>
      </div>

      <FiltrosReportes
        fechaDesde={fechaDesde} setFechaDesde={setFechaDesde}
        fechaHasta={fechaHasta} setFechaHasta={setFechaHasta}
        tipoMovimiento={tipoMovimiento} setTipoMovimiento={setTipoMovimiento}
        tipoRetiro={tipoRetiro} setTipoRetiro={setTipoRetiro}
        tipoIngreso={tipoIngreso} setTipoIngreso={setTipoIngreso}
        metodoPago={metodoPago} setMetodoPago={setMetodoPago}
        facturaFilter={facturaFilter} setFacturaFilter={setFacturaFilter}
        productosSeleccionados={productosSeleccionados} toggleProducto={toggleProducto} limpiarProductos={limpiarProductos}
        busquedaProducto={busquedaProducto} setBusquedaProducto={setBusquedaProducto}
        productos={productos}
        cargarMovimientos={cargarMovimientos} loading={loading}
        movimientosFiltrados={movimientosFiltrados} exportarExcel={exportarExcel}
        scanError={scanError}
        flashGreenId={flashGreenId}
        filtroActivo={filtroActivo} setFiltroActivo={setFiltroActivo}
        filtrosUnicos={filtrosUnicos}
      />

      {movimientosFiltrados.length > 0 && (
        <ResumenReportes ventasNormales={ventasNormales} notasCredito={notasCredito} notaCreditoDescuento={notaCreditoDescuento} retirosTotal={retirosTotal} ingresosTotal={ingresosTotal} totalDescuentos={totalDescuentos} balance={balance} />
      )}

      {movimientosFiltrados.length > 0 && (
        <TablaReportes movimientosFiltrados={movimientosFiltrados} filasExpandidas={filasExpandidas} toggleFila={toggleFila} tiposRetiroPersonalizados={tiposRetiroPersonalizados} tiposIngresoPersonalizados={tiposIngresoPersonalizados} onReimprimirTicket={imprimirTicketCajaCerrada} />
      )}

      {movimientosFiltrados.length === 0 && movimientos.length > 0 && (
        <EmptyState title="No hay movimientos con los filtros seleccionados" icon="🔍" />
      )}

      {movimientos.length === 0 && !loading && fechaDesde && fechaHasta && (
        <EmptyState title="No hay movimientos en el período seleccionado" icon="📅" />
      )}

      {!fechaDesde && !fechaHasta && (
        <p className="text-center py-8 text-muted">Seleccioná un rango de fechas para buscar</p>
      )}
      <VarianteSelector
        open={varianteModal !== null}
        productos={varianteModal || []}
        onSeleccionar={handleVariantSelect}
        onCancel={() => setVarianteModal(null)}
      />
    </Layout>
  );
};

export default ReportesPage;