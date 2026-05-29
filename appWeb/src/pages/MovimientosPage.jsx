import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from '../components/Layout';

export const MovimientosPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [showMovimiento, setShowMovimiento] = useState(false);
  const [showIngreso, setShowIngreso] = useState(false);
  const [busquedaMovimiento, setBusquedaMovimiento] = useState('');
  const [busquedaIngreso, setBusquedaIngreso] = useState('');
  const [listaMovimiento, setListaMovimiento] = useState([]);
  const [listaIngreso, setListaIngreso] = useState([]);
  const [movimientoOrigen, setMovimientoOrigen] = useState('chiclana');
  const [movimientoDestino, setMovimientoDestino] = useState('belgrano');
  const [ingresoNegocio, setIngresoNegocio] = useState('chiclana');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodSnapshot, movSnapshot] = await Promise.all([
          getDocs(collection(db, 'productos')),
          getDocs(query(
            collection(db, 'movimientosStock'),
            orderBy('fecha', 'desc'),
            limit(50)
          )),
        ]);
        setProductos(prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setMovimientos(movSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setCargandoHistorial(false);
      }
    };
    fetchData();
  }, []);

  const buscarProducto = (texto) => {
    const t = texto.toLowerCase().trim();
    return productos.filter(p => 
      p.codigoBarras?.includes(t) || 
      p.codigoInterno?.toLowerCase().includes(t) || 
      p.nombre?.toLowerCase().includes(t)
    );
  };

  const agregarAMovimiento = (producto) => {
    const existente = listaMovimiento.find(p => p.id === producto.id);
    if (existente) {
      setListaMovimiento(listaMovimiento.map(p => 
        p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setListaMovimiento([...listaMovimiento, { id: producto.id, nombre: producto.nombre, cantidad: 1 }]);
    }
    setBusquedaMovimiento('');
  };

  const quitarDeMovimiento = (id) => {
    setListaMovimiento(listaMovimiento.filter(p => p.id !== id));
  };

  const moverStock = async () => {
    if (listaMovimiento.length === 0 || movimientoOrigen === movimientoDestino) {
      showToast('Agregá productos y asegurate que origen y destino sean diferentes', 'warning');
      return;
    }
    setProcesando(true);
    try {
      for (const item of listaMovimiento) {
        const producto = productos.find(p => p.id === item.id);
        if (producto.stockPorNegocio[movimientoOrigen] < item.cantidad) {
          showToast(`No hay suficiente stock de ${producto.nombre} en ${movimientoOrigen}`, 'warning');
          setProcesando(false);
          return;
        }

        const nuevoStockOrigen = producto.stockPorNegocio[movimientoOrigen] - item.cantidad;
        const nuevoStockDestino = producto.stockPorNegocio[movimientoDestino] + item.cantidad;

        await updateDoc(doc(db, 'productos', item.id), {
          stockPorNegocio: {
            chiclana: movimientoOrigen === 'chiclana' ? nuevoStockOrigen : (movimientoDestino === 'chiclana' ? nuevoStockDestino : producto.stockPorNegocio.chiclana),
            belgrano: movimientoOrigen === 'belgrano' ? nuevoStockOrigen : (movimientoDestino === 'belgrano' ? nuevoStockDestino : producto.stockPorNegocio.belgrano),
          },
          fechaActualizado: new Date().toISOString(),
        });

        await addDoc(collection(db, 'movimientosStock'), {
          tipo: 'movimiento',
          productoId: item.id,
          productoNombre: producto.nombre,
          cantidad: item.cantidad,
          origen: movimientoOrigen,
          destino: movimientoDestino,
          realizadoPor: user?.uid || 'gerente',
          fecha: new Date().toISOString(),
        });
      }

      const snapshot = await getDocs(collection(db, 'productos'));
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setShowMovimiento(false);
      setListaMovimiento([]);
      setMovimientoOrigen('chiclana');
      setMovimientoDestino('belgrano');
      showToast('Stock movido correctamente', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al mover stock', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const agregarAIngreso = (producto) => {
    const existente = listaIngreso.find(p => p.id === producto.id);
    if (existente) {
      setListaIngreso(listaIngreso.map(p => 
        p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setListaIngreso([...listaIngreso, { id: producto.id, nombre: producto.nombre, cantidad: 1 }]);
    }
    setBusquedaIngreso('');
  };

  const quitarDeIngreso = (id) => {
    setListaIngreso(listaIngreso.filter(p => p.id !== id));
  };

  const agregarStock = async () => {
    if (listaIngreso.length === 0) {
      showToast('Agregá al menos un producto', 'warning');
      return;
    }
    setProcesando(true);
    try {
      for (const item of listaIngreso) {
        const producto = productos.find(p => p.id === item.id);
        const stockActual = producto.stockPorNegocio[ingresoNegocio] || 0;

        await updateDoc(doc(db, 'productos', item.id), {
          [`stockPorNegocio.${ingresoNegocio}`]: stockActual + item.cantidad,
          stockGlobal: producto.stockGlobal + item.cantidad,
          fechaActualizado: new Date().toISOString(),
        });

        await addDoc(collection(db, 'movimientosStock'), {
          tipo: 'ingreso',
          productoId: item.id,
          productoNombre: producto.nombre,
          cantidad: item.cantidad,
          negocio: ingresoNegocio,
          realizadoPor: user?.uid || 'gerente',
          fecha: new Date().toISOString(),
        });
      }

      const snapshot = await getDocs(collection(db, 'productos'));
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setShowIngreso(false);
      setListaIngreso([]);
      setIngresoNegocio('chiclana');
      showToast('Stock agregado correctamente', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al agregar stock', 'error');
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Movimientos de Stock</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Mover Stock entre Negocios</h3>
          <p className="text-sm text-gray-500 mb-4">Transferir productos de un negocio a otro</p>
          <button
            onClick={() => { setShowMovimiento(true); setListaMovimiento([]); }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Abrir Movimiento
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Ingreso de Mercadería</h3>
          <p className="text-sm text-gray-500 mb-4">Agregar stock a un negocio (compras, reposición)</p>
          <button
            onClick={() => { setShowIngreso(true); setListaIngreso([]); }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Abrir Ingreso
          </button>
        </div>
      </div>

      {/* Historial de movimientos */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Historial de Movimientos</h3>
        </div>
        {cargandoHistorial ? (
          <div className="text-center py-8 text-gray-500">Cargando historial...</div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No hay movimientos registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-center px-4 py-3">Cantidad</th>
                  <th className="text-left px-4 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        m.tipo === 'movimiento' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {m.tipo === 'movimiento' ? '↔ Movimiento' : '⬆ Ingreso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.productoNombre}</td>
                    <td className="px-4 py-3 text-center font-semibold">{m.cantidad}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {m.tipo === 'movimiento'
                        ? `${m.origen} → ${m.destino}`
                        : `Recibido en ${m.negocio}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Mover Stock */}
      {showMovimiento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Mover Stock entre Negocios</h3>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-sm font-bold mb-1">Origen</label>
                <select
                  value={movimientoOrigen}
                  onChange={(e) => setMovimientoOrigen(e.target.value)}
                  className="w-full border p-2 rounded"
                >
                  <option value="chiclana">Chiclana</option>
                  <option value="belgrano">Belgrano</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Destino</label>
                <select
                  value={movimientoDestino}
                  onChange={(e) => setMovimientoDestino(e.target.value)}
                  className="w-full border p-2 rounded"
                >
                  <option value="belgrano">Belgrano</option>
                  <option value="chiclana">Chiclana</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Buscar Producto</label>
              <input
                type="text"
                value={busquedaMovimiento}
                onChange={(e) => setBusquedaMovimiento(e.target.value)}
                placeholder="Código, código interno o nombre..."
                className="w-full border p-2 rounded"
              />
              {busquedaMovimiento && (
                <div className="max-h-32 overflow-y-auto border mt-1 rounded">
                  {buscarProducto(busquedaMovimiento).map(p => (
                    <div
                      key={p.id}
                      onClick={() => agregarAMovimiento(p)}
                      className="p-2 hover:bg-gray-100 cursor-pointer border-b text-sm"
                    >
                      {p.nombre} ({p.codigoInterno})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {listaMovimiento.length > 0 && (
              <div className="mb-3 border rounded p-2">
                <p className="text-sm font-bold mb-2">Productos a mover:</p>
                {listaMovimiento.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1 border-b text-sm">
                    <span className="truncate w-24">{item.nombre}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => setListaMovimiento(listaMovimiento.map(p => p.id === item.id ? { ...p, cantidad: parseInt(e.target.value) || 1 } : p))}
                        className="w-16 border p-1 rounded text-center"
                      />
                      <button onClick={() => quitarDeMovimiento(item.id)} className="text-red-500 ml-2">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={moverStock} disabled={procesando} className="bg-blue-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
                {procesando ? 'Moviendo...' : 'Confirmar Movimiento'}
              </button>
              <button onClick={() => { setShowMovimiento(false); setListaMovimiento([]); }} className="bg-gray-300 px-4 py-2 rounded">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ingreso Mercadería */}
      {showIngreso && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Ingreso de Mercadería</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Negocio destino</label>
              <select
                value={ingresoNegocio}
                onChange={(e) => setIngresoNegocio(e.target.value)}
                className="w-full border p-2 rounded"
              >
                <option value="chiclana">Chiclana</option>
                <option value="belgrano">Belgrano</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Buscar Producto</label>
              <input
                type="text"
                value={busquedaIngreso}
                onChange={(e) => setBusquedaIngreso(e.target.value)}
                placeholder="Código, código interno o nombre..."
                className="w-full border p-2 rounded"
              />
              {busquedaIngreso && (
                <div className="max-h-32 overflow-y-auto border mt-1 rounded">
                  {buscarProducto(busquedaIngreso).map(p => (
                    <div
                      key={p.id}
                      onClick={() => agregarAIngreso(p)}
                      className="p-2 hover:bg-gray-100 cursor-pointer border-b text-sm"
                    >
                      {p.nombre} ({p.codigoInterno})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {listaIngreso.length > 0 && (
              <div className="mb-3 border rounded p-2">
                <p className="text-sm font-bold mb-2">Productos a ingresar:</p>
                {listaIngreso.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1 border-b text-sm">
                    <span className="truncate w-24">{item.nombre}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => setListaIngreso(listaIngreso.map(p => p.id === item.id ? { ...p, cantidad: parseInt(e.target.value) || 1 } : p))}
                        className="w-16 border p-1 rounded text-center"
                      />
                      <button onClick={() => quitarDeIngreso(item.id)} className="text-red-500 ml-2">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={agregarStock} disabled={procesando} className="bg-green-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
                {procesando ? 'Agregando...' : 'Agregar Stock'}
              </button>
              <button onClick={() => { setShowIngreso(false); setListaIngreso([]); }} className="bg-gray-300 px-4 py-2 rounded">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default MovimientosPage;