import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, getDoc, updateDoc, doc } from "firebase/firestore";
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';
import { FiltrosReportes } from '../components/FiltrosReportes';
import { ResumenReportes } from '../components/ResumenReportes';
import { TablaReportes } from '../components/TablaReportes';
import { imprimirTicketCajaCerrada } from '../utils/ticketPrinter';

export const ReportesPage = () => {
  const { isGerente } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();

  // ==== PASO 1: Estados base ====
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [negocio, setNegocio] = useState('todos');
  const [tipoMovimiento, setTipoMovimiento] = useState('todos');
  const [tipoRetiro, setTipoRetiro] = useState('todos');
  const [metodoPago, setMetodoPago] = useState('todos');
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filasExpandidas, setFilasExpandidas] = useState({});
  const [retirosPendientes, setRetirosPendientes] = useState(0);
  const [migrando, setMigrando] = useState(false);
  const [migrandoCajas, setMigrandoCajas] = useState(false);
  const [cajasPendientes, setCajasPendientes] = useState(0);
  const [tiposRetiroPersonalizados, setTiposRetiroPersonalizados] = useState({});
  const [productos, setProductos] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarSelectorProductos, setMostrarSelectorProductos] = useState(false);
  const [facturaFilter, setFacturaFilter] = useState('todos');

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
      const retirosSinNegocio = retiros.filter(r => !r.negocio);
      
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
            await updateDoc(doc(db, 'retirosCaja', retiro.id), {
              negocio: cajaData.sucursal
            });
            actualizados++;
          }
        }
      }
      
      showToast(`Se actualizaron ${actualizados} retiros`, 'success');
      setRetirosPendientes(0);
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

        const ventasEfectivo = ventasNormales.filter(v => v.tipoPago?.includes('efectivo')).reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
        const ventasTarjeta = ventasNormales.filter(v => v.tipoPago?.includes('tarjeta')).reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
        const ventasDebito = ventasNormales.filter(v => v.tipoPago?.includes('debito')).reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
        const ventasMercadoPago = ventasNormales.filter(v => v.tipoPago?.includes('mercadopago')).reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);
        const ventasCuentaDNI = ventasNormales.filter(v => v.tipoPago?.includes('cuentadni')).reduce((sum, v) => sum + (v.diferencia > 0 ? v.diferencia : v.total), 0);

        const ventaNeta = montoVentasNormales - montoNotasCredito;
        const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
        const retiros = retirosSnapshot.docs.map(d => d.data()).filter(r => r.cajaId === caja.id);
        const totalRetiros = retiros.reduce((sum, r) => sum + r.monto, 0);
        const efectivoCaja = (caja.saldoApertura || 0) + ventasEfectivo - totalRetiros;
        const saldoSistema = efectivoCaja;
        const diferencia = (caja.saldoCierre || 0) - saldoSistema;

        await updateDoc(doc(db, 'caja', caja.id), {
          ventasBrutas: montoVentasNormales,
          notaCreditoTotal: montoNotasCredito,
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

      showToast(`Se actualizaron ${actualizadas} cajas`, 'success');
      setCajasPendientes(0);
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
      const sinNegocio = retiros.filter(r => !r.negocio).length;
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

      // 3. Cargar cajas (aperturas/cierres)
      const cajaSnapshot = await getDocs(collection(db, 'caja'));
      let cajaData = cajaSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), origen: 'caja' }))
        .filter(c => esFechaEnRango(c.fecha));

      // Unir todo
      const todos = [...ventasData, ...retirosData, ...cajaData];
      
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

  const movimientosFiltrados = movimientos
    .filter(m => {
      // Filtro por negocio
      if (negocio === 'todos') return true;
      return m.negocio === negocio || m.sucursal === negocio;
    })
    .filter(m => {
      // Filtro por tipo de movimiento
      if (tipoMovimiento === 'todos') return true;
      if (tipoMovimiento === 'ventas') return m.origen === 'ventas' && m.tipoVenta !== 'notaCredito' && !(m.tipoVenta === 'mixta' && m.diferencia < 0);
      if (tipoMovimiento === 'notasCredito') return m.tipoVenta === 'notaCredito' || (m.tipoVenta === 'mixta' && m.diferencia < 0);
      if (tipoMovimiento === 'retiros') return m.origen === 'retiros';
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
      // Filtro por método de pago
      if (tipoMovimiento !== 'ventas' && tipoMovimiento !== 'todos') return true;
      if (metodoPago === 'todos') return true;
      return m.tipoPago?.includes(metodoPago);
    })
    .filter(m => {
      // Filtro por productos seleccionados
      if (tipoMovimiento !== 'ventas' || productosSeleccionados.length === 0) return true;
      const productosVenta = m.productos?.map(p => p.productoId || p.id) || [];
      return productosVenta.some(pid => productosSeleccionados.includes(pid));
    })
    .filter(m => {
      // Filtro por facturación
      if (tipoMovimiento !== 'ventas' && tipoMovimiento !== 'todos') return true;
      if (facturaFilter === 'facturadas') return !!m.cae;
      if (facturaFilter === 'sinFacturar') return !m.cae;
      return true;
    });

  // ==== PASO 4: Calcular resumen ====
  const ventasNormales = movimientosFiltrados
    .filter(m => m.origen === 'ventas' && m.tipoVenta !== 'notaCredito' && !(m.tipoVenta === 'mixta' && m.diferencia < 0))
    .reduce((sum, m) => sum + (m.diferencia > 0 ? m.diferencia : m.total), 0);

  const notasCredito = movimientosFiltrados
    .filter(m => m.tipoVenta === 'notaCredito' || (m.tipoVenta === 'mixta' && m.diferencia < 0))
    .reduce((sum, m) => sum + Math.abs(m.diferencia || m.total), 0);

  const retirosTotal = movimientosFiltrados
    .filter(m => m.origen === 'retiros')
    .reduce((sum, m) => sum + m.monto, 0);

  const balance = ventasNormales - notasCredito - retirosTotal;

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
        monto = m.diferencia > 0 ? m.diferencia : m.total;
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
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
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
        negocio={negocio} setNegocio={setNegocio}
        tipoMovimiento={tipoMovimiento} setTipoMovimiento={setTipoMovimiento}
        tipoRetiro={tipoRetiro} setTipoRetiro={setTipoRetiro}
        metodoPago={metodoPago} setMetodoPago={setMetodoPago}
        facturaFilter={facturaFilter} setFacturaFilter={setFacturaFilter}
        productosSeleccionados={productosSeleccionados} toggleProducto={toggleProducto} limpiarProductos={limpiarProductos}
        busquedaProducto={busquedaProducto} setBusquedaProducto={setBusquedaProducto}
        mostrarSelectorProductos={mostrarSelectorProductos} setMostrarSelectorProductos={setMostrarSelectorProductos}
        productos={productos}
        cargarMovimientos={cargarMovimientos} loading={loading}
        movimientosFiltrados={movimientosFiltrados} exportarExcel={exportarExcel}
      />

      {movimientosFiltrados.length > 0 && (
        <ResumenReportes ventasNormales={ventasNormales} notasCredito={notasCredito} retirosTotal={retirosTotal} balance={balance} />
      )}

      {movimientosFiltrados.length > 0 && (
        <TablaReportes movimientosFiltrados={movimientosFiltrados} filasExpandidas={filasExpandidas} toggleFila={toggleFila} tiposRetiroPersonalizados={tiposRetiroPersonalizados} onReimprimirTicket={imprimirTicketCajaCerrada} />
      )}

      {movimientosFiltrados.length === 0 && movimientos.length > 0 && (
        <p className="text-center py-8 text-gray-500">No hay movimientos con los filtros seleccionados</p>
      )}

      {movimientos.length === 0 && !loading && fechaDesde && fechaHasta && (
        <p className="text-center py-8 text-gray-500">No hay movimientos en el período seleccionado</p>
      )}

      {!fechaDesde && !fechaHasta && (
        <p className="text-center py-8 text-gray-500">Seleccioná un rango de fechas para buscar</p>
      )}
    </Layout>
  );
};

export default ReportesPage;