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

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopagoarista', nombre: 'MP Arista' },
  { id: 'mercadopagoyanet', nombre: 'MP Yanet' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

const calcularIva = (total) => {
  const neto = Math.round(total / 1.21 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
};

const calcularDescuento = (pago, totalBase = 0) => {
  if (!pago.descuentoTipo || !pago.descuentoValor) return 0;
  const valor = parseFloat(pago.descuentoValor) || 0;
  if (pago.descuentoTipo === 'porcentaje') return totalBase * valor / 100;
  if (pago.descuentoTipo === 'fijo') return valor;
  return 0;
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
  
  // Tipos de descuento
  const [tiposDescuento, setTiposDescuento] = useState([]);
  const [tipoDescuento, setTipoDescuento] = useState('');
  const [mostrarModalNuevoTipoDesc, setMostrarModalNuevoTipoDesc] = useState(false);
  const [nombreNuevoTipoDesc, setNombreNuevoTipoDesc] = useState('');
  const [iconoNuevoTipoDesc, setIconoNuevoTipoDesc] = useState('🏷️');
  const [creandoTipoDescuento, setCreandoTipoDescuento] = useState(false);
  
  // Modal facturación
  const [mostrarModalFactura, setMostrarModalFactura] = useState(false);
  const [tipoFacturaSeleccionado, setTipoFacturaSeleccionado] = useState(null);
  const [cuitCliente, setCuitCliente] = useState('');
  
  // Métodos de pago seleccionados
  const [pagosSeleccionados, setPagosSeleccionados] = useState([{ metodo: 'efectivo', monto: 0, descuentoTipo: null, descuentoValor: 0 }]);
  
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

  const totalDescuentos = pagosSeleccionados.reduce((sum, p) => sum + calcularDescuento(p, diferencia), 0);
  const totalConDescuento = Math.max(0, diferencia - totalDescuentos);

  useEffect(() => {
    if (carrito.length === 0) return;
    setPagosSeleccionados(prev => {
      if (prev.length === 0) {
        return [{ metodo: 'efectivo', monto: Math.max(0, diferencia), descuentoTipo: null, descuentoValor: 0 }];
      }
      const target = Math.max(0, diferencia);
      const sumActual = prev.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
      if (Math.abs(sumActual - target) < 0.01) return prev;
      const diff = Math.round((target - sumActual) * 100) / 100;
      const updated = [...prev];
      const nuevo = Math.max(0, Math.round(((parseFloat(prev[0].monto) || 0) + diff) * 100) / 100);
      updated[0] = { ...updated[0], monto: nuevo };
      return updated;
    });
  }, [carrito.length, diferencia]);

  const tienePagoTarjeta = pagosSeleccionados.some(p => p.metodo === 'tarjeta');

  useEffect(() => {
    setCarrito(prev => {
      if (prev.length === 0) return prev;
      const todosBien = prev.every(p =>
        tienePagoTarjeta ? p.precioSeleccionado === 'tarjeta' : p.precioSeleccionado === 'efectivo'
      );
      if (todosBien) return prev;
      return prev.map(p => ({ ...p, precioSeleccionado: tienePagoTarjeta ? 'tarjeta' : 'efectivo' }));
    });
  }, [tienePagoTarjeta]);
  
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

        // Cargar tipos de descuento
        const tiposDescSnapshot = await getDocs(collection(db, 'tiposDescuento'));
        const tiposDescData = tiposDescSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (tiposDescData.length === 0) {
          const seed = [
            { nombre: 'empleados', icono: '👥' },
            { nombre: 'efectivo', icono: '💵' },
          ];
          const ids = await Promise.all(seed.map(s => addDoc(collection(db, 'tiposDescuento'), s)));
          setTiposDescuento(seed.map((s, i) => ({ id: ids[i].id, ...s })));
        } else {
          setTiposDescuento(tiposDescData);
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
    if (!agregarComoNotaCredito && caja && (producto.stockPorNegocio?.[caja.sucursal] || 0) <= 0) {
      showToast(`❌ ${producto.nombre} no tiene existencias en ${caja.sucursal === 'chiclana' ? 'Chiclana' : 'Belgrano'}`, 'warning');
      return;
    }
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

  const autoAjustarMontos = (pagos) => {
    const sumMontos = pagos.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
    const descs = pagos.reduce((sum, p) => sum + calcularDescuento(p, diferencia), 0);
    const nuevoTotalConDesc = Math.max(0, diferencia - descs);
    const restante = Math.round((nuevoTotalConDesc - sumMontos) * 100) / 100;

    if (Math.abs(restante) < 0.01) return false;

    const actual = parseFloat(pagos[0]?.monto) || 0;
    const nuevo = Math.max(0, actual + restante);
    if (nuevo !== actual) {
      pagos[0] = { ...pagos[0], monto: Math.round(nuevo * 100) / 100 };
      return true;
    }
    return false;
  };

  const handlePagoChange = (index, campo, valor) => {
    const nuevosPagos = [...pagosSeleccionados];
    if (campo === 'metodo') {
      const yaExiste = nuevosPagos.some((p, i) => i !== index && p.metodo === valor);
      if (yaExiste) return;
    }
    nuevosPagos[index] = { ...nuevosPagos[index], [campo]: valor };
    if (campo === 'descuentoValor') {
      autoAjustarMontos(nuevosPagos);
    }
    setPagosSeleccionados(nuevosPagos);
  };

  const handleDescuentoTipo = (index, tipo) => {
    const nuevosPagos = [...pagosSeleccionados];
    const actual = nuevosPagos[index].descuentoTipo;
    nuevosPagos[index] = {
      ...nuevosPagos[index],
      descuentoTipo: actual === tipo ? null : tipo,
      descuentoValor: actual === tipo ? 0 : nuevosPagos[index].descuentoValor,
    };
    autoAjustarMontos(nuevosPagos);
    setPagosSeleccionados(nuevosPagos);
  };

  const handleMontoBlur = (index) => {
    const nuevosPagos = [...pagosSeleccionados];
    autoAjustarMontos(nuevosPagos);
    setPagosSeleccionados(nuevosPagos);
  };

  const agregarMetodoPago = () => {
    const metodosExistentes = pagosSeleccionados.map(p => p.metodo);
    const primerDisponible = METODOS_PAGO.find(m => !metodosExistentes.includes(m.id));
    if (!primerDisponible) return;
    const nuevosPagos = [...pagosSeleccionados, { metodo: primerDisponible.id, monto: 0, descuentoTipo: null, descuentoValor: 0 }];
    autoAjustarMontos(nuevosPagos);
    setPagosSeleccionados(nuevosPagos);
  };

  const quitarMetodoPago = (index) => {
    if (pagosSeleccionados.length > 1) {
      const nuevosPagos = pagosSeleccionados.filter((_, i) => i !== index);
      autoAjustarMontos(nuevosPagos);
      setPagosSeleccionados(nuevosPagos);
    }
  };

  const totalPagos = pagosSeleccionados.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);

  const handleTogglePrecioGlobal = () => {
    setCarrito(prev => prev.map(p => ({
      ...p,
      precioSeleccionado: p.precioSeleccionado === 'tarjeta' ? 'efectivo' : 'tarjeta'
    })));
  };

  const tipoPrecioGlobal = carrito.some(p => p.precioSeleccionado === 'tarjeta') ? 'tarjeta' : 'efectivo';

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
    
    if (diferencia > 0 && totalPagos !== totalConDescuento) {
      setError(`El total de los pagos debe ser igual a $${totalConDescuento}`);
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
        total: totalConDescuento,
        totalVenta,
        totalNotaCredito,
        diferencia,
        tipoVenta,
        observacion: observacion || null,
        tipoPago: pagosSeleccionados.map(p => p.metodo),
        pagos: pagosSeleccionados.map(p => {
          const desc = calcularDescuento(p, diferencia);
          return {
            metodo: p.metodo,
            monto: parseFloat(p.monto) || 0,
            descuentoTipo: desc > 0 ? p.descuentoTipo : null,
            descuentoValor: desc > 0 ? (parseFloat(p.descuentoValor) || 0) : 0,
            montoReal: Math.max(0, (parseFloat(p.monto) || 0) - desc),
          };
        }),
        facturada: false,
        usuarioId: user.uid,
        usuarioNombre: user.email || 'Usuario',
        fecha: serverTimestamp(),
        hora: ahora.toISOString(),
        tipoDescuento: totalDescuentos > 0 && tipoDescuento ? tipoDescuento : null,
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
      let totalDescuentosCaja = 0;
      for (const pago of pagosSeleccionados) {
        const monto = parseFloat(pago.monto) || 0;
        totalDescuentosCaja += calcularDescuento(pago, diferencia);
        if (monto > 0) {
          const campoKey = {
            'efectivo': 'ventasEfectivo',
            'tarjeta': 'ventasTarjeta',
            'debito': 'ventasDebito',
            'mercadopagoarista': 'ventasMPArista',
            'mercadopagoyanet': 'ventasMPYanet',
            'cuentadni': 'ventasCuentaDNI',
          }[pago.metodo];
          
          updateData[campoKey] = (caja[campoKey] || 0) + monto;
          
          if (pago.metodo === 'efectivo') {
            updateData.montoEfectivo = (caja.montoEfectivo || 0) + monto;
          }
        }
      }
      if (totalDescuentosCaja > 0) {
        updateData.totalDescuentos = (caja.totalDescuentos || 0) + totalDescuentosCaja;
      }

      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, 'caja', caja.id), updateData);
      }

      // Recargar datos
      const productosActualizados = await getDocs(collection(db, 'productos'));
      setProductos(productosActualizados.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      setCarrito([]);
      setPagosSeleccionados([{ metodo: 'efectivo', monto: 0, descuentoTipo: null, descuentoValor: 0 }]);
      setObservacion('');
      setFacturaData(null);
      setAgregarComoNotaCredito(false);
      setTipoDescuento('');
      
      const pagosConDescuento = pagosSeleccionados.map(p => {
        const desc = calcularDescuento(p, diferencia);
        return {
          metodo: p.metodo,
          monto: parseFloat(p.monto) || 0,
          descuentoTipo: desc > 0 ? p.descuentoTipo : null,
          descuentoValor: desc > 0 ? (parseFloat(p.descuentoValor) || 0) : 0,
          montoReal: parseFloat(p.monto) || 0,
        };
      });
      const nuevaVenta = {
        id: ventaDoc.id,
        total: totalConDescuento,
        productos: productosVenta,
        tipoPago: pagosSeleccionados.map(p => p.metodo),
        pagos: pagosConDescuento,
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

  const crearTipoDescuento = async () => {
    if (!nombreNuevoTipoDesc.trim()) {
      showToast('Ingresá un nombre para el tipo de descuento', 'warning');
      return;
    }
    setCreandoTipoDescuento(true);
    try {
      const docRef = await addDoc(collection(db, 'tiposDescuento'), {
        nombre: nombreNuevoTipoDesc.trim(),
        icono: iconoNuevoTipoDesc,
      });
      setTiposDescuento([...tiposDescuento, { id: docRef.id, nombre: nombreNuevoTipoDesc.trim(), icono: iconoNuevoTipoDesc }]);
      setMostrarModalNuevoTipoDesc(false);
      setNombreNuevoTipoDesc('');
      setIconoNuevoTipoDesc('🏷️');
      showToast('Tipo de descuento creado con éxito', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al crear tipo de descuento', 'error');
    } finally {
      setCreandoTipoDescuento(false);
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
        <div className="bg-yellow-soft border border-yellow-line text-yellow px-4 py-3 rounded">
          {restriction.message}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {!caja && (
        <div className="bg-red-soft border border-red text-red px-4 py-3 rounded mb-4">
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
            totalDescuentos={totalDescuentos}
            totalConDescuento={totalConDescuento}
            error={error}
            tipoPrecioGlobal={tipoPrecioGlobal}
            tiposDescuento={tiposDescuento}
            tipoDescuento={tipoDescuento}
            onChangeTipoDescuento={setTipoDescuento}
            onAbrirModalTipoDesc={() => setMostrarModalNuevoTipoDesc(true)}
            onCambiarCantidad={actualizarCantidad}
            onQuitarDelCarrito={quitarDelCarrito}
            onTogglePrecioGlobal={handleTogglePrecioGlobal}
            onToggleNotaCredito={toggleNotaCredito}
            onPagoChange={handlePagoChange}
            onDescuentoTipo={handleDescuentoTipo}
            onMontoBlur={handleMontoBlur}
            onAgregarMetodoPago={agregarMetodoPago}
            onQuitarMetodoPago={quitarMetodoPago}
            onObservacionChange={setObservacion}
            onImprimirAFavor={() => imprimirTicketAFavor(diferencia, caja, user?.email)}
            onRealizarVenta={realizarVenta}
          />

          {ventaExitosa && (
            <div className="bg-green-soft border border-green text-green p-4 rounded-lg shadow-sm mb-4">
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
                    className="flex-1 bg-blue-soft text-blue py-1 px-2 rounded text-xs hover:bg-blue-soft"
                  >
                    📄 Factura A
                  </button>
                  <button
                    onClick={handleFacturarManual}
                    className="flex-1 bg-elevated text-body py-1 px-2 rounded text-xs hover:bg-surface"
                  >
                    📄 Cons. Final
                  </button>
                </div>
              )}
              {facturando && (
                <p className="mt-2 text-sm text-blue">⏳ Generando factura...</p>
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
              className="w-full border border-line-input bg-input text-body p-2 rounded"
            />
            <p className="text-xs text-muted mt-1">Ingresá los 11 dígitos del CUIT</p>
          </div>
        )}
        
        {tipoFacturaSeleccionado === 'B' && (
          <p className="mb-4 text-secondary">Se generará una Factura B para consumidor final.</p>
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
            className="px-4 py-2 border border-line-input rounded hover:bg-elevated"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={mostrarModalNuevoTipoDesc} onClose={() => { setMostrarModalNuevoTipoDesc(false); setNombreNuevoTipoDesc(''); setIconoNuevoTipoDesc('🏷️'); }} title="Nuevo Tipo de Descuento">
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Nombre</label>
          <input
            type="text"
            value={nombreNuevoTipoDesc}
            onChange={(e) => setNombreNuevoTipoDesc(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
            placeholder="Ej: Empleados"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1">Icono</label>
          <select
            value={iconoNuevoTipoDesc}
            onChange={(e) => setIconoNuevoTipoDesc(e.target.value)}
            className="w-full border border-line-input bg-input text-body p-2 rounded"
          >
            <option value="🏷️">🏷️ Descuento</option>
            <option value="👥">👥 Empleados</option>
            <option value="💵">💵 Efectivo</option>
            <option value="🎉">🎉 Promoción</option>
            <option value="⭐">⭐ Fidelidad</option>
            <option value="📦">📦 Volumen</option>
            <option value="🎂">🎂 Cumpleaños</option>
            <option value="🤝">🤝 Convenio</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={crearTipoDescuento}
            disabled={creandoTipoDescuento || !nombreNuevoTipoDesc.trim()}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {creandoTipoDescuento ? 'Creando...' : 'Crear Tipo'}
          </button>
          <button
            onClick={() => {
              setMostrarModalNuevoTipoDesc(false);
              setNombreNuevoTipoDesc('');
              setIconoNuevoTipoDesc('🏷️');
            }}
            className="px-4 py-2 border border-line-input rounded hover:bg-elevated"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </Layout>
  );
};

export default VentasPage;