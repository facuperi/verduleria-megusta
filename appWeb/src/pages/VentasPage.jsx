import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
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
  const [observacion, setObservacion] = useState('');
  const [ventaExitosa, setVentaExitosa] = useState(null);
  
  // Métodos de pago seleccionados
  const [pagosSeleccionados, setPagosSeleccionados] = useState([{ metodo: 'efectivo', monto: 0 }]);
  
  const inputScannerRef = useRef(null);

  const totalVenta = carrito
    .filter(p => !p.esNotaCredito)
    .reduce((sum, p) => {
      const precio = p.precioSeleccionado === 'tarjeta' ? p.precioTarjeta : p.precioEfectivo;
      return sum + (precio * p.cantidad);
    }, 0);

  const totalNotaCredito = carrito
    .filter(p => p.esNotaCredito)
    .reduce((sum, p) => {
      const precio = p.precioSeleccionado === 'tarjeta' ? p.precioTarjeta : p.precioEfectivo;
      return sum + (precio * p.cantidad);
    }, 0);

  const diferencia = totalVenta - totalNotaCredito;
  const total = Math.max(0, diferencia);

  useEffect(() => {
    if (carrito.length > 0 && diferencia > 0) {
      setPagosSeleccionados([{ metodo: 'efectivo', monto: diferencia }]);
    } else if (carrito.length > 0 && diferencia <= 0) {
      setPagosSeleccionados([{ metodo: 'efectivo', monto: 0 }]);
    }
  }, [carrito.length, diferencia]);
  
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
    const existe = carrito.find(p => p.id === producto.id && p.precioSeleccionado === tipoPrecio);
    if (existe) {
      setCarrito(carrito.map(p => 
        p.id === producto.id && p.precioSeleccionado === tipoPrecio ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1, precioSeleccionado: tipoPrecio, esNotaCredito: false }]);
    }
    setBusqueda('');
    setVentaExitosa(null);
  };

  const quitarDelCarrito = (productoId, precioSeleccionado) => {
    setCarrito(carrito.filter(p => !(p.id === productoId && p.precioSeleccionado === precioSeleccionado)));
    setVentaExitosa(null);
  };

  const actualizarCantidad = (productoId, precioSeleccionado, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      quitarDelCarrito(productoId, precioSeleccionado);
      return;
    }
    setCarrito(carrito.map(p => 
      p.id === productoId && p.precioSeleccionado === precioSeleccionado ? { ...p, cantidad: nuevaCantidad } : p
    ));
  };

  const toggleNotaCredito = (productoId, precioSeleccionado) => {
    setCarrito(carrito.map(p => 
      p.id === productoId && p.precioSeleccionado === precioSeleccionado ? { ...p, esNotaCredito: !p.esNotaCredito } : p
    ));
  };

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

  const imprimirTicketAFavor = () => {
    const monto = Math.abs(diferencia);
    const fecha = new Date().toLocaleString();
    const ticket = `
╔══════════════════════════════╗
║     NOTA DE CRÉDITO A FAVOR   ║
╠══════════════════════════════╣
║ Fecha: ${fecha}
║ Negocio: ${caja?.sucursal || 'N/A'}
║
║ MONTO A FAVOR: $${monto.toFixed(2)}
║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
║ Este ticket acredita que el
║ cliente tiene saldo a favor
║ de $${monto.toFixed(2)}
║
║ Atendido por: ${user?.email || 'Usuario'}
╚══════════════════════════════╝
    `.trim();
    
    const printWindow = window.open('', '_blank', 'width=300,height=400');
    printWindow.document.write(`
      <html>
        <head>
          <title>Nota de Crédito</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${ticket}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const imprimirTicketVenta = () => {
    if (!ventaExitosa || !caja) return;
    
    const fecha = new Date().toLocaleString('es-AR');
    const direccion = caja.sucursal === 'chiclana' ? 'Chiclana 115' : caja.sucursal === 'belgrano' ? 'Belgrano 84' : caja.sucursal;
    const ventaId = ventaExitosa.id.slice(-6).toUpperCase();
    
    let ticket = `====================================
      SANTOS Y SANTAS
    ${direccion}
    Tel: 2915245537
====================================
${fecha}    Vta: ${ventaId}
───────────────────────────────────
PRODUCTO              CANT    IMP
───────────────────────────────────`;
    
    const ventasNormales = ventaExitosa.productos.filter(p => !p.esNotaCredito);
    const notasCredito = ventaExitosa.productos.filter(p => p.esNotaCredito);
    
    for (const item of ventasNormales) {
      const nombre = item.nombre.length > 18 ? item.nombre.substring(0, 16) + '..' : item.nombre.padEnd(18);
      const importe = (item.precio * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 });
      ticket += `
${nombre} ${item.cantidad.toString().padStart(3)}  ${importe.padStart(5)}`;
    }
    
    if (ventasNormales.length > 0) {
      ticket += `
───────────────────────────────────`;
    }
    
    if (notasCredito.length > 0) {
      ticket += `
NOTA CRÉDITO:`;
      for (const item of notasCredito) {
        const nombre = item.nombre.length > 18 ? item.nombre.substring(0, 16) + '..' : item.nombre.padEnd(18);
        const importe = (item.precio * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 });
        ticket += `
${nombre} ${item.cantidad.toString().padStart(3)} -${importe.padStart(5)}`;
      }
    }
    
    const total = ventaExitosa.total.toLocaleString('es-AR', { minimumFractionDigits: 0 });
    
    ticket += `
───────────────────────────────────
TOTAL:                     $${total}
───────────────────────────────────`;
    
    const metodosPago = ventaExitosa.tipoPago.map(p => {
      const nombres = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', debito: 'Débito', mercadopago: 'MercadoPago', Cuentadni: 'Cuenta DNI' };
      return nombres[p.metodo] || p.metodo;
    }).join(', ');
    
    ticket += `
PAGO: ${metodosPago}
====================================
     Gracias por su compra!
        Vuelve pronto :)
====================================`;
    
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket de Venta</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 11px; white-space: pre; margin: 0; padding: 5px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${ticket}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const realizarVenta = async () => {
    if (!caja) {
      setError('No hay caja abierta. Abrí la caja primero.');
      return;
    }
    if (carrito.length === 0) return;
    
    if (diferencia > 0 && totalPagos !== diferencia) {
      setError(`El total de los pagos debe ser igual a $${diferencia}`);
      return;
    }
    if (diferencia <= 0 && totalPagos !== 0) {
      setError('No hay monto a pagar. Los pagos deben ser $0');
      return;
    }

    setVendiendo(true);
    setError('');
    try {
      // Crear la venta
      const ahora = new Date();
      const tieneNotaCredito = carrito.some(p => p.esNotaCredito);
      const tieneVentaNormal = carrito.some(p => !p.esNotaCredito);
      
      let tipoVenta = 'normal';
      if (tieneNotaCredito && tieneVentaNormal) tipoVenta = 'mixta';
      else if (tieneNotaCredito) tipoVenta = 'notaCredito';

      const productosVenta = carrito.map(item => {
        const precio = item.precioSeleccionado === 'tarjeta' ? item.precioTarjeta : item.precioEfectivo;
        return {
          productoId: item.id,
          nombre: item.nombre,
          codigoInterno: item.codigoInterno,
          cantidad: item.cantidad,
          precio,
          tipoPrecio: item.precioSeleccionado,
          esNotaCredito: item.esNotaCredito || false,
        };
      });

      const ventaDoc = await addDoc(collection(db, 'ventas'), {
        negocio: caja.sucursal,
        productos: productosVenta,
        total,
        totalVenta,
        totalNotaCredito,
        diferencia,
        tipoVenta,
        observacion: observacion || null,
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
        const stockGlobalActual = productoData.stockGlobal || 0;
        
        const cambioStock = item.esNotaCredito ? item.cantidad : -item.cantidad;
        const nuevoStock = stockActual + cambioStock;
        const nuevoStockGlobal = stockGlobalActual + cambioStock;
        
        await updateDoc(productoRef, {
          [`stockPorNegocio.${caja.sucursal}`]: nuevoStock,
          stockGlobal: nuevoStockGlobal,
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
            'debito': 'ventasDebito',
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
      setObservacion('');
      setVentaExitosa({
        id: ventaDoc.id,
        total,
        productos: productosVenta,
        tipoPago: pagosSeleccionados,
        tipoVenta,
        negocio: caja.sucursal,
      });
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
              {carrito.map((item, index) => {
                const precio = item.precioSeleccionado === 'tarjeta' ? item.precioTarjeta : item.precioEfectivo;
                const cambiarTipoPrecio = (nuevoTipo) => {
                  setCarrito(carrito.map((p, i) => 
                    i === index ? { ...p, precioSeleccionado: nuevoTipo } : p
                  ));
                };
                const itemKey = `${item.id}-${item.precioSeleccionado}`;
                return (
                  <div key={itemKey} className={`py-2 border-b ${item.esNotaCredito ? 'bg-red-50 -mx-4 px-4' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${item.esNotaCredito ? 'text-red-700' : ''}`}>
                          {item.esNotaCredito && '⚠️ '}{item.nombre}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${precio} x {item.cantidad}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => actualizarCantidad(item.id, item.precioSeleccionado, item.cantidad - 1)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          -
                        </button>
                        <span className="text-sm">{item.cantidad}</span>
                        <button
                          onClick={() => actualizarCantidad(item.id, item.precioSeleccionado, item.cantidad + 1)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => quitarDelCarrito(item.id, item.precioSeleccionado)}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <select
                        value={item.precioSeleccionado}
                        onChange={(e) => cambiarTipoPrecio(e.target.value)}
                        className="text-xs border rounded px-1 py-0.5"
                      >
                        <option value="efectivo">Efectivo: ${item.precioEfectivo}</option>
                        <option value="tarjeta">Tarjeta: ${item.precioTarjeta}</option>
                      </select>
                      <button
                        onClick={() => toggleNotaCredito(item.id, item.precioSeleccionado)}
                        className={`text-xs px-2 py-0.5 rounded border ${item.esNotaCredito ? 'bg-red-600 text-white border-red-600' : 'bg-gray-100 text-gray-600 border-gray-300'}`}
                      >
                        {item.esNotaCredito ? 'Nota Crédito' : 'Venta'}
                      </button>
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-4 pt-4 border-t">
                {totalNotaCredito > 0 && (
                  <div className="text-sm mb-2">
                    <p className="text-red-600">Nota Crédito: -${totalNotaCredito}</p>
                    {diferencia < 0 && (
                      <div className="flex items-center justify-between bg-green-50 p-2 rounded mt-1">
                        <p className="text-green-700 font-semibold">A favor: $${Math.abs(diferencia)}</p>
                        <button
                          onClick={imprimirTicketAFavor}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                        >
                          🖨️ Imprimir Ticket
                        </button>
                      </div>
                    )}
                    {diferencia > 0 && (
                      <p className="text-blue-600">El cliente debe pagar: ${diferencia}</p>
                    )}
                    {diferencia === 0 && (
                      <p className="text-gray-600">Sin costo adicional</p>
                    )}
                  </div>
                )}
                <p className="text-xl font-bold">Total: ${total}</p>
              </div>
              
              {totalNotaCredito > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-semibold mb-1">Observación / Motivo</label>
                  <textarea
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Ej: Error de precio, cliente devolvió producto..."
                    className="w-full border p-2 rounded text-sm"
                    rows={2}
                  />
                </div>
              )}
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

          {ventaExitosa && (
            <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm">
                  ✅ Venta #{ventaExitosa.id.slice(-6).toUpperCase()} - Total: <span className="font-bold">${ventaExitosa.total.toLocaleString('es-AR')}</span>
                </span>
                <button 
                  onClick={imprimirTicketVenta} 
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  🖨️ Imprimir Ticket
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