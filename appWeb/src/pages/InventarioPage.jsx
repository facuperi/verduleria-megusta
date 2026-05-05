import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

const NEGOCIOS = ['chiclana', 'belgrano'];

export const InventarioPage = () => {
  const { isGerente, user } = useAuth();
  const { isMobile } = useDevice();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [formData, setFormData] = useState({
    codigoBarras: '',
    codigoInterno: '',
    nombre: '',
    precio: '',
    stockChiclana: 0,
    stockBelgrano: 0,
  });

  const restriction = checkDeviceRestriction('gestionarInventario');
  const canAccess = isGerente && !isMobile;

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
        precio: parseFloat(formData.precio),
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
      setFormData({ codigoBarras: '', codigoInterno: '', nombre: '', precio: '', stockChiclana: 0, stockBelgrano: 0 });
      
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
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      setEliminando(true);
      try {
        await deleteDoc(doc(db, 'productos', id));
        setProductos(productos.filter(p => p.id !== id));
      } catch (err) {
        console.error(err);
      } finally {
        setEliminando(false);
      }
    }
  };

  const abrirEditar = (producto) => {
    setEditando(producto);
    setFormData({
      codigoBarras: producto.codigoBarras || '',
      codigoInterno: producto.codigoInterno || '',
      nombre: producto.nombre || '',
      precio: producto.precio?.toString() || '',
      stockChiclana: producto.stockPorNegocio?.chiclana || 0,
      stockBelgrano: producto.stockPorNegocio?.belgrano || 0,
    });
    setShowModal(true);
  };

  const productosFiltrados = productos.filter(p => 
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigoBarras?.includes(busqueda) ||
    p.codigoInterno?.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          {restriction.message || 'Solo gerentes pueden gestionar inventario desde PC'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Inventario</h2>
        <button
          onClick={() => { setShowModal(true); setEditando(null); setFormData({ codigoBarras: '', codigoInterno: '', nombre: '', precio: '', stockChiclana: 0, stockBelgrano: 0 }); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Agregar Producto
        </button>
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
              <th className="px-4 py-2 text-right">Precio</th>
              <th className="px-4 py-2 text-center">Chiclana</th>
              <th className="px-4 py-2 text-center">Belgrano</th>
              <th className="px-4 py-2 text-center">Total</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.map(producto => (
              <tr key={producto.id} className="border-t">
                <td className="px-4 py-2 text-sm">{producto.codigoInterno}</td>
                <td className="px-4 py-2">{producto.nombre}</td>
                <td className="px-4 py-2 text-right">${producto.precio}</td>
                <td className="px-4 py-2 text-center">{producto.stockPorNegocio?.chiclana || 0}</td>
                <td className="px-4 py-2 text-center">{producto.stockPorNegocio?.belgrano || 0}</td>
                <td className="px-4 py-2 text-center font-semibold">{producto.stockGlobal || 0}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => abrirEditar(producto)} className="text-blue-600 hover:text-blue-800 mr-2">
                    Editar
                  </button>
                  <button onClick={() => eliminarProducto(producto.id)} disabled={eliminando} className="text-red-600 hover:text-red-800 disabled:opacity-50">
                    {eliminando ? '...' : 'Eliminar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productosFiltrados.length === 0 && (
          <p className="text-center py-4 text-gray-500">No hay productos</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{editando ? 'Editar' : 'Agregar'} Producto</h3>
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
              <div className="mb-3">
                <label className="block text-sm font-bold mb-1">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.precio}
                  onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                  className="w-full border p-2 rounded"
                  required
                />
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
          </div>
        </div>
      )}
    </Layout>
  );
};

export default InventarioPage;