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
  const [showMovimiento, setShowMovimiento] = useState(false);
  const [showIngreso, setShowIngreso] = useState(false);
  const [busquedaMovimiento, setBusquedaMovimiento] = useState('');
  const [busquedaIngreso, setBusquedaIngreso] = useState('');
  const [listaMovimiento, setListaMovimiento] = useState([]);
  const [listaIngreso, setListaIngreso] = useState([]);
  const [movimientoOrigen, setMovimientoOrigen] = useState('chiclana');
  const [movimientoDestino, setMovimientoDestino] = useState('belgrano');
  const [ingresoNegocio, setIngresoNegocio] = useState('chiclana');
  const [showCorregir, setShowCorregir] = useState(false);
  const [busquedaCorregir, setBusquedaCorregir] = useState('');
  const [listaCorregir, setListaCorregir] = useState([]);
  const [corregirNegocio, setCorregirNegocio] = useState('chiclana');

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

        const nuevoChiclana = movimientoOrigen === 'chiclana' ? nuevoStockOrigen : (movimientoDestino === 'chiclana' ? nuevoStockDestino : producto.stockPorNegocio.chiclana);
        const nuevoBelgrano = movimientoOrigen === 'belgrano' ? nuevoStockOrigen : (movimientoDestino === 'belgrano' ? nuevoStockDestino : producto.stockPorNegocio.belgrano);

        await updateDoc(doc(db, 'productos', item.id), {
          stockPorNegocio: {
            chiclana: nuevoChiclana,
            belgrano: nuevoBelgrano,
          },
          stockGlobal: nuevoChiclana + nuevoBelgrano,
          fechaActualizado: new Date().toISOString(),
        });

        await addDoc(collection(db, 'movimientosStock'), {
          tipo: 'movimiento',
          productoId: item.id,
          productoNombre: producto.nombre,
          codigoInterno: producto.codigoInterno,
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
          codigoInterno: producto.codigoInterno,
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

  const agregarACorregir = (producto) => {
    const existente = listaCorregir.find(p => p.id === producto.id);
    if (existente) {
      setListaCorregir(listaCorregir.map(p =>
        p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setListaCorregir([...listaCorregir, { id: producto.id, nombre: producto.nombre, cantidad: 1, signo: 'sumar' }]);
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
        const stockActual = producto.stockPorNegocio[corregirNegocio] || 0;
        const nuevoStock = stockActual + cambio;

        if (nuevoStock < 0) {
          showToast(`Stock insuficiente para ${producto.nombre} en ${corregirNegocio}`, 'warning');
          setProcesando(false);
          return;
        }

        await updateDoc(doc(db, 'productos', item.id), {
          [`stockPorNegocio.${corregirNegocio}`]: nuevoStock,
          stockGlobal: (producto.stockGlobal || 0) + cambio,
          fechaActualizado: new Date().toISOString(),
        });

        await addDoc(collection(db, 'movimientosStock'), {
          tipo: 'corregir',
          productoId: item.id,
          productoNombre: producto.nombre,
          codigoInterno: producto.codigoInterno,
          cantidad: item.cantidad,
          signo: item.signo,
          negocio: corregirNegocio,
          realizadoPor: user?.uid || 'gerente',
          fecha: new Date().toISOString(),
        });
      }

      const snapshot = await getDocs(collection(db, 'productos'));
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setShowCorregir(false);
      setListaCorregir([]);
      setCorregirNegocio('chiclana');
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
          <h3 className="text-lg font-semibold mb-4">Mover Stock entre Negocios</h3>
            <p className="text-sm text-muted mb-4">Transferir productos de un negocio a otro</p>
          <button
            onClick={() => { setShowMovimiento(true); setListaMovimiento([]); }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Abrir Movimiento
          </button>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
          <h3 className="text-lg font-semibold mb-4">Ingreso de Mercadería</h3>
            <p className="text-sm text-muted mb-4">Agregar stock a un negocio (compras, reposición)</p>
          <button
            onClick={() => { setShowIngreso(true); setListaIngreso([]); }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Abrir Ingreso
          </button>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-line">
          <h3 className="text-lg font-semibold mb-4">Corregir Stock</h3>
            <p className="text-sm text-muted mb-4">Ajustar stock de un negocio (sumar o restar)</p>
          <button
            onClick={() => { setShowCorregir(true); setListaCorregir([]); }}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Abrir Corrección
          </button>
        </div>
      </div>

      {/* Historial de movimientos */}
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
                  <th className="text-left px-4 py-3">Código</th>
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
                        m.tipo === 'movimiento' ? 'bg-blue-soft text-blue' : m.tipo === 'corregir' ? 'bg-purple-soft text-purple' : 'bg-green-soft text-green'
                      }`}>
                        {m.tipo === 'movimiento' ? '↔ Movimiento' : m.tipo === 'corregir' ? '✎ Corrección' : '⬆ Ingreso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.productoNombre}</td>
                    <td className="px-4 py-3 text-muted text-sm">{m.codigoInterno || '-'}</td>
                    <td className="px-4 py-3 text-center font-semibold">{m.cantidad}</td>
                    <td className="px-4 py-3 text-muted">
                      {m.tipo === 'movimiento'
                        ? `${m.origen} → ${m.destino}`
                        : m.tipo === 'corregir'
                        ? `Ajustado en ${m.negocio} (${m.signo === 'sumar' ? '+' : '-'}${m.cantidad})`
                        : `Recibido en ${m.negocio}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showMovimiento} onClose={() => { setShowMovimiento(false); setListaMovimiento([]); }} title="Mover Stock entre Negocios">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-sm font-bold mb-1">Origen</label>
            <select
              value={movimientoOrigen}
              onChange={(e) => setMovimientoOrigen(e.target.value)}
              className="w-full border border-line-input bg-input text-body p-2 rounded"
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
              className="w-full border border-line-input bg-input text-body p-2 rounded"
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
            className="w-full border border-line-input bg-input text-body p-2 rounded"
          />
          {busquedaMovimiento && (
            <div className="max-h-32 overflow-y-auto border border-line mt-1 rounded">
              {buscarProducto(busquedaMovimiento).map(p => (
                <div
                  key={p.id}
                  onClick={() => agregarAMovimiento(p)}
                  className="p-2 hover:bg-elevated cursor-pointer border-b border-line text-sm"
                >
                  {p.nombre} ({p.codigoInterno})
                </div>
              ))}
            </div>
          )}
        </div>

        {listaMovimiento.length > 0 && (
          <div className="mb-3 border border-line rounded p-2">
            <p className="text-sm font-bold mb-2">Productos a mover:</p>
            {listaMovimiento.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1 border-b border-line text-sm">
                <span className="truncate w-24">{item.nombre}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => setListaMovimiento(listaMovimiento.map(p => p.id === item.id ? { ...p, cantidad: parseInt(e.target.value) || 1 } : p))}
                    className="w-16 border border-line-input bg-input text-body p-1 rounded text-center"
                  />
                  <button                     onClick={() => quitarDeMovimiento(item.id)} className="text-red ml-2">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={moverStock} disabled={procesando} className="bg-blue-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
            {procesando ? 'Moviendo...' : 'Confirmar Movimiento'}
          </button>
          <button onClick={() => { setShowMovimiento(false); setListaMovimiento([]); }} className="bg-surface px-4 py-2 rounded">
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={showIngreso} onClose={() => { setShowIngreso(false); setListaIngreso([]); }} title="Ingreso de Mercadería">
            
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Negocio destino</label>
              <select
                value={ingresoNegocio}
                onChange={(e) => setIngresoNegocio(e.target.value)}
                className="w-full border border-line-input bg-input text-body p-2 rounded"
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
                className="w-full border border-line-input bg-input text-body p-2 rounded"
              />
              {busquedaIngreso && (
                <div className="max-h-32 overflow-y-auto border border-line mt-1 rounded">
                  {buscarProducto(busquedaIngreso).map(p => (
                    <div
                      key={p.id}
                      onClick={() => agregarAIngreso(p)}
                      className="p-2 hover:bg-elevated cursor-pointer border-b border-line text-sm"
                    >
                      {p.nombre} ({p.codigoInterno})
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
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => setListaIngreso(listaIngreso.map(p => p.id === item.id ? { ...p, cantidad: parseInt(e.target.value) || 1 } : p))}
                        className="w-16 border border-line-input bg-input text-body p-1 rounded text-center"
                      />
                      <button                     onClick={() => quitarDeIngreso(item.id)} className="text-red ml-2">✕</button>
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
          <label className="block text-sm font-bold mb-1">Negocio a corregir</label>
          <select
            value={corregirNegocio}
            onChange={(e) => setCorregirNegocio(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
          >
            <option value="chiclana">Chiclana</option>
            <option value="belgrano">Belgrano</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold mb-1">Buscar Producto</label>
          <input
            type="text"
            value={busquedaCorregir}
            onChange={(e) => setBusquedaCorregir(e.target.value)}
            placeholder="Código, código interno o nombre..."
            className="w-full border border-line-input bg-input text-body p-2 rounded"
          />
          {busquedaCorregir && (
            <div className="max-h-32 overflow-y-auto border border-line mt-1 rounded">
              {buscarProducto(busquedaCorregir).map(p => (
                <div
                  key={p.id}
                  onClick={() => agregarACorregir(p)}
                  className="p-2 hover:bg-elevated cursor-pointer border-b border-line text-sm"
                >
                  {p.nombre} ({p.codigoInterno})
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
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => setListaCorregir(listaCorregir.map(p => p.id === item.id ? { ...p, cantidad: parseInt(e.target.value) || 1 } : p))}
                    className="w-16 border border-line-input bg-input text-body p-1 rounded text-center"
                  />
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