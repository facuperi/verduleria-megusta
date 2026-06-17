import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';

export const MovimientosPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [showIngreso, setShowIngreso] = useState(false);
  const [busquedaIngreso, setBusquedaIngreso] = useState('');
  const [listaIngreso, setListaIngreso] = useState([]);
  const [showCorregir, setShowCorregir] = useState(false);
  const [busquedaCorregir, setBusquedaCorregir] = useState('');
  const [listaCorregir, setListaCorregir] = useState([]);

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
      p.nombre?.toLowerCase().includes(t)
    );
  };

  const esKg = (tipo) => tipo === 'pesableConStock';

  const agregarAIngreso = (producto) => {
    if (producto.tipo === 'pesable') {
      showToast('Los productos pesables sueltos no tienen stock que gestionar', 'warning');
      return;
    }
    const existente = listaIngreso.find(p => p.id === producto.id);
    if (existente) {
      const inc = esKg(producto.tipo) ? 0.1 : 1;
      setListaIngreso(listaIngreso.map(p =>
        p.id === producto.id ? { ...p, cantidad: p.cantidad + inc } : p
      ));
    } else {
      setListaIngreso([...listaIngreso, { id: producto.id, nombre: producto.nombre, cantidad: 1, tipo: producto.tipo }]);
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
        const stockActual = producto.stock || 0;

        await updateDoc(doc(db, 'productos', item.id), {
          stock: parseFloat((stockActual + item.cantidad).toFixed(2)),
          fechaActualizado: new Date().toISOString(),
        });

        await addDoc(collection(db, 'movimientosStock'), {
          tipo: 'ingreso',
          productoId: item.id,
          productoNombre: producto.nombre,
          cantidad: item.cantidad,
          realizadoPor: user?.uid || 'gerente',
          fecha: new Date().toISOString(),
        });
      }

      const snapshot = await getDocs(collection(db, 'productos'));
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setShowIngreso(false);
      setListaIngreso([]);
      showToast('Stock agregado correctamente', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al agregar stock', 'error');
    } finally {
      setProcesando(false);
    }
  };

  const agregarACorregir = (producto) => {
    if (producto.tipo === 'pesable') {
      showToast('Los productos pesables sueltos no tienen stock que gestionar', 'warning');
      return;
    }
    const existente = listaCorregir.find(p => p.id === producto.id);
    if (existente) {
      const inc = esKg(producto.tipo) ? 0.1 : 1;
      setListaCorregir(listaCorregir.map(p =>
        p.id === producto.id ? { ...p, cantidad: p.cantidad + inc } : p
      ));
    } else {
      setListaCorregir([...listaCorregir, { id: producto.id, nombre: producto.nombre, cantidad: 1, signo: 'sumar', tipo: producto.tipo }]);
    }
    setBusquedaCorregir('');
  };

  const quitarDeCorregir = (id) => {
    setListaCorregir(listaCorregir.filter(p => p.id !== id));
  };

  const toggleSigno = (id) => {
    setListaCorregir(listaCorregir.map(p =>
      p.id === id ? { ...p, signo: p.signo === 'sumar' ? 'restar' : 'sumar' } : p
    ));
  };

  const corregirStock = async () => {
    if (listaCorregir.length === 0) {
      showToast('Agregá al menos un producto', 'warning');
      return;
    }
    setProcesando(true);
    try {
      for (const item of listaCorregir) {
        const producto = productos.find(p => p.id === item.id);
        const cambio = item.signo === 'sumar' ? item.cantidad : -item.cantidad;
        const stockActual = producto.stock || 0;
        const nuevoStock = stockActual + cambio;

        if (nuevoStock < 0) {
          showToast(`Stock insuficiente para ${producto.nombre}`, 'warning');
          setProcesando(false);
          return;
        }

        await updateDoc(doc(db, 'productos', item.id), {
          stock: parseFloat(nuevoStock.toFixed(2)),
          fechaActualizado: new Date().toISOString(),
        });

        await addDoc(collection(db, 'movimientosStock'), {
          tipo: 'corregir',
          productoId: item.id,
          productoNombre: producto.nombre,
          cantidad: item.cantidad,
          signo: item.signo,
          realizadoPor: user?.uid || 'gerente',
          fecha: new Date().toISOString(),
        });
      }

      const snapshot = await getDocs(collection(db, 'productos'));
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setShowCorregir(false);
      setListaCorregir([]);
      showToast('Stock corregido correctamente', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al corregir stock', 'error');
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return <Layout><LoadingSkeleton type="page" /></Layout>;
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Movimientos de Stock</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
          <h3 className="text-lg font-semibold mb-4">Ingreso de Mercadería</h3>
            <p className="text-sm text-muted mb-4">Agregar stock (compras, reposición)</p>
          <button
            onClick={() => { setShowIngreso(true); setListaIngreso([]); }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Abrir Ingreso
          </button>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
          <h3 className="text-lg font-semibold mb-4">Corregir Stock</h3>
            <p className="text-sm text-muted mb-4">Ajustar stock (sumar o restar)</p>
          <button
            onClick={() => { setShowCorregir(true); setListaCorregir([]); }}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Abrir Corrección
          </button>
        </div>
      </div>

      <div className="mt-8 bg-card rounded-lg shadow-sm border border-line">
        <div className="p-4 border-b border-line">
          <h3 className="text-lg font-semibold">Historial de Movimientos</h3>
        </div>
        {cargandoHistorial ? (
                <LoadingSkeleton type="table" rows={4} />
        ) : movimientos.length === 0 ? (
          <EmptyState title="No hay movimientos registrados" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-table-header">
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-center px-4 py-3">Cantidad</th>
                  <th className="text-left px-4 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} className="border-b border-line hover:bg-elevated">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        m.tipo === 'corregir' ? 'bg-purple-soft text-purple' : 'bg-green-soft text-green'
                      }`}>
                        {m.tipo === 'corregir' ? '✎ Corrección' : '⬆ Ingreso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.productoNombre}</td>
                    <td className="px-4 py-3 text-center font-semibold">{m.cantidad}</td>
                    <td className="px-4 py-3 text-muted">
                      {m.tipo === 'corregir'
                        ? `Ajustado (${m.signo === 'sumar' ? '+' : '-'}${m.cantidad})`
                        : 'Recibido'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showIngreso} onClose={() => { setShowIngreso(false); setListaIngreso([]); }} title="Ingreso de Mercadería">
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Buscar Producto</label>
              <input
                type="text"
                value={busquedaIngreso}
                onChange={(e) => setBusquedaIngreso(e.target.value)}
                placeholder="Código de barras o nombre..."
                className="w-full border border-line-input bg-input text-body p-2 rounded"
              />
              {busquedaIngreso && (
                <div className="max-h-32 overflow-y-auto border border-line mt-1 rounded">
                  {buscarProducto(busquedaIngreso).filter(p => p.tipo !== 'pesable').map(p => (
                    <div
                      key={p.id}
                      onClick={() => agregarAIngreso(p)}
                      className="p-2 hover:bg-elevated cursor-pointer border-b border-line text-sm"
                    >
                      {p.nombre}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {listaIngreso.length > 0 && (
              <div className="mb-3 border border-line rounded p-2">
                <p className="text-sm font-bold mb-2">Productos a ingresar:</p>
                {listaIngreso.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1 border-b border-line text-sm">
                    <span className="truncate w-24">{item.nombre}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={esKg(item.tipo) ? '0.1' : '1'}
                        step={esKg(item.tipo) ? '0.1' : '1'}
                        value={item.cantidad}
                        onChange={(e) => setListaIngreso(listaIngreso.map(p => p.id === item.id ? { ...p, cantidad: (esKg(item.tipo) ? parseFloat(e.target.value) : parseInt(e.target.value)) || (esKg(item.tipo) ? 0.1 : 1) } : p))}
                        className="w-20 border border-line-input bg-input text-body p-1 rounded text-center"
                      /> {esKg(item.tipo) && <span className="text-xs text-muted">kg</span>}
                      <button onClick={() => quitarDeIngreso(item.id)} className="text-red ml-2">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={agregarStock} disabled={procesando} className="bg-green-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
                {procesando ? 'Agregando...' : 'Agregar Stock'}
              </button>
              <button onClick={() => { setShowIngreso(false); setListaIngreso([]); }} className="bg-surface px-4 py-2 rounded">
                Cancelar
              </button>
            </div>
      </Modal>

      <Modal open={showCorregir} onClose={() => { setShowCorregir(false); setListaCorregir([]); }} title="Corregir Stock">
        <div className="mb-3">
          <label className="block text-sm font-bold mb-1">Buscar Producto</label>
          <input
            type="text"
            value={busquedaCorregir}
            onChange={(e) => setBusquedaCorregir(e.target.value)}
            placeholder="Código de barras o nombre..."
            className="w-full border border-line-input bg-input text-body p-2 rounded"
          />
          {busquedaCorregir && (
            <div className="max-h-32 overflow-y-auto border border-line mt-1 rounded">
              {buscarProducto(busquedaCorregir).filter(p => p.tipo !== 'pesable').map(p => (
                <div
                  key={p.id}
                  onClick={() => agregarACorregir(p)}
                  className="p-2 hover:bg-elevated cursor-pointer border-b border-line text-sm"
                >
                  {p.nombre}
                </div>
              ))}
            </div>
          )}
        </div>

        {listaCorregir.length > 0 && (
          <div className="mb-3 border border-line rounded p-2">
            <p className="text-sm font-bold mb-2">Productos a corregir:</p>
            {listaCorregir.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1 border-b border-line text-sm">
                <span className="truncate w-24">{item.nombre}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSigno(item.id)}
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      item.signo === 'sumar'
                        ? 'bg-green-soft text-green'
                        : 'bg-red-soft text-red'
                    }`}
                  >
                    {item.signo === 'sumar' ? '+ Agregar' : '– Quitar'}
                  </button>
                  <input
                    type="number"
                    min={esKg(item.tipo) ? '0.1' : '1'}
                    step={esKg(item.tipo) ? '0.1' : '1'}
                    value={item.cantidad}
                    onChange={(e) => setListaCorregir(listaCorregir.map(p => p.id === item.id ? { ...p, cantidad: (esKg(item.tipo) ? parseFloat(e.target.value) : parseInt(e.target.value)) || (esKg(item.tipo) ? 0.1 : 1) } : p))}
                    className="w-20 border border-line-input bg-input text-body p-1 rounded text-center"
                  /> {esKg(item.tipo) && <span className="text-xs text-muted">kg</span>}
                  <button onClick={() => quitarDeCorregir(item.id)} className="text-red ml-2">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={corregirStock} disabled={procesando} className="bg-purple-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
            {procesando ? 'Corrigiendo...' : 'Confirmar Corrección'}
          </button>
          <button onClick={() => { setShowCorregir(false); setListaCorregir([]); }} className="bg-surface px-4 py-2 rounded">
            Cancelar
          </button>
        </div>
      </Modal>
    </Layout>
  );
};

export default MovimientosPage;