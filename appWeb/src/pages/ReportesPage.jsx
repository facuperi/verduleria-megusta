import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, getDoc, updateDoc, doc } from "firebase/firestore";
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

const TIPOS_RETIRO = [
  { id: 'cajaRoja', nombre: 'Caja roja', icono: '💰' },
  { id: 'gasto', nombre: 'Gasto', icono: '🧹' },
  { id: 'retiroCaro', nombre: 'Retiro Caro', icono: '👔' },
  { id: 'retiroFede', nombre: 'Retiro Fede', icono: '👔' },
  { id: 'errorMP', nombre: 'Error MP', icono: '⚠️' },
  { id: 'errorDNI', nombre: 'Error DNI', icono: '⚠️' },
  { id: 'errorTJ', nombre: 'Error TJ', icono: '⚠️' },
];

const TIPOS_MOVIMIENTO = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'ventas', nombre: 'Ventas' },
  { id: 'notasCredito', nombre: 'Notas de Crédito' },
  { id: 'retiros', nombre: 'Retiros' },
  { id: 'apertura', nombre: 'Apertura de Caja' },
  { id: 'cierre', nombre: 'Cierre de Caja' },
];

const NEGOCIOS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'chiclana', nombre: 'Chiclana' },
  { id: 'belgrano', nombre: 'Belgrano' },
];

const METODOS_PAGO = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'MercadoPago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

export const ReportesPage = () => {
  const { isGerente } = useAuth();
  const { isMobile } = useDevice();

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
  const [tiposRetiroPersonalizados, setTiposRetiroPersonalizados] = useState({});

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
        alert('No hay retiros para migrar');
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
      
      alert(`Se actualizaron ${actualizados} retiros`);
      setRetirosPendientes(0);
    } catch (err) {
      console.error('Error al migrar:', err);
      alert('Error al migrar retiros');
    } finally {
      setMigrando(false);
    }
  };

  // ==== Verificar retiros pendientes al inicio ====
  useEffect(() => {
    const verificarRetiros = async () => {
      const retirosSnapshot = await getDocs(collection(db, 'retirosCaja'));
      const retiros = retirosSnapshot.docs.map(doc => doc.data());
      const sinNegocio = retiros.filter(r => !r.negocio).length;
      setRetirosPendientes(sinNegocio);
    };
    if (canAccess) {
      verificarRetiros();
    }
  }, [canAccess]);

  // ==== PASO 2: Función de carga de datos ====
  const cargarMovimientos = async () => {
    if (!fechaDesde || !fechaHasta) {
      alert('Seleccioná fecha desde y hasta');
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
      alert('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // ==== PASO 3: Aplicar filtros secundarios ====
  const aplicarFiltros = (data) => {
    // Esta función se llama internamente para filtrar
    // Se aplica en el render
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
        {retirosPendientes > 0 && (
          <button
            onClick={migrarRetiros}
            disabled={migrando}
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 text-sm disabled:opacity-50"
          >
            {migrando ? 'Migrando...' : `⚠️ Actualizar ${retirosPendientes} retiros old`}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Negocio</label>
            <select
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
              className="w-full border p-2 rounded"
            >
              {NEGOCIOS.map(n => (
                <option key={n.id} value={n.id}>{n.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Tipo Movimiento</label>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              className="w-full border p-2 rounded"
            >
              {TIPOS_MOVIMIENTO.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          
          {/* Filtro secundario: Tipo de retiro */}
          {tipoMovimiento === 'retiros' && (
            <div>
              <label className="block text-sm font-semibold mb-1">Tipo Retiro</label>
              <select
                value={tipoRetiro}
                onChange={(e) => setTipoRetiro(e.target.value)}
                className="w-full border p-2 rounded"
              >
                <option value="todos">Todos</option>
                {TIPOS_RETIRO.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Filtro secundario: Método de pago */}
          {(tipoMovimiento === 'ventas' || tipoMovimiento === 'todos') && (
            <div>
              <label className="block text-sm font-semibold mb-1">Método Pago</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full border p-2 rounded"
              >
                {METODOS_PAGO.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={cargarMovimientos}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Buscar'}
          </button>
          {movimientosFiltrados.length > 0 && (
            <button
              onClick={exportarExcel}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            >
              📊 Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* ==== RESUMEN (Paso 4) ==== */}
      {movimientosFiltrados.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-700">Ventas Normales</p>
            <p className="text-2xl font-bold text-green-600">${ventasNormales.toLocaleString('es-AR')}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-700">Notas de Crédito</p>
            <p className="text-2xl font-bold text-red-600">-${notasCredito.toLocaleString('es-AR')}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-700">Retiros</p>
            <p className="text-2xl font-bold text-orange-600">-${retirosTotal.toLocaleString('es-AR')}</p>
          </div>
          <div className={`p-4 rounded-lg border ${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-sm text-gray-700">Balance Neto</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
              ${balance.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      )}

      {/* Resultados */}
      {movimientosFiltrados.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Hora</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Negocio</th>
                  <th className="px-4 py-2 text-left">Detalle</th>
                  <th className="px-4 py-2 text-right">Monto</th>
                  <th className="px-4 py-2 text-left">Método</th>
                  <th className="px-4 py-2 text-left">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map(m => {
                  let tipo = '';
                  let detalle = '';
                  let monto = 0;
                  let colorFila = '';

                  if (m.origen === 'ventas') {
                    const esNotaCredito = m.tipoVenta === 'notaCredito' || (m.tipoVenta === 'mixta' && m.diferencia < 0);
                    tipo = esNotaCredito ? 'Nota Crédito' : 'Venta';
                    detalle = m.productos?.map(p => `${p.nombre} x${p.cantidad}`).join(', ');
                    monto = m.diferencia > 0 ? m.diferencia : m.total;
                    colorFila = esNotaCredito ? 'bg-red-50' : 'bg-green-50';
                  } else if (m.origen === 'retiros') {
                    // Buscar nombre e icono del tipo de retiro
                    const tipoFijo = TIPOS_RETIRO.find(t => t.id === m.tipo);
                    const tipoPersonalizado = tiposRetiroPersonalizados[m.tipo];
                    let nombreTipo = '';
                    let iconoRetiro = '💸';
                    if (tipoFijo) {
                      nombreTipo = tipoFijo.nombre;
                      iconoRetiro = tipoFijo.icono;
                    } else if (tipoPersonalizado) {
                      nombreTipo = tipoPersonalizado.nombre;
                      iconoRetiro = tipoPersonalizado.icono || '💸';
                    } else {
                      // Fallback si no se encuentra
                      nombreTipo = m.tipo.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    }
                    tipo = `${iconoRetiro} ${nombreTipo}`;
                    detalle = m.observacion || '-';
                    monto = -m.monto;
                    colorFila = 'bg-orange-50';
                  } else {
                    tipo = m.estado === 'abierta' ? 'Apertura' : 'Cierre';
                    detalle = `Saldo: $${m.saldoApertura || m.saldoCierre || 0}`;
                    monto = m.estado === 'cerrada' ? (m.saldoCierre || 0) : (m.saldoApertura || 0);
                    colorFila = 'bg-blue-50';
                  }

                  const fecha = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha || m.hora);

                  return (
                    <React.Fragment key={m.id}>
                    <tr 
                      className={`border-t ${colorFila} cursor-pointer hover:opacity-90`}
                      onClick={() => toggleFila(m.id)}
                    >
                      <td className="px-4 py-2">
                        <button className="text-gray-500 hover:text-gray-700 mr-2">
                          {filasExpandidas[m.id] ? '▼' : '▶'}
                        </button>
                        {fecha.toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-2">{fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-2">{tipo}</td>
                      <td className="px-4 py-2 capitalize">{m.negocio || m.sucursal || '-'}</td>
                      <td className="px-4 py-2 max-w-xs truncate" title={detalle}>{detalle}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.abs(monto).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-2">{m.tipoPago?.join(', ') || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{m.usuarioNombre || '-'}</td>
                    </tr>
                    {filasExpandidas[m.id] && (
                      <tr key={`${m.id}-detalle`} className="border-t bg-gray-50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="text-sm">
                            <p className="font-semibold mb-2">Detalle completo:</p>
                            {m.origen === 'ventas' && m.productos && (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left">
                                    <th className="py-1">Producto</th>
                                    <th className="py-1">Cantidad</th>
                                    <th className="py-1">Precio</th>
                                    <th className="py-1">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.productos.map((p, idx) => (
                                    <tr key={idx} className="border-b">
                                      <td className="py-1">{p.nombre}</td>
                                      <td className="py-1">{p.cantidad}</td>
                                      <td className="py-1">${p.precio}</td>
                                      <td className="py-1">${(p.precio * p.cantidad).toLocaleString('es-AR')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {m.origen === 'retiros' && (
                              <p><strong>Tipo:</strong> {m.tipo} | <strong>Monto:</strong> ${m.monto} | <strong>Obs:</strong> {m.observacion || '-'}</p>
                            )}
                            {m.origen === 'caja' && (
                              <p>
                                <strong>Saldo Apertura:</strong> ${m.saldoApertura || 0} | 
                                <strong> Saldo Cierre:</strong> ${m.saldoCierre || 0} | 
                                <strong> Estado:</strong> {m.estado}
                              </p>
                            )}
                            {m.observacion && m.origen !== 'retiros' && (
                              <p className="mt-2"><strong>Observación:</strong> {m.observacion}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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