import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Layout } from '../components/Layout';

export const StockPage = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

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

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-4">Consulta de Stock</h2>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border p-3 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {productosFiltrados.map(producto => (
          <div key={producto.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg">{producto.nombre}</h3>
            <p className="text-gray-600 text-xl font-bold">${producto.precio}</p>
            <p className={`text-sm font-semibold ${producto.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {producto.stock > 0 ? `✓ Stock: ${producto.stock}` : '✗ Sin stock'}
            </p>
          </div>
        ))}
      </div>

      {productosFiltrados.length === 0 && (
        <p className="text-center text-gray-500 mt-4">No se encontraron productos</p>
      )}
    </Layout>
  );
};

export default StockPage;