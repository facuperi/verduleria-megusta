import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';

export const StockPage = () => {
  const { isGerente, user } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarGlobal, setMostrarGlobal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  
  const [formData, setFormData] = useState({
    codigoBarras: '',
    codigoInterno: '',
    nombre: '',
    precioEfectivo: '',
    precioTarjeta: '',
    stockChiclana: 0,
    stockBelgrano: 0,
  });

  const puedeEditar = isGerente && !isMobile;

  const calcularStockGlobal = (stockChiclana, stockBelgrano) => {
    return (parseInt(stockChiclana) || 0) + (parseInt(stockBelgrano) || 0);
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
      const stockGlobal = calcularStockGlobal(formData.stockChiclana, formData.stockBelgrano);
      
      const data = {
        codigoBarras: formData.codigoBarras.trim(),
        codigoInterno: formData.codigoInterno.trim(),
        nombre: formData.nombre.trim(),
        precioEfectivo: parseFloat(formData.precioEfectivo) || 0,
        precioTarjeta: parseFloat(formData.precioTarjeta) || 0,
        stockPorNegocio: {
          chiclana: parseInt(formData.stockChiclana) || 0,
          belgrano: parseInt(formData.stockBelgrano) || 0,
        },
        stockGlobal,
        fechaActualizado: new Date().toISOString(),
      };

      if (editando) {
        await updateDoc(doc(db, 'productos', editando.id), data);
      } else {
        await addDoc(collection(db, 'productos'), data);
      }

      setShowModal(false);
      setEditando(null);
      setFormData({ codigoBarras: '', codigoInterno: '', nombre: '', precioEfectivo: '', precioTarjeta: '', stockChiclana: 0, stockBelgrano: 0 });
      
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
      codigoBarras: producto.codigoBarras || '',
      codigoInterno: producto.codigoInterno || '',
      nombre: producto.nombre || '',
      precioEfectivo: producto.precioEfectivo?.toString() || '',
      precioTarjeta: producto.precioTarjeta?.toString() || '',
      stockChiclana: producto.stockPorNegocio?.chiclana || 0,
      stockBelgrano: producto.stockPorNegocio?.belgrano || 0,
    });
    setShowModal(true);
  };

  const exportarExcel = () => {
    const datos = productos.map(p => ({
      'Código Barras': p.codigoBarras || '',
      'Código Interno': p.codigoInterno || '',
      Nombre: p.nombre || '',
      'Precio Efectivo': p.precioEfectivo || 0,
      'Precio Tarjeta': p.precioTarjeta || 0,
      'Stock Chiclana': p.stockPorNegocio?.chiclana || 0,
      'Stock Belgrano': p.stockPorNegocio?.belgrano || 0,
      'Stock Global': p.stockGlobal || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const colWidths = [
      { wch: 18 }, { wch: 15 }, { wch: 30 },
      { wch: 16 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 12 },
    ];
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, `productos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const productosFiltrados = productos.filter(p => 
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigoBarras?.includes(busqueda) ||
    p.codigoInterno?.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Stock</h2>
        <div className="flex gap-2">
          {isGerente && (
            <button
              onClick={() => setMostrarGlobal(!mostrarGlobal)}
              className={`px-4 py-2 rounded ${mostrarGlobal ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
            >
              {mostrarGlobal ? 'Ver por Negocio' : 'Ver Global'}
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
              onClick={() => { setShowModal(true); setEditando(null); setFormData({ codigoBarras: '', codigoInterno: '', nombre: '', precioEfectivo: '', precioTarjeta: '', stockChiclana: 0, stockBelgrano: 0 }); }}
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
          placeholder="Buscar por nombre, código de barras o código interno..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Código</th>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-right">Precios (EF/TJ)</th>
              {mostrarGlobal ? (
                <th className="px-4 py-2 text-center">Stock Global</th>
              ) : (
                <>
                  <th className="px-4 py-2 text-center">Chiclana</th>
                  <th className="px-4 py-2 text-center">Belgrano</th>
                </>
              )}
              {puedeEditar && (
                <th className="px-4 py-2 text-right">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.map(producto => (
              <tr key={producto.id} className="border-t">
                <td className="px-4 py-2 text-sm">{producto.codigoInterno}</td>
                <td className="px-4 py-2">{producto.nombre}</td>
                <td className="px-4 py-2 text-right">
                  <span className="block">EF: ${producto.precioEfectivo}</span>
                  <span className="text-gray-500 text-sm">TJ: ${producto.precioTarjeta}</span>
                </td>
                {mostrarGlobal ? (
                  <td className="px-4 py-2 text-center">
                    <span className={`font-semibold ${producto.stockGlobal > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {producto.stockGlobal || 0}
                    </span>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2 text-center">
                      <span className={`font-semibold ${producto.stockPorNegocio?.chiclana > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {producto.stockPorNegocio?.chiclana || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`font-semibold ${producto.stockPorNegocio?.belgrano > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {producto.stockPorNegocio?.belgrano || 0}
                      </span>
                    </td>
                  </>
                )}
                {puedeEditar && (
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => abrirEditar(producto)} className="text-blue-600 hover:text-blue-800 mr-2">
                      Editar
                    </button>
                    <button onClick={() => eliminarProducto(producto.id)} disabled={eliminando} className="text-red-600 hover:text-red-800 disabled:opacity-50">
                      {eliminando ? '...' : 'Eliminar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {productosFiltrados.length === 0 && (
          <p className="text-center py-4 text-gray-500">No hay productos</p>
        )}
      </div>

      <Modal open={showModal && puedeEditar} onClose={() => setShowModal(false)} title={editando ? 'Editar Producto' : 'Agregar Producto'}>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Código de Barras</label>
            <input
              type="text"
              value={formData.codigoBarras}
              onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
              className="w-full border p-2 rounded"
              placeholder="Escanear o ingresar"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Código Interno</label>
            <input
              type="text"
              value={formData.codigoInterno}
              onChange={(e) => setFormData({ ...formData, codigoInterno: e.target.value })}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Nombre</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-sm font-bold mb-1">Precio Efectivo</label>
              <input
                type="number"
                step="0.01"
                value={formData.precioEfectivo}
                onChange={(e) => setFormData({ ...formData, precioEfectivo: e.target.value })}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Precio Tarjeta</label>
              <input
                type="number"
                step="0.01"
                value={formData.precioTarjeta}
                onChange={(e) => setFormData({ ...formData, precioTarjeta: e.target.value })}
                className="w-full border p-2 rounded"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-sm font-bold mb-1">Stock Chiclana</label>
              <input
                type="number"
                value={formData.stockChiclana}
                onChange={(e) => setFormData({ ...formData, stockChiclana: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Stock Belgrano</label>
              <input
                type="number"
                value={formData.stockBelgrano}
                onChange={(e) => setFormData({ ...formData, stockBelgrano: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>
          </div>
          <div className="bg-gray-100 p-2 rounded mb-3 text-sm text-center">
            Stock Global: {calcularStockGlobal(formData.stockChiclana, formData.stockBelgrano)}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={procesando} className="bg-indigo-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
              {procesando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="bg-gray-300 px-4 py-2 rounded">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default StockPage;