import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

  const [formData, setFormData] = useState({
    tipo: 'noPesable',
    codigoBarras: '',
    nombre: '',
    precio: '',
    stock: 0,
  });

  const puedeEditar = isGerente && !isMobile;

  const resetForm = () => setFormData({
    tipo: 'noPesable',
    codigoBarras: '',
    nombre: '',
    precio: '',
    stock: 0,
  });

  const esPesableSuelto = (tipo) => tipo === 'pesable';
  const esPesableConStock = (tipo) => tipo === 'pesableConStock';
  const esPesable = (tipo) => esPesableSuelto(tipo) || esPesableConStock(tipo);
  const esNoPesable = (tipo) => tipo === 'noPesable';

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'productos'));
        setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      const data = {
        tipo: formData.tipo,
        nombre: formData.nombre.trim(),
        precio: parseFloat(formData.precio) || 0,
        fechaActualizado: new Date().toISOString(),
      };

      if (!editando) {
        if (esPesableSuelto(formData.tipo)) {
          data.codigoBarras = '';
          data.stock = 0;
        } else if (esPesableConStock(formData.tipo)) {
          data.codigoBarras = '';
          data.stock = parseFloat(formData.stock) || 0;
        } else {
          data.codigoBarras = formData.codigoBarras.trim();
          data.stock = parseInt(formData.stock) || 0;
        }
      } else {
        if (esNoPesable(formData.tipo)) {
          data.codigoBarras = formData.codigoBarras.trim();
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
    });
    setShowModal(true);
  };

  const exportarExcel = () => {
    const tipoLabel = (p) => {
      if (p.tipo === 'pesable') return 'Pesable suelto';
      if (p.tipo === 'pesableConStock') return 'Pesable c/Stock';
      return 'No Pesable';
    };
    const datos = productos.map(p => ({
      Tipo: tipoLabel(p),
      'Código Barras': p.tipo === 'noPesable' ? (p.codigoBarras || '') : '-',
      Nombre: p.nombre || '',
      Precio: p.precio || 0,
      Stock: p.tipo === 'pesable' ? '-' : String(p.stock || 0) + (p.tipo === 'pesableConStock' ? ' kg' : ''),
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

  useBarcodeScanner((codigo) => {
    const match = productos.find(p => p.codigoBarras === codigo);
    if (showModal && !editando) {
      setFormData(prev => ({ ...prev, codigoBarras: codigo, tipo: 'noPesable' }));
      showToast(`Código ${codigo} cargado`, 'success');
      return;
    }
    if (match) {
      setBusqueda(codigo);
      setHighlightId(match.id);
      setTimeout(() => setHighlightId(null), 2000);
    } else {
      setBusqueda(codigo);
      setScanError(codigo);
      setTimeout(() => setScanError(null), 4000);
    }
  });

  const productosFiltrados = productos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigoBarras?.includes(busqueda)
  );

  const productosOrdenados = [...productosFiltrados].sort((a, b) => {
    const valA = (a[sortField] || '').toString().toLowerCase();
    const valB = (b[sortField] || '').toString().toLowerCase();
    return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });

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
                    {esPesableSuelto(producto.tipo) && '⚖️ Pesable'}
                    {esPesableConStock(producto.tipo) && '⚖️ Pesable c/Stock'}
                    {esNoPesable(producto.tipo) && '📦 No Pesable'}
                  </span>
                </td>
                <td className="px-4 py-2">{producto.nombre}</td>
                <td className="px-4 py-2 text-right font-semibold">
                  ${formatNum(producto.precio)}
                  {esPesable(producto.tipo) && <span className="text-xs text-muted"> /kg</span>}
                </td>
                <td className="px-4 py-2 text-center">
                  {esPesableSuelto(producto.tipo) ? (
                    <span className="text-muted">—</span>
                  ) : esPesableConStock(producto.tipo) ? (
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
                {puedeEditar && (
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => abrirEditar(producto)} className="text-blue hover:text-blue mr-2">
                      Editar
                    </button>
                    <button onClick={() => eliminarProducto(producto.id)} disabled={eliminando} className="text-red hover:text-red disabled:opacity-50">
                      {eliminando ? '...' : 'Eliminar'}
                    </button>
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
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className="w-full border border-line-input bg-input text-body p-2 rounded"
            >
              <option value="noPesable">No Pesable (con código de barras)</option>
              <option value="pesable">Pesable suelto (por kg, sin stock)</option>
              <option value="pesableConStock">Pesable con Stock (control en kg)</option>
            </select>
          </div>

          {esNoPesable(formData.tipo) && (
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Código de Barras</label>
              <input
                type="text"
                value={formData.codigoBarras}
                onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                className="w-full border border-line-input bg-input text-body p-2 rounded"
                placeholder="Escanear o ingresar"
              />
            </div>
          )}

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

          {!editando && !esPesableSuelto(formData.tipo) && (
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">
                Stock inicial {esPesableConStock(formData.tipo) ? '(kg)' : ''}
              </label>
              <input
                type="number"
                step={esPesableConStock(formData.tipo) ? '0.001' : '1'}
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="w-full border border-line-input bg-input text-body p-2 rounded"
              />
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
    </Layout>
  );
};

export default StockPage;