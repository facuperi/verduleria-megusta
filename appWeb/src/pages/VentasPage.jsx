import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

export const VentasPage = () => {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendiendo, setVendiendo] = useState(false);
  const [error, setError] = useState('');

  const restriction = checkDeviceRestriction('venta');
  const canSell = !isMobile || restriction.allowed.includes('mobile');

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'productos'));
        setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setError('Error al cargar productos');
      } finally {
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

  const agregarAlCarrito = (producto) => {
    const existe = carrito.find(p => p.id === producto.id);
    if (existe) {
      setCarrito(carrito.map(p => 
        p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  const quitarDelCarrito = (productoId) => {
    setCarrito(carrito.filter(p => p.id !== productoId));
  };

  const total = carrito.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);

  const realizarVenta = async () => {
    if (!canSell) {
      setError(restriction.message);
      return;
    }
    if (carrito.length === 0) return;

    setVendiendo(true);
    try {
      await addDoc(collection(db, 'ventas'), {
        productos: carrito,
        total,
        usuarioId: user.uid,
        fecha: serverTimestamp(),
      });

      for (const item of carrito) {
        const productoRef = doc(db, 'productos', item.id);
        await updateDoc(productoRef, {
          stock: item.stock - item.cantidad,
        });
      }

      setCarrito([]);
      alert('Venta realizada con éxito');
    } catch (err) {
      setError('Error al realizar venta');
    } finally {
      setVendiendo(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8">Cargando...</div>
      </Layout>
    );
  }

  if (!canSell) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          {restriction.message}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4">Productos</h2>
          <div className="grid grid-cols-2 gap-4">
            {productos.filter(p => p.stock > 0).map(producto => (
              <div key={producto.id} className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-semibold">{producto.nombre}</h3>
                <p className="text-gray-600">${producto.precio}</p>
                <p className="text-sm text-gray-500">Stock: {producto.stock}</p>
                <button
                  onClick={() => agregarAlCarrito(producto)}
                  className="mt-2 w-full bg-indigo-600 text-white py-1 px-3 rounded hover:bg-indigo-700"
                >
                  Agregar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Carrito</h2>
          {error && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">{error}</div>
          )}
          {carrito.length === 0 ? (
            <p className="text-gray-500">El carrito está vacío</p>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow">
              {carrito.map(item => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-semibold">{item.nombre}</p>
                    <p className="text-sm text-gray-500">
                      ${item.precio} x {item.cantidad}
                    </p>
                  </div>
                  <button
                    onClick={() => quitarDelCarrito(item.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t">
                <p className="text-xl font-bold">Total: ${total}</p>
                <button
                  onClick={realizarVenta}
                  disabled={vendiendo}
                  className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {vendiendo ? 'Procesando...' : 'Realizar Venta'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default VentasPage;