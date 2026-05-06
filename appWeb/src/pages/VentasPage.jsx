import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'mercadopago', nombre: 'MercadoPago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

export const VentasPage = () => {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendiendo, setVendiendo] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [caja, setCaja] = useState(null);
  
  // Métodos de pago seleccionados
  const [pagosSeleccionados, setPagosSeleccionados] = useState([{ metodo: 'efectivo', monto: 0 }]);
  
  const inputScannerRef = useRef(null);
  
  const restriction = checkDeviceRestriction('venta');
  const canSell = !isMobile || restriction.allowed.includes('mobile');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar productos
        const productosSnapshot = await getDocs(collection(db, 'productos'));
        setProductos(productosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        // Verificar caja abierta
        const cajaQuery = query(collection(db, 'caja'), where('estado', '==', 'abierta'));
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          const cajaData = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
          setCaja(cajaData);
        }
      } catch (err) {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Focus en input de scanner
  useEffect(() => {
    if (inputScannerRef.current && !isMobile) {
      inputScannerRef.current.focus();
    }
  }, [isMobile]);

  const buscarProducto = (texto) => {
    const textoLower = texto.toLowerCase().trim();
    return productos.filter(p => 
      p.codigoBarras?.includes(textoLower) ||
      p.codigoInterno?.toLowerCase().includes(textoLower) ||
      p.nombre?.toLowerCase().includes(textoLower)
    );
  };

  const agregarAlCarrito = (producto, tipoPrecio = 'efectivo') => {
    const existe = carrito.find(p => p.id === producto.id);
    if (existe) {
      setCarrito(carrito.map(p => 
        p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1, precioSeleccionado: tipoPrecio }]);
    }
    setBusqueda('');
  };

  const quitarDelCarrito = (productoId) => {
    setCarrito(carrito.filter(p => p.id !== productoId));
  };

  const actualizarCantidad = (productoId, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      quitarDelCarrito(productoId);
      return;
    }
    setCarrito(carrito.map(p => 
      p.id === productoId ? { ...p, cantidad: nuevaCantidad } : p
    ));
  };

  const total = carrito.reduce((sum, p) => {
    const precio = p.precioSeleccionado === 'tarjeta' ? p.precioTarjeta : p.precioEfectivo;
    return sum + (precio * p.cantidad);
  }, 0);

  const handlePagoChange = (index, campo, valor) => {
    const nuevosPagos = [...pagosSeleccionados];
    nuevosPagos[index][campo] = valor;
    setPagosSeleccionados(nuevosPagos);
  };

  const agregarMetodoPago = () => {
    setPagosSeleccionados([...pagosSeleccionados, { metodo: 'efectivo', monto: 0 }]);
  };

  const quitarMetodoPago = (index) => {
    if (pagosSeleccionados.length > 1) {
      const nuevosPagos = pagosSeleccionados.filter((_, i) => i !== index);
      setPagosSeleccionados(nuevosPagos);
    }
  };

  const totalPagos = pagosSeleccionados.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);

  const realizarVenta = async () => {
    if (!caja) {
      setError('No hay caja abierta. Abrí la caja primero.');
      return;
    }
    if (carrito.length === 0) return;
    if (totalPagos !== total) {
      setError('El total de los pagos debe ser igual al total de la venta');
      return;
    }

    setVendiendo(true);
    setError('');
    try {
      // Crear la venta
      const ahora = new Date();
      const productosVenta = carrito.map(item => {
        const precio = item.precioSeleccionado === 'tarjeta' ? item.precioTarjeta : item.precioEfectivo;
        return {
          productoId: item.id,
          nombre: item.nombre,
          codigoInterno: item.codigoInterno,
          cantidad: item.cantidad,
          precio,
          tipoPrecio: item.precioSeleccionado,
        };
      });

      const ventaDoc = await addDoc(collection(db, 'ventas'), {
        negocio: caja.sucursal,
        productos: productosVenta,
        total,
        tipoPago: pagosSeleccionados.map(p => p.metodo),
        facturada: false,
        usuarioId: user.uid,
        usuarioNombre: user.email || 'Usuario',
        fecha: serverTimestamp(),
        hora: ahora.toISOString(),
      });

      // Actualizar stock del negocio
      for (const item of carrito) {
        const productoRef = doc(db, 'productos', item.id);
        const productoDoc = await getDoc(productoRef);
        const productoData = productoDoc.data();
        
        const stockActual = productoData.stockPorNegocio?.[caja.sucursal] || 0;
        const nuevoStock = stockActual - item.cantidad;
        
        await updateDoc(productoRef, {
          [`stockPorNegocio.${caja.sucursal}`]: nuevoStock,
          stockGlobal: (productoData.stockGlobal || 0) - item.cantidad,
        });
      }

      // Actualizar caja - ventas por método
      const updateData = {};
      for (const pago of pagosSeleccionados) {
        if (pago.monto > 0) {
          const campo = `ventas${pago.metodo.charAt(0).toUpperCase() + pago.metodo.slice(1)}`;
          // Convertir primera letra mayúscula pero mantener el formato del campo
          const campoKey = {
            'efectivo': 'ventasEfectivo',
            'tarjeta': 'ventasTarjeta',
            'mercadopago': 'ventasMercadoPago',
            'cuentadni': 'ventasCuentaDNI',
          }[pago.metodo];
          
          updateData[campoKey] = (caja[campoKey] || 0) + parseFloat(pago.monto);
          
          if (pago.metodo === 'efectivo') {
            updateData.montoEfectivo = (caja.montoEfectivo || 0) + parseFloat(pago.monto);
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, 'caja', caja.id), updateData);
      }

      // Recargar datos
      const productosActualizados = await getDocs(collection(db, 'productos'));
      setProductos(productosActualizados.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      setCarrito([]);
      setPagosSeleccionados([{ metodo: 'efectivo', monto: 0 }]);
      alert('Venta realizada con éxito');
    } catch (err) {
      console.error(err);
      setError('Error al realizar venta');
    } finally {
      setVendiendo(false);
    }
  };

  // Función para manejar el scanner de código de barras
  const handleScannerInput = (e) => {
    const valor = e.target.value;
    if (valor.length >= 8 && valor.endsWith('\n')) {
      const codigo = valor.trim();
      const resultados = buscarProducto(codigo);
      if (resultados.length === 1) {
        agregarAlCarrito(resultados[0]);
        e.target.value = '';
      } else if (resultados.length > 1) {
        setBusqueda(codigo);
      }
      e.target.value = '';
    }
  };

  const productosFiltrados = busqueda ? buscarProducto(busqueda) : [];

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
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
      {!caja && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ⚠️ No hay caja abierta. <a href="/caja" className="underline font-semibold">Abrir caja</a> para poder vender.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna 1: Búsqueda y productos */}
        <div className="md:col-span-2">
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h3 className="font-semibold mb-2">Buscar producto (código de barras, código interno o nombre)</h3>
            <input
              ref={inputScannerRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={handleScannerInput}
              placeholder="Escaneá o escribí para buscar..."
              className="w-full border p-2 rounded"
            />
            
            {busqueda && (
              <div className="mt-2 max-h-60 overflow-y-auto">
                {productosFiltrados.length === 0 ? (
                  <p className="text-gray-500">No se encontraron productos</p>
                ) : (
                  productosFiltrados.map(producto => (
                    <div
                      key={producto.id}
                      onClick={() => agregarAlCarrito(producto)}
                      className="p-2 hover:bg-gray-100 cursor-pointer border-b flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold">{producto.nombre}</p>
                        <p className="text-sm text-gray-500">{producto.codigoInterno}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-600">EF: ${producto.precioEfectivo}</p>
                        <p className="text-blue-600">TJ: ${producto.precioTarjeta}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {caja && (
            <p className="text-sm text-gray-500 mb-2">Vendiendo en: <span className="font-semibold capitalize">{caja.sucursal}</span></p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {productos
              .filter(p => (p.stockPorNegocio?.[caja?.sucursal] || 0) > 0)
              .map(producto => (
                <div
                  key={producto.id}
                  onClick={() => agregarAlCarrito(producto)}
                  className="bg-white p-3 rounded-lg shadow cursor-pointer hover:bg-gray-50"
                >
                  <h4 className="font-semibold text-sm">{producto.nombre}</h4>
                  <p className="text-xs text-gray-500">{producto.codigoInterno}</p>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-green-600">EF: ${producto.precioEfectivo}</span>
                    <span className="text-blue-600">TJ: ${producto.precioTarjeta}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Stock: {producto.stockPorNegocio?.[caja?.sucursal] || 0}
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* Columna 2: Carrito y pagos */}
        <div>
          <h3 className="text-xl font-bold mb-4">Carrito</h3>
          
          {error && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">{error}</div>
          )}
          
          {carrito.length === 0 ? (
            <p className="text-gray-500">El carrito está vacío</p>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow mb-4">
              {carrito.map(item => {
                const precio = item.precioSeleccionado === 'tarjeta' ? item.precioTarjeta : item.precioEfectivo;
                const cambiarTipoPrecio = (nuevoTipo) => {
                  setCarrito(carrito.map(p => 
                    p.id === item.id ? { ...p, precioSeleccionado: nuevoTipo } : p
                  ));
                };
                return (
                  <div key={item.id} className="py-2 border-b">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.nombre}</p>
                        <p className="text-xs text-gray-500">
                          ${precio} x {item.cantidad}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          -
                        </button>
                        <span className="text-sm">{item.cantidad}</span>
                        <button
                          onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => quitarDelCarrito(item.id)}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1">
                      <select
                        value={item.precioSeleccionado}
                        onChange={(e) => cambiarTipoPrecio(e.target.value)}
                        className="text-xs border rounded px-1 py-0.5"
                      >
                        <option value="efectivo">Efectivo: ${item.precioEfectivo}</option>
                        <option value="tarjeta">Tarjeta: ${item.precioTarjeta}</option>
                      </select>
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-xl font-bold">Total: ${total}</p>
              </div>
            </div>
          )}

          {/* Métodos de pago */}
          {carrito.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow mb-4">
              <h4 className="font-semibold mb-2">Métodos de Pago</h4>
              
              {pagosSeleccionados.map((pago, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    value={pago.metodo}
                    onChange={(e) => handlePagoChange(index, 'metodo', e.target.value)}
                    className="border p-2 rounded text-sm"
                  >
                    {METODOS_PAGO.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={pago.monto}
                    onChange={(e) => handlePagoChange(index, 'monto', e.target.value)}
                    placeholder="Monto"
                    className="border p-2 rounded text-sm w-24"
                  />
                  {pagosSeleccionados.length > 1 && (
                    <button
                      onClick={() => quitarMetodoPago(index)}
                      className="text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              
              <button
                onClick={agregarMetodoPago}
                className="text-sm text-blue-600 hover:underline mb-2"
              >
                + Agregar otro método
              </button>

              <div className="text-sm text-gray-500 mt-2">
                <p>Pagado: ${totalPagos}</p>
                {totalPagos !== total && (
                  <p className="text-red-500">Falta: ${total - totalPagos}</p>
                )}
              </div>

              <button
                onClick={realizarVenta}
                disabled={vendiendo || !caja || totalPagos !== total}
                className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {vendiendo ? 'Procesando...' : 'Vender'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default VentasPage;