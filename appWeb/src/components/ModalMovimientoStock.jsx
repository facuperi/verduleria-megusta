import { useState, useEffect, useCallback } from 'react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { VarianteSelector } from './VarianteSelector';
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../contexts/ToastContext';
import { LoadingSkeleton } from './LoadingSkeleton';
import { formatNum } from '../utils/format';
import { useScaleInput } from '../hooks/useScaleInput';

const esKg = (tipo) => tipo === 'pesableConStock';
const hoy = () => new Date().toISOString().split('T')[0];
const hace30dias = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

export const ModalMovimientoStock = ({ open, onClose, productos, onProductosActualizados }) => {
  const { showToast } = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [varianteModal, setVarianteModal] = useState(null);
  const [fechaDesde, setFechaDesde] = useState(hace30dias());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [filtroProductoHistorial, setFiltroProductoHistorial] = useState('');
  const [historialLimit, setHistorialLimit] = useState(10);
  const [scaleEditId, setScaleEditId] = useState(null);
  const [scaleGrams, setScaleGrams] = useState(0);
  const [editCantIdx, setEditCantIdx] = useState(null);
  const [editCantVal, setEditCantVal] = useState('');

  const handlePesoKeyDown = useCallback((e) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      setScaleGrams(prev => Math.min(prev * 10 + parseInt(e.key), 9999999));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setScaleGrams(prev => Math.floor(prev / 10));
    } else if (e.key === 'Enter') {
      document.activeElement?.blur();
    }
  }, []);

  const cargarHistorial = async (nuevoLimit) => {
    setCargandoHistorial(true);
    try {
      const condiciones = [orderBy('fecha', 'desc'), limit(nuevoLimit || historialLimit)];
      if (fechaDesde) condiciones.unshift(where('fecha', '>=', `${fechaDesde}T00:00:00.000Z`));
      if (fechaHasta) condiciones.unshift(where('fecha', '<=', `${fechaHasta}T23:59:59.999Z`));
      const snapshot = await getDocs(query(collection(db, 'movimientosStock'), ...condiciones));
      setHistorial(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setLista([]);
      setBusqueda('');
      setHistorialLimit(10);
      setFechaDesde(hace30dias());
      setFechaHasta(hoy());
      setFiltroProductoHistorial('');
      return;
    }
    cargarHistorial(10);
  }, [open]);

  useBarcodeScanner((codigo) => {
    if (!open) return;
    const matches = productos.filter(p => p.tipo !== 'pesable' && p.codigoBarras === codigo);
    if (matches.length === 1) {
      agregarALista(matches[0]);
      showToast(`${matches[0].nombre} agregado`, 'success');
    } else if (matches.length > 1) {
      setVarianteModal(matches);
    } else {
      setScanError(codigo);
      setTimeout(() => setScanError(null), 4000);
    }
  });

  const handleVariantSelect = (producto) => {
    setVarianteModal(null);
    agregarALista(producto);
    showToast(`${producto.nombre} agregado`, 'success');
  };

  if (!open) return null;

  const productosGestionables = productos.filter(p => p.tipo !== 'pesable');

  const resultados = busqueda
    ? productosGestionables.filter(p =>
        p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigoBarras?.includes(busqueda)
      )
    : [];

  const agregarALista = (producto) => {
    const existente = lista.find(p => p.id === producto.id);
    if (existente) {
      const inc = esKg(producto.tipo) ? 0.001 : 1;
      setLista(lista.map(p =>
        p.id === producto.id ? { ...p, cantidad: p.cantidad + inc } : p
      ));
    } else {
      setLista([...lista, { id: producto.id, nombre: producto.nombre, cantidad: 0, tipo: producto.tipo, signo: 'sumar' }]);
    }
    setBusqueda('');
  };

  const toggleSigno = (id) => {
    setLista(lista.map(p =>
      p.id === id ? { ...p, signo: p.signo === 'sumar' ? 'restar' : 'sumar' } : p
    ));
  };

  const cambiarCantidad = (id, valor) => {
    setLista(lista.map(p =>
      p.id === id ? { ...p, cantidad: esKg(p.tipo) ? (parseFloat(valor) || 0) : (parseInt(valor) || 0) } : p
    ));
  };

  const quitarDeLista = (id) => {
    setLista(lista.filter(p => p.id !== id));
  };

  const confirmarMovimiento = async () => {
    if (lista.length === 0) {
      showToast('Agregá al menos un producto', 'warning');
      return;
    }
    const hayCero = lista.some(item => item.cantidad === 0 || item.cantidad === '0');
    if (hayCero) {
      showToast('⚠️ No podés mover 0 unidades. Ingresá una cantidad válida.', 'warning');
      return;
    }
    setProcesando(true);
    try {
      for (const item of lista) {
        const producto = productos.find(p => p.id === item.id);
        const cambio = item.signo === 'sumar' ? item.cantidad : -item.cantidad;
        const stockActual = producto.stock || 0;
        const nuevoStock = stockActual + cambio;

        await updateDoc(doc(db, 'productos', item.id), {
          stock: parseFloat(nuevoStock.toFixed(3)),
          fechaActualizado: new Date().toISOString(),
        });

        const stockAnterior = producto.stock || 0;
        const stockResultante = parseFloat((stockAnterior + cambio).toFixed(3));

        await addDoc(collection(db, 'movimientosStock'), {
          tipo: item.signo === 'sumar' ? 'ingreso' : 'egreso',
          productoId: item.id,
          productoNombre: producto.nombre,
          cantidad: item.cantidad,
          signo: item.signo,
          stockAnterior,
          stockResultante,
          origen: 'manual',
          realizadoPor: 'gerente',
          fecha: new Date().toISOString(),
        });
      }

      if (onProductosActualizados) await onProductosActualizados();
      setLista([]);
      cargarHistorial(historialLimit);
      showToast('Movimiento realizado correctamente', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al realizar movimiento', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const historialFiltrado = filtroProductoHistorial
    ? historial.filter(m =>
        m.productoNombre?.toLowerCase().includes(filtroProductoHistorial.toLowerCase())
      )
    : historial;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-lg w-full mx-4 max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-4 text-center">
          <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            📦 Movimiento de Stock
          </h2>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto">
          {/* Buscador */}
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Buscar Producto</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Código de barras o nombre..."
              className="w-full border border-line-input bg-input text-body p-2 rounded"
              autoFocus
            />
            {scanError && (
              <div className="mt-2 p-2 bg-red-soft text-red text-sm rounded flex items-center gap-1 font-semibold">
                ⚠️ Código <strong>{scanError}</strong> no encontrado en la base de datos
              </div>
            )}
            {busqueda && (
              <div className="max-h-36 overflow-y-auto border border-line mt-1 rounded">
                {resultados.length === 0 ? (
                  <p className="p-2 text-sm text-muted">Sin resultados</p>
                ) : (
                  resultados.map(p => (
                    <div
                      key={p.id}
                      onClick={() => agregarALista(p)}
                      className="p-2 hover:bg-elevated cursor-pointer border-b border-line text-sm flex justify-between"
                    >
                      <span>{p.nombre}</span>
                      <span className="text-xs text-muted">
                        Stock: {esKg(p.tipo) ? `${formatNum(p.stock || 0, 3)} kg` : (p.stock || 0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Lista de productos a mover */}
          {lista.length > 0 && (
            <div className="mb-4 border border-line rounded p-3">
              <p className="text-sm font-bold mb-2">Productos a mover:</p>
              {lista.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1 border-b border-line text-sm">
                  <span className="truncate w-28">{item.nombre}</span>
                  <button
                    onClick={() => toggleSigno(item.id)}
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      item.signo === 'sumar' ? 'bg-green-soft text-green' : 'bg-red-soft text-red'
                    }`}
                  >
                    {item.signo === 'sumar' ? '+ Ingreso' : '– Egreso'}
                  </button>
                  {esKg(item.tipo) ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={scaleEditId === item.id ? (scaleGrams / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : Number(item.cantidad || 0).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                      onFocus={() => { setScaleEditId(item.id); setScaleGrams(Math.round((item.cantidad || 0) * 1000)); }}
                      onKeyDown={handlePesoKeyDown}
                      onBlur={() => {
                        if (scaleEditId === item.id) {
                          cambiarCantidad(item.id, scaleGrams / 1000);
                          setScaleEditId(null);
                        }
                      }}
                      className="w-16 border border-line-input bg-input text-body p-1 rounded text-center text-xs"
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editCantIdx === item.id ? editCantVal : (item.cantidad === 0 ? '' : Number(item.cantidad).toLocaleString('es-AR'))}
                      onFocus={() => {
                        setEditCantIdx(item.id);
                        setEditCantVal(item.cantidad === 0 ? '' : String(item.cantidad));
                      }}
                      onChange={(e) => {
                        let v = e.target.value;
                        setEditCantVal(v);
                        const parsed = parseInt(v.replace(/\./g, ''), 10);
                        cambiarCantidad(item.id, isNaN(parsed) ? 0 : parsed);
                      }}
                      onBlur={() => setEditCantIdx(null)}
                      className="w-16 border border-line-input bg-input text-body p-1 rounded text-center text-xs"
                    />
                  )}
                  {esKg(item.tipo) && <span className="text-xs text-muted w-6">kg</span>}
                  <button onClick={() => quitarDeLista(item.id)} className="text-red ml-1">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Botones acción */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={confirmarMovimiento}
              disabled={procesando || lista.length === 0}
              className="bg-indigo-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50 font-semibold"
            >
              {procesando ? 'Procesando...' : `💾 Confirmar Movimiento (${lista.length})`}
            </button>
            <button onClick={onClose} disabled={procesando} className="bg-surface px-4 py-2 rounded">
              Cancelar
            </button>
          </div>

          {/* Historial */}
          <div className="border-t border-line pt-3">
            <h4 className="text-sm font-bold mb-2">Historial de movimientos</h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
              <div>
                <label className="block text-xs text-muted mb-0.5">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full border border-line-input bg-input text-body p-1.5 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-0.5">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full border border-line-input bg-input text-body p-1.5 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-0.5">Producto</label>
                <input
                  type="text"
                  value={filtroProductoHistorial}
                  onChange={(e) => setFiltroProductoHistorial(e.target.value)}
                  placeholder="Filtrar por nombre..."
                  className="w-full border border-line-input bg-input text-body p-1.5 rounded text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setHistorialLimit(10); cargarHistorial(10); }}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs w-full hover:bg-indigo-700"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {cargandoHistorial ? (
              <LoadingSkeleton type="table" rows={3} />
            ) : historialFiltrado.length === 0 ? (
              <p className="text-xs text-muted">Sin movimientos en este período</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="text-left py-1 pr-2">Fecha</th>
                        <th className="text-left py-1 pr-2">Producto</th>
                        <th className="text-center py-1 pr-2">Cant</th>
                        <th className="text-center py-1 pr-2">Stock Ant.</th>
                        <th className="text-center py-1 pr-2">Stock Res.</th>
                        <th className="text-left py-1">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialFiltrado.map(m => (
                        <tr key={m.id} className="border-b border-line">
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-1 pr-2">{m.productoNombre}</td>
                          <td className={`py-1 pr-2 text-center font-semibold ${(m.signo === 'sumar' || m.tipo === 'ingreso') ? 'text-green' : 'text-red'}`}>
                            {(m.signo === 'sumar' || m.tipo === 'ingreso') ? '+' : '-'}{m.cantidad}
                          </td>
                          <td className="py-1 pr-2 text-center text-muted">{m.stockAnterior ?? '-'}</td>
                          <td className="py-1 pr-2 text-center font-semibold">{m.stockResultante ?? '-'}</td>
                          <td className="py-1">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              m.tipo === 'ingreso' ? 'bg-green-soft text-green' : m.tipo === 'egreso' ? 'bg-red-soft text-red' : 'bg-purple-soft text-purple'
                            }`}>
                              {m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'egreso' ? 'Egreso' : 'Corrección'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => {
                    const nuevo = historialLimit + 10;
                    setHistorialLimit(nuevo);
                    cargarHistorial(nuevo);
                  }}
                  className="mt-2 text-indigo-600 text-xs hover:underline w-full text-center py-1"
                >
                  Cargar más...
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <VarianteSelector
        open={varianteModal !== null}
        productos={varianteModal || []}
        onSeleccionar={handleVariantSelect}
        onCancel={() => setVarianteModal(null)}
      />
    </div>
  );
};
