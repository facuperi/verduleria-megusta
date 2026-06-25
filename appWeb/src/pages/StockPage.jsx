import { useState, useEffect, useCallback } from 'react';
import { VarianteSelector } from '../components/VarianteSelector';
import { collection, getDocs, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice } from '../hooks/useDevice';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { Layout } from '../components/Layout';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { ModalMovimientoStock } from '../components/ModalMovimientoStock';
import { formatNum } from '../utils/format';


export const StockPage = () => {
  const { isGerente } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [sortField, setSortField] = useState('nombre');
  const [sortDir, setSortDir] = useState('asc');
  const [showMovimiento, setShowMovimiento] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [varianteModal, setVarianteModal] = useState(null);

  const [filtros, setFiltros] = useState([]);
  const [showNuevoFiltro, setShowNuevoFiltro] = useState(false);
  const [nombreNuevoFiltro, setNombreNuevoFiltro] = useState('');
  const [tieneCodigo, setTieneCodigo] = useState(false);
  const [showVarianteBaseSelector, setShowVarianteBaseSelector] = useState(false);
  const [busquedaVarianteBase, setBusquedaVarianteBase] = useState('');

  const [stockScaleGrams, setStockScaleGrams] = useState(0);
  const [stockScaleActive, setStockScaleActive] = useState(false);

  const handleStockScaleKeyDown = useCallback((e) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      setStockScaleGrams(prev => Math.min(prev * 10 + parseInt(e.key), 9999999));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setStockScaleGrams(prev => Math.floor(prev / 10));
    }
  }, []);

  const [formData, setFormData] = useState({
    tipo: 'noPesable',
    codigoBarras: '',
    nombre: '',
    precio: '',
    stock: 0,
    filtro: '',
  });

  const puedeEditar = isGerente && !isMobile;

  const resetForm = () => {
    setFormData({
      tipo: 'noPesable',
      codigoBarras: '',
      nombre: '',
      precio: '',
      stock: 0,
      filtro: '',
    });
    setTieneCodigo(false);
  };

  const esPesableConStock = (tipo) => tipo === 'pesableConStock';
  const esPesable = (tipo) => tipo === 'pesable' || tipo === 'pesableConStock';
  const esNoPesable = (tipo) => tipo === 'noPesable';
  const tipoDisplay = (t) => esPesable(t) ? 'Pesable' : 'No Pesable';
  const filtroLabel = (p) => p.filtro || ({ huevos: 'Huevos', lena: 'Leña', carbon: 'Carbón' })[p.tipo] || '—';

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const asegurarProductosDefecto = async () => {
    const defaults = [
      { id: 'lena_x5', data: { nombre: 'Leña x5', tipo: 'lena', precio: 0, stock: 0, filtro: 'Leña' } },
      { id: 'lena_x10', data: { nombre: 'Leña x10', tipo: 'lena', precio: 0, stock: 0, filtro: 'Leña' } },
      { id: 'carbon', data: { nombre: 'Carbón', tipo: 'carbon', precio: 0, stock: 0, filtro: 'Carbón' } },
      { id: 'huevos', data: { nombre: 'Huevos', tipo: 'huevos', stock: 0, filtro: 'Huevos' } },
    ];
    let creados = false;
    for (const prod of defaults) {
      const ref = doc(db, 'productos', prod.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, prod.data);
        creados = true;
      } else {
        const data = snap.data();
        const updates = {};
        if (!data.filtro) updates.filtro = prod.data.filtro;
        if (Object.keys(updates).length > 0) {
          await updateDoc(ref, updates);
          creados = true;
        }
      }
    }
    return creados;
  };

  const asegurarFiltrosDefecto = async () => {
    const defaults = ['Frutos secos', 'Quesos', 'Almacén'];
    try {
      const snapshot = await getDocs(collection(db, 'filtros'));
      const existentes = new Set(snapshot.docs.map(d => d.data().nombre));
      for (const nombre of defaults) {
        if (!existentes.has(nombre)) {
          await addDoc(collection(db, 'filtros'), { nombre });
        }
      }
    } catch (err) {
      console.warn('Error al asegurar filtros:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        await asegurarProductosDefecto();
        const prodSnap = await getDocs(collection(db, 'productos'));
        if (!cancelled) setProductos(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error cargando productos:', err);
      }
      try {
        await asegurarFiltrosDefecto();
        const filtrosSnap = await getDocs(collection(db, 'filtros'));
        const nombres = filtrosSnap.docs.map(d => d.data().nombre);
        if (!cancelled) setFiltros([...new Set(nombres)]);
      } catch (err) {
        console.warn('Error cargando filtros:', err);
      }
      if (!cancelled) setLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tieneCodigo && !formData.codigoBarras.trim()) {
      showToast('Debes ingresar un código de barras', 'error');
      setProcesando(false);
      return;
    }
    setProcesando(true);
    try {
      const oldTipo = editando?.tipo;
      let filtroFinal = formData.filtro || '';
      if (!filtroFinal) {
        filtroFinal = ({ huevos: 'Huevos', lena: 'Leña', carbon: 'Carbón' })[oldTipo] || '';
      }

      const data = {
        tipo: formData.tipo,
        nombre: formData.nombre.trim(),
        precio: parseFloat(formData.precio) || 0,
        filtro: filtroFinal,
        fechaActualizado: new Date().toISOString(),
      };

      data.codigoBarras = formData.codigoBarras.trim();
      if (!editando) {
        if (esPesableConStock(formData.tipo)) {
          data.stock = parseFloat(formData.stock) || 0;
        } else {
          data.stock = parseInt(formData.stock) || 0;
        }
      }

      if (editando) {
        await updateDoc(doc(db, 'productos', editando.id), data);
      } else {
        await addDoc(collection(db, 'productos'), data);
      }

      setShowModal(false);
      setEditando(null);
      resetForm();

      const snapshot = await getDocs(collection(db, 'productos'));
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  const eliminarProducto = async (id) => {
    if (eliminando) return;
    const ok = await confirm('¿Estás seguro de eliminar este producto?', 'Eliminar producto');
    if (!ok) return;
    setEliminando(true);
    try {
      await deleteDoc(doc(db, 'productos', id));
      setProductos(productos.filter(p => p.id !== id));
      showToast('Producto eliminado', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar producto', 'error');
    } finally {
      setEliminando(false);
    }
  };

  const abrirEditar = (producto) => {
    setEditando(producto);
    setFormData({
      tipo: producto.tipo || 'noPesable',
      codigoBarras: producto.codigoBarras || '',
      nombre: producto.nombre || '',
      precio: producto.precio?.toString() || '',
      stock: producto.stock || 0,
      filtro: producto.filtro || '',
    });
    setTieneCodigo(!!producto.codigoBarras);
    setShowModal(true);
  };

  const exportarExcel = () => {
    const tipoLabel = (p) => tipoDisplay(p.tipo);
    const datos = productos.map(p => ({
      Tipo: tipoLabel(p),
      'Código Barras': p.codigoBarras || '',
      Nombre: p.nombre || '',
      Precio: p.precio || 0,
      Stock: p.tipo === 'pesable' ? 'N/A' : String(p.stock || 0) + (p.tipo === 'pesableConStock' ? ' kg' : ''),
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const colWidths = [
      { wch: 14 }, { wch: 18 }, { wch: 30 },
      { wch: 12 }, { wch: 10 },
    ];
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, `productos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useBarcodeScanner(async (codigo) => {
    const matches = productos.filter(p => p.codigoBarras === codigo);
    if (showModal && !editando) {
      if (matches.length > 0) {
        const nombres = matches.map(p => p.nombre).join(', ');
        const ok = await confirm(`El código ${codigo} ya pertenece a: ${nombres}. ¿Crear como variante?`, 'Código existente');
        if (!ok) return;
      }
      setTieneCodigo(true);
      setFormData(prev => ({ ...prev, codigoBarras: codigo, tipo: 'noPesable' }));
      showToast(`Código ${codigo} cargado`, 'success');
      return;
    }
    if (matches.length === 1) {
      setBusqueda(codigo);
      setHighlightId(matches[0].id);
      setTimeout(() => setHighlightId(null), 2000);
    } else if (matches.length > 1) {
      setVarianteModal(matches);
    } else {
      setBusqueda(codigo);
      setScanError(codigo);
      setTimeout(() => setScanError(null), 4000);
    }
  });

  const handleVariantSelect = (producto) => {
    setVarianteModal(null);
    setBusqueda(producto.codigoBarras || '');
    setHighlightId(producto.id);
    setTimeout(() => setHighlightId(null), 2000);
  };

  const productosFiltrados = productos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigoBarras?.includes(busqueda)
  );

  const productosOrdenados = [...productosFiltrados].sort((a, b) => {
    const valA = (a[sortField] || '').toString().toLowerCase();
    const valB = (b[sortField] || '').toString().toLowerCase();
    return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });

  const productosConCodigo = productos.filter(p => p.codigoBarras);
  const productosBaseFiltrados = busquedaVarianteBase
    ? productosConCodigo.filter(p => p.nombre?.toLowerCase().includes(busquedaVarianteBase.toLowerCase()))
    : productosConCodigo;

  const abrirVariante = (base) => {
    setShowVarianteBaseSelector(false);
    setBusquedaVarianteBase('');
    resetForm();
    setTieneCodigo(true);
    setFormData(prev => ({ ...prev, codigoBarras: base.codigoBarras, tipo: base.tipo }));
    setShowModal(true);
  };

  if (loading) {
    return <Layout><LoadingSkeleton type="page" /></Layout>;
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Stock</h2>
        <div className="flex gap-2">
          {isGerente && (
            <button
              onClick={() => setShowMovimiento(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              📦 Movimiento de Stock
            </button>
          )}
          {isGerente && (
            <button
              onClick={exportarExcel}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              📊 Exportar Excel
            </button>
          )}
          {puedeEditar && (
            <button
              onClick={() => { setShowModal(true); setEditando(null); resetForm(); }}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              + Agregar Producto
            </button>
          )}
          {puedeEditar && (
            <button
              onClick={() => setShowVarianteBaseSelector(true)}
              className="bg-amber text-white px-4 py-2 rounded hover:bg-amber/90"
            >
              + Agregar Variante
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o código de barras..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border border-line-input bg-input text-body p-2 rounded"
        />
        {scanError && (
          <div className="mt-2 p-2 bg-red-soft text-red text-sm rounded flex items-center gap-1 font-semibold">
            ⚠️ Código <strong>{scanError}</strong> no encontrado en la base de datos
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-line overflow-hidden">
          <table className="w-full">
          <thead className="bg-table-header">
            <tr>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => toggleSort('nombre')}>
                Nombre {sortField === 'nombre' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th className="px-4 py-2 text-right">Precio</th>
              <th className="px-4 py-2 text-center">Filtro</th>
              <th className="px-4 py-2 text-center">Stock</th>
              {puedeEditar && (
                <th className="px-4 py-2 text-right">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {productosOrdenados.map(producto => (
              <tr key={producto.id} className={`border-t border-line transition-colors ${highlightId === producto.id ? 'bg-amber-soft/50' : ''}`}>
                <td className="px-4 py-2 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    esPesable(producto.tipo) ? 'bg-amber-soft text-amber' : 'bg-blue-soft text-blue'
                  }`}>
                    {tipoDisplay(producto.tipo)}
                  </span>
                </td>
                <td className="px-4 py-2">{producto.nombre}</td>
                <td className="px-4 py-2 text-right font-semibold">
                  {producto.tipo === 'huevos' ? (
                    <span className="text-muted text-xs">—</span>
                  ) : (
                    <>${formatNum(producto.precio)}{esPesable(producto.tipo) && <span className="text-xs text-muted"> /kg</span>}</>
                  )}
                </td>
                <td className="px-4 py-2 text-center text-xs text-muted">
                  {filtroLabel(producto)}
                </td>
                <td className="px-4 py-2 text-center">
                  {esPesableConStock(producto.tipo) ? (
                    <span className={`font-semibold ${producto.stock > 0 ? 'text-green' : 'text-red'}`}>
                      {formatNum(producto.stock || 0, 3)} kg
                      {producto.stock < 0 && <span className="ml-1 text-xs bg-red-soft text-red px-1 py-0.5 rounded">⚠️ Negativo</span>}
                    </span>
                  ) : (
                    <span className={`font-semibold ${producto.stock > 0 ? 'text-green' : 'text-red'}`}>
                      {formatNum(producto.stock || 0)}
                      {producto.stock < 0 && <span className="ml-1 text-xs bg-red-soft text-red px-1 py-0.5 rounded">⚠️ Negativo</span>}
                    </span>
                  )}
                </td>
                {puedeEditar && producto.tipo !== 'huevos' && (
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => abrirEditar(producto)} className="text-blue hover:text-blue mr-2">
                      Editar
                    </button>
                    {!['lena_x5', 'lena_x10', 'carbon'].includes(producto.id) && (
                      <button onClick={() => eliminarProducto(producto.id)} disabled={eliminando} className="text-red hover:text-red disabled:opacity-50">
                        {eliminando ? '...' : 'Eliminar'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {productosFiltrados.length === 0 && (
          <EmptyState title="No hay productos" icon="📦" />
        )}
      </div>

      <Modal open={showModal && puedeEditar} onClose={() => setShowModal(false)} title={editando ? 'Editar Producto' : 'Agregar Producto'}>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Tipo de producto</label>
            <select
              value={esPesable(formData.tipo) ? 'pesableConStock' : 'noPesable'}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className="w-full border border-line-input bg-input text-body p-2 rounded"
            >
              <option value="noPesable">No Pesable</option>
              <option value="pesableConStock">Pesable</option>
            </select>
          </div>

          
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Código de Barras</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => { setTieneCodigo(true); if (!editando) setFormData(prev => ({ ...prev, codigoBarras: '', tipo: 'noPesable' })); }} className={`px-3 py-1.5 rounded text-sm font-medium border ${tieneCodigo ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-input text-body border-line-input'}`}>
                Con código
              </button>
              <button type="button" onClick={() => { setTieneCodigo(false); setFormData(prev => ({ ...prev, codigoBarras: '' })); }} className={`px-3 py-1.5 rounded text-sm font-medium border ${!tieneCodigo ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-input text-body border-line-input'}`}>
                Sin código
              </button>
            </div>
            {tieneCodigo && (
              <input
                type="text"
                value={formData.codigoBarras}
                onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                className="w-full border border-line-input bg-input text-body p-2 rounded"
                placeholder={editando ? formData.codigoBarras || 'Ingresar código' : 'Escanear o ingresar'}
                required
                autoFocus
              />
            )}
          </div>

          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Filtro</label>
            <div className="flex gap-2">
              <select
                value={formData.filtro}
                onChange={(e) => {
                  if (e.target.value === '__nuevo__') {
                    setShowNuevoFiltro(true);
                    setNombreNuevoFiltro('');
                  } else {
                    setFormData({ ...formData, filtro: e.target.value });
                  }
                }}
                className="flex-1 border border-line-input bg-input text-body p-2 rounded"
              >
                <option value="">Sin filtro</option>
                {filtros.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
                <option value="__nuevo__">+ Agregar nuevo...</option>
              </select>
            </div>
            {showNuevoFiltro && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={nombreNuevoFiltro}
                  onChange={(e) => setNombreNuevoFiltro(e.target.value)}
                  placeholder="Nombre del nuevo filtro"
                  className="flex-1 border border-line-input bg-input text-body p-2 rounded text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={async () => {
                    const nombre = nombreNuevoFiltro.trim();
                    if (!nombre) return;
                    if (filtros.includes(nombre)) {
                      setFormData(prev => ({ ...prev, filtro: nombre }));
                      setShowNuevoFiltro(false);
                      setNombreNuevoFiltro('');
                      return;
                    }
                    await addDoc(collection(db, 'filtros'), { nombre });
                    setFiltros(prev => [...prev, nombre]);
                    setFormData(prev => ({ ...prev, filtro: nombre }));
                    setShowNuevoFiltro(false);
                    setNombreNuevoFiltro('');
                    showToast(`Filtro "${nombre}" creado`, 'success');
                  }}
                  className="bg-indigo-600 text-white px-3 py-1 rounded text-sm"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNuevoFiltro(false); setNombreNuevoFiltro(''); }}
                  className="text-gray-500 px-2 py-1 text-sm"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Nombre</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full border border-line-input bg-input text-body p-2 rounded"
              required
            />
          </div>

          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">
              Precio {esPesable(formData.tipo) ? 'por kg' : ''}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.precio}
              onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
              className="w-full border border-line-input bg-input text-body p-2 rounded"
              required
            />
          </div>

          {!editando && (
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">
                Stock inicial {esPesableConStock(formData.tipo) ? '(kg)' : ''}
              </label>
              {esPesableConStock(formData.tipo) ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={stockScaleActive ? (stockScaleGrams / 1000).toFixed(3) : Number(formData.stock || 0).toFixed(3)}
                  onFocus={() => { setStockScaleActive(true); setStockScaleGrams(Math.round((formData.stock || 0) * 1000)); }}
                  onKeyDown={handleStockScaleKeyDown}
                  onBlur={() => {
                    if (stockScaleActive) {
                      setFormData(prev => ({ ...prev, stock: (stockScaleGrams / 1000) || 0 }));
                      setStockScaleActive(false);
                    }
                  }}
                  className="w-full border border-line-input bg-input text-body p-2 rounded"
                />
              ) : (
                <input
                  type="number"
                  step="1"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full border border-line-input bg-input text-body p-2 rounded"
                />
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={procesando} className="bg-indigo-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
              {procesando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="bg-surface px-4 py-2 rounded">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <ModalMovimientoStock
        open={showMovimiento}
        onClose={() => setShowMovimiento(false)}
        productos={productos}
        onProductosActualizados={async () => {
          const snapshot = await getDocs(collection(db, 'productos'));
          setProductos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }}
      />

      <Modal open={showVarianteBaseSelector} onClose={() => { setShowVarianteBaseSelector(false); setBusquedaVarianteBase(''); }} title="Seleccionar producto base">
        <div className="mb-3">
          <input
            type="text"
            value={busquedaVarianteBase}
            onChange={(e) => setBusquedaVarianteBase(e.target.value)}
            placeholder="Buscar producto con código..."
            className="w-full border border-line-input bg-input text-body p-2 rounded"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {productosBaseFiltrados.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Sin resultados</p>
          ) : (
            productosBaseFiltrados.map(p => (
              <button
                key={p.id}
                onClick={() => abrirVariante(p)}
                className="w-full text-left p-2 rounded border border-line hover:bg-elevated hover:border-amber transition-colors"
              >
                <div className="font-semibold text-sm">{p.nombre}</div>
                <div className="text-xs text-muted">Código: {p.codigoBarras}</div>
              </button>
            ))
          )}
        </div>
      </Modal>

      <VarianteSelector
        open={varianteModal !== null}
        productos={varianteModal || []}
        onSeleccionar={handleVariantSelect}
        onCancel={() => setVarianteModal(null)}
      />
    </Layout>
  );
};

export default StockPage;