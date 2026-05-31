import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';
import { BuscadorProductos } from '../components/BuscadorProductos';
import { CarritoVentas } from '../components/CarritoVentas';
import { imprimirTicketAFavor, imprimirTicketVenta } from '../utils/ticketPrinter';
import { Modal } from '../components/Modal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';

const FIREBASE_FUNCTIONS_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL;
const AFIP_PTO_VTA = parseInt(import.meta.env.VITE_AFIP_PTO_VTA) || 9;

const calcularIva = (total) => {
  const neto = Math.round(total / 1.21 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
};

const necesitaFacturaAuto = (tiposPago) => {
  const metodosAuto = ['tarjeta', 'debito', 'cuentadni'];
  return metodosAuto.some(m => tiposPago.includes(m));
};

const facturarVenta = async (ventaId, total, tipoFactura, documentoCliente) => {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;
    const response = await fetch(FIREBASE_FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ ventaId, total, tipoFactura, documentoCliente })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al facturar');
    }
    return await response.json();
  } catch (error) {
    console.error('Error al facturar:', error);
    throw error;
  }
};

export const VentasPage = () => {
  const { user, selectedNegocio } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendiendo, setVendiendo] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [caja, setCaja] = useState(null);
  const [observacion, setObservacion] = useState('');
  const [ventaExitosa, setVentaExitosa] = useState(null);
  const [facturaData, setFacturaData] = useState(null);
  const [facturando, setFacturando] = useState(false);
  const [agregarComoNotaCredito, setAgregarComoNotaCredito] = useState(false);
  
  // Modal facturación
  const [mostrarModalFactura, setMostrarModalFactura] = useState(false);
  const [tipoFacturaSeleccionado, setTipoFacturaSeleccionado] = useState(null);
  const [cuitCliente, setCuitCliente] = useState('');
  
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
        
        // Verificar caja abierta del negocio
        if (!user || !selectedNegocio) {
          setCaja(null);
          setLoading(false);
          return;
        }
        const cajaQuery = query(collection(db, 'caja'), where('estado', '==', 'abierta'), where('sucursal', '==', selectedNegocio));
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          const cajaData = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
          setCaja(cajaData);
        } else {
          setCaja(null);
        }
      } catch (err) {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

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
      setCarrito([...carrito, { ...producto, cantidad: 1, precioSeleccionado: tipoPrecio, esNotaCredito: agregarComoNotaCredito }]);
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

  const cambiarTipoPrecio = (index, nuevoTipo) => {
    setCarrito(carrito.map((p, i) =>
      i === index ? { ...p, precioSeleccionado: nuevoTipo } : p
    ));
  };

  const handleFacturarManual = async () => {
    if (!ventaExitosa) return;
    setTipoFacturaSeleccionado('B');
    setCuitCliente('');
    setMostrarModalFactura(true);
  };

  const handleFacturaA = () => {
    if (!ventaExitosa) return;
    setTipoFacturaSeleccionado('A');
    setCuitCliente('');
    setMostrarModalFactura(true);
  };

  const handleConfirmarFactura = async () => {
    if (!ventaExitosa) return;
    
    if (tipoFacturaSeleccionado === 'A' && (!cuitCliente || cuitCliente.length !== 11)) {
      showToast('Para Factura A debe ingresar un CUIT válido (11 dígitos)', 'warning');
      return;
    }
    
    setMostrarModalFactura(false);
    setFacturando(true);
    try {
      const resultado = await facturarVenta(
        ventaExitosa.id,
        ventaExitosa.total,
        tipoFacturaSeleccionado,
        tipoFacturaSeleccionado === 'A' ? cuitCliente : null
      );
      setFacturaData(resultado);
      
      await updateDoc(doc(db, 'ventas', ventaExitosa.id), {
        cae: resultado.cae,
        facturaNumero: resultado.numero,
        facturaFechaVto: resultado.fechaVto,
        facturaTipo: `Factura ${tipoFacturaSeleccionado}`,
        facturaPtoVta: AFIP_PTO_VTA,
        facturaNeto: resultado.neto,
        facturaIva: resultado.iva,
        facturaDocCliente: tipoFacturaSeleccionado === 'A' ? cuitCliente : null
      });
    } catch (error) {
      showToast(`Error al facturar: ${error.message}`, 'error');
    } finally {
      setFacturando(false);
    }
  };

  const handleFacturaAuto = async (tipo) => {
    if (!ventaExitosa) return;
    
    if (tipo === 'A') {
      setTipoFacturaSeleccionado('A');
      setMostrarModalFactura(true);
    } else {
      setFacturando(true);
      try {
        const resultado = await facturarVenta(ventaExitosa.id, ventaExitosa.total, 'B', null);
        setFacturaData(resultado);
      } catch (error) {
        showToast(`Error al facturar: ${error.message}`, 'error');
      } finally {
        setFacturando(false);
      }
    }
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
      setFacturaData(null);
      setAgregarComoNotaCredito(false);
      
      const nuevaVenta = {
        id: ventaDoc.id,
        total,
        productos: productosVenta,
        tipoPago: pagosSeleccionados.map(p => p.metodo),
        tipoVenta,
        negocio: caja.sucursal,
      };
      setVentaExitosa(nuevaVenta);
      
      if (necesitaFacturaAuto(pagosSeleccionados.map(p => p.metodo))) {
        const quiereFacturaA = await confirm(
          'Este método de pago requiere factura electrónica. ¿Qué tipo de factura querés emitir?',
          'Facturación',
          'Factura A (con CUIT)',
          'Factura B (consumidor final)'
        );
        
        if (quiereFacturaA) {
          setTipoFacturaSeleccionado('A');
          setCuitCliente('');
          setMostrarModalFactura(true);
        } else {
          setFacturando(true);
          try {
            const resultado = await facturarVenta(ventaDoc.id, total, 'B', null);
            setFacturaData(resultado);
            
            await updateDoc(doc(db, 'ventas', ventaDoc.id), {
              cae: resultado.cae,
              facturaNumero: resultado.numero,
              facturaFechaVto: resultado.fechaVto,
              facturaTipo: 'Factura B',
              facturaPtoVta: AFIP_PTO_VTA,
              facturaNeto: resultado.neto,
              facturaIva: resultado.iva
            });
          } catch (error) {
            console.error('Error en facturación automática:', error);
          } finally {
            setFacturando(false);
          }
        }
      }
      
      showToast('Venta realizada con éxito', 'success');
    } catch (err) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError('La caja fue cerrada en otro dispositivo. Recargá la página.');
      } else {
        setError('Error al realizar venta');
      }
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
    return <Layout><LoadingSkeleton type="page" /></Layout>;
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
        <div className="md:col-span-2">
          <BuscadorProductos
            busqueda={busqueda}
            productosFiltrados={productosFiltrados}
            productos={productos}
            sucursal={caja?.sucursal}
            agregarComoNotaCredito={agregarComoNotaCredito}
            inputRef={inputScannerRef}
            onBusquedaChange={setBusqueda}
            onKeyDown={handleScannerInput}
            onToggleNotaCredito={() => setAgregarComoNotaCredito(!agregarComoNotaCredito)}
            onProductClick={(p) => agregarAlCarrito(p)}
          />
        </div>

        <div>
          <CarritoVentas
            carrito={carrito}
            totalVenta={totalVenta}
            totalNotaCredito={totalNotaCredito}
            diferencia={diferencia}
            total={total}
            observacion={observacion}
            pagosSeleccionados={pagosSeleccionados}
            vendiendo={vendiendo}
            caja={caja}
            totalPagos={totalPagos}
            error={error}
            onCambiarCantidad={actualizarCantidad}
            onQuitarDelCarrito={quitarDelCarrito}
            onCambiarTipoPrecio={cambiarTipoPrecio}
            onToggleNotaCredito={toggleNotaCredito}
            onPagoChange={handlePagoChange}
            onAgregarMetodoPago={agregarMetodoPago}
            onQuitarMetodoPago={quitarMetodoPago}
            onObservacionChange={setObservacion}
            onImprimirAFavor={() => imprimirTicketAFavor(diferencia, caja, user?.email)}
            onRealizarVenta={realizarVenta}
          />

          {ventaExitosa && (
            <div className="bg-green-50 border border-green-400 text-green-700 p-4 rounded-lg shadow mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold">✅ Venta exitosa</p>
                  <p className="text-sm">Total: ${ventaExitosa.total}</p>
                </div>
                <button
                  onClick={() => imprimirTicketVenta(ventaExitosa, caja, facturaData)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  🖨️ Imprimir Ticket
                </button>
              </div>
              {!facturaData && !facturando && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleFacturaA}
                    className="flex-1 bg-blue-100 text-blue-700 py-1 px-2 rounded text-xs hover:bg-blue-200"
                  >
                    📄 Factura A
                  </button>
                  <button
                    onClick={handleFacturarManual}
                    className="flex-1 bg-gray-100 text-gray-700 py-1 px-2 rounded text-xs hover:bg-gray-200"
                  >
                    📄 Cons. Final
                  </button>
                </div>
              )}
              {facturando && (
                <p className="mt-2 text-sm text-blue-600">⏳ Generando factura...</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={mostrarModalFactura} onClose={() => setMostrarModalFactura(false)} title={tipoFacturaSeleccionado === 'A' ? '📄 Factura A' : '📄 Factura Consumidor Final'}>
        {tipoFacturaSeleccionado === 'A' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1">CUIT del comprador (sin guiones)</label>
            <input
              type="text"
              value={cuitCliente}
              onChange={(e) => setCuitCliente(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 20123456789"
              maxLength={11}
              className="w-full border p-2 rounded"
            />
            <p className="text-xs text-gray-500 mt-1">Ingresá los 11 dígitos del CUIT</p>
          </div>
        )}
        
        {tipoFacturaSeleccionado === 'B' && (
          <p className="mb-4 text-gray-600">Se generará una Factura B para consumidor final.</p>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={handleConfirmarFactura}
            disabled={tipoFacturaSeleccionado === 'A' && (!cuitCliente || cuitCliente.length !== 11)}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            onClick={() => setMostrarModalFactura(false)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </Layout>
  );
};

export default VentasPage;