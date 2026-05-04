import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';

export const InventarioPage = () => {
  const { isGerente } = useAuth();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', precio: '', stock: '', imagen: null });

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
    try {
      let imagenUrl = '';
      if (formData.imagen) {
        const storageRef = ref(storage, `productos/${Date.now()}_${formData.imagen.name}`);
        await uploadBytes(storageRef, formData.imagen);
        imagenUrl = await getDownloadURL(storageRef);
      }

      const data = {
        nombre: formData.nombre,
        precio: parseFloat(formData.precio),
        stock: parseInt(formData.stock),
        imagenUrl: imagenUrl || editando?.imagenUrl || '',
        actualizado: new Date().toISOString(),
      };

      if (editando) {
        await updateDoc(doc(db, 'productos', editando.id), data);
      } else {
        await addDoc(collection(db, 'productos'), data);
      }

      setShowModal(false);
      setEditando(null);
      setFormData({ nombre: '', precio: '', stock: '', imagen: null });
      
      const snapshot = await getDocs(collection(db, 'productos'));
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  const eliminarProducto = async (id) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await deleteDoc(doc(db, 'productos', id));
      setProductos(productos.filter(p => p.id !== id));
    }
  };

  const abrirEditar = (producto) => {
    setEditando(producto);
    setFormData({ nombre: producto.nombre, precio: producto.precio, stock: producto.stock, imagen: null });
    setShowModal(true);
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Inventario</h2>
        <button
          onClick={() => { setShowModal(true); setEditando(null); setFormData({ nombre: '', precio: '', stock: '', imagen: null }); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Agregar Producto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {productos.map(producto => (
          <div key={producto.id} className="bg-white p-4 rounded-lg shadow">
            {producto.imagenUrl && (
              <img src={producto.imagenUrl} alt={producto.nombre} className="w-full h-40 object-cover rounded mb-2" />
            )}
            <h3 className="font-semibold text-lg">{producto.nombre}</h3>
            <p className="text-gray-600">${producto.precio}</p>
            <p className={`text-sm ${producto.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
              Stock: {producto.stock}
            </p>
            {isGerente && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => abrirEditar(producto)} className="text-blue-600 hover:text-blue-800">
                  Editar
                </button>
                <button onClick={() => eliminarProducto(producto.id)} className="text-red-600 hover:text-red-800">
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{editando ? 'Editar' : 'Agregar'} Producto</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
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
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Stock</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Imagen</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, imagen: e.target.files[0] })}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded flex-1">
                  Guardar
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