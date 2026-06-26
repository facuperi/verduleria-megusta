import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, setDoc, query, where, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { ModalPesarProducto } from '../components/ModalPesarProducto';
import { ModalHuevos } from '../components/ModalHuevos';
import { ModalLenaCarbon } from '../components/ModalLenaCarbon';
import { Layout } from '../components/Layout';
import { BuscadorProductos } from '../components/BuscadorProductos';
import { CarritoVentas } from '../components/CarritoVentas';
import { VarianteSelector } from '../components/VarianteSelector';
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
  { id: 'mercadopago', nombre: 'Mercado Pago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
  { id: 'deuda', nombre: 'Deuda' },
];

const calcularIva = (total) => {
  const neto = Math.round(total / 1.105 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
};

const calcularDescuento = (pago) => {
  if (!pago.descuentoTipo || !pago.descuentoValor) return 0;
  const valor = parseFloat(pago.descuentoValor) || 0;
  const base = Math.max(0, parseFloat(pago.monto) || 0);
  if (!base) return 0;
  if (pago.descuentoTipo === 'porcentaje') return base * valor / 100;
  if (pago.descuentoTipo === 'fijo') return valor;
  return 0;
};

const necesitaFacturaAuto = (tiposPago) => {
  const metodosAuto = ['tarjeta', 'debito', 'cuentadni', 'mercadopago'];
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

const ORDEN_PRESENTACIONES = ['x6', 'x12', 'x20', 'x30'];
const presentacionesToArray = (obj) =>
  ORDEN_PRESENTACIONES.filter(k => obj[k]).map(k => ({ nombre: k, ...obj[k] }));

export const VentasPage = () => {
  const { user } = useAuth();
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
  
  // Nota de crédito como descuento
  const [notaCreditoOriginal, setNotaCreditoOriginal] = useState('');
  const [mostrarInputNC, setMostrarInputNC] = useState(false);
  const [nuevoSaldoFavor, setNuevoSaldoFavor] = useState(0);
  
  // Modal facturación
  const [mostrarModalFactura, setMostrarModalFactura] = useState(false);
  const [tipoFacturaSeleccionado, setTipoFacturaSeleccionado] = useState(null);
  const [cuitCliente, setCuitCliente] = useState('');
  
  // Métodos de pago seleccionados
  const [pagosSeleccionados, setPagosSeleccionados] = useState([{ metodo: 'efectivo', monto: 0, descuentoTipo: null, descuentoValor: 0 }]);
  const [scanError, setScanError] = useState(null);
  const [flashGreenId, setFlashGreenId] = useState(null);
  const [varianteModal, setVarianteModal] = useState(null);

  const [montoToFixIndex, setMontoToFixIndex] = useState(null);
  const [lastChangedPagoIndex, setLastChangedPagoIndex] = useState(null);
  const [productoPesando, setProductoPesando] = useState(null);
  const [mostrarModalFV, setMostrarModalFV] = useState(false);
  const [fvTotalInput, setFvTotalInput] = useState('');
  const nextCarritoKey = useRef(0);

  const [huevosStock, setHuevosStock] = useState(0);
  const [huevosPresentaciones, setHuevosPresentaciones] = useState([]);
  const [mostrarModalHuevos, setMostrarModalHuevos] = useState(false);
  const [mostrarModalLenaCarbon, setMostrarModalLenaCarbon] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState('todos');
  const [ordenActivo, setOrdenActivo] = useState('default');

  // Clientes para pagos con deuda
  const [clientes, setClientes] = useState([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [showSelectorCliente, setShowSelectorCliente] = useState(false);
  const [pagoIndexConDeuda, setPagoIndexConDeuda] = useState(null);

  const esPesable = (tipo) => tipo === 'pesable' || tipo === 'pesableConStock';

  const totalVenta = carrito
    .filter(p => !p.esNotaCredito)
    .reduce((sum, p) => {
      const monto = esPesable(p.tipo) ? p.precio * (p.peso || 0) : p.precio * (p.cantidad || 1);
      return sum + monto;
    }, 0);

  const totalNotaCredito = carrito
    .filter(p => p.esNotaCredito)
    .reduce((sum, p) => {
      const monto = esPesable(p.tipo) ? p.precio * (p.peso || 0) : p.precio * (p.cantidad || 1);
      return sum + monto;
    }, 0);

  const diferencia = totalVenta - totalNotaCredito;
  const total = Math.max(0, diferencia);

  const totalDescuentos = pagosSeleccionados.reduce((sum, p) => sum + calcularDescuento(p), 0);
  const montoBaseNC = Math.max(0, diferencia - totalDescuentos);
  const montoNCReal = parseFloat(notaCreditoOriginal) || 0;
  const notaCreditoDescuento = Math.min(montoNCReal, montoBaseNC);
  const totalConDescuento = Math.max(0, montoBaseNC - notaCreditoDescuento);
  const sobranteNC = Math.max(0, montoNCReal - notaCreditoDescuento);

  useEffect(() => {
    if (carrito.length === 0) return;
    setPagosSeleccionados(prev => {
      const target = Math.max(0, diferencia);
      const sumActual = prev.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
      if (Math.abs(sumActual - target) < 0.01) return prev;
      if (target === 0) return prev.map(p => ({ ...p, monto: 0 }));
      if (sumActual === 0) {
        return [{ metodo: 'efectivo', monto: target, descuentoTipo: null, descuentoValor: 0 }];
      }
      return prev.map(p => ({
        ...p,
        monto: Math.round((parseFloat(p.monto) || 0) / sumActual * target * 100) / 100,
      }));
    });
    setMontoToFixIndex(null);
  }, [diferencia, notaCreditoOriginal]);

  const tienePagoTarjeta = pagosSeleccionados.some(p => p.metodo === 'tarjeta');
  
  const restriction = checkDeviceRestriction('venta');
  const canSell = !isMobile || restriction.allowed.includes('mobile');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar productos
        const productosSnapshot = await getDocs(collection(db, 'productos'));
        setProductos(productosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        // Verificar caja abierta
        if (!user) {
          setCaja(null);
          setLoading(false);
          return;
        }
        const cajaQuery = query(collection(db, 'caja'), where('estado', '==', 'abierta'));
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          const cajaData = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
          setCaja(cajaData);
        } else {
          setCaja(null);
        }

        // Cargar huevos
        const huevoRef = doc(db, 'productos', 'huevos');
        const huevoSnap = await getDoc(huevoRef);
        const PRESENTACIONES_DEFECTO = {
          x6: { unidades: 6, precio: 1500 },
          x12: { unidades: 12, precio: 2800 },
          x20: { unidades: 20, precio: 4500 },
          x30: { unidades: 30, precio: 6500 },
        };
        if (huevoSnap.exists()) {
          const data = huevoSnap.data();
          setHuevosStock(data.stock || 0);
          const presentaciones = data.presentaciones || PRESENTACIONES_DEFECTO;
          setHuevosPresentaciones(presentacionesToArray(presentaciones));
          if (!data.presentaciones) {
            await updateDoc(huevoRef, { presentaciones: PRESENTACIONES_DEFECTO });
          }
        } else {
          await setDoc(huevoRef, { nombre: 'Huevos', tipo: 'huevos', stock: 0, presentaciones: PRESENTACIONES_DEFECTO });
          setHuevosStock(0);
          setHuevosPresentaciones(presentacionesToArray(PRESENTACIONES_DEFECTO));
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

        // Cargar clientes para pago con deuda
        const clientesSnapshot = await getDocs(collection(db, 'clientes'));
        setClientes(clientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const buscarProducto = (texto) => {
    const textoLower = texto.toLowerCase().trim();
    return productos.filter(p => 
      p.codigoBarras?.includes(textoLower) ||
      p.nombre?.toLowerCase().includes(textoLower)
    );
  };

  const agregarAlCarrito = (producto, peso) => {
    if (!caja) {
      showToast('⚠️ No hay caja abierta. Abrí la caja primero.', 'warning');
      return;
    }
    if (producto.id === '__frutas_verduras__') {
      setMostrarModalFV(true);
      setFvTotalInput('');
      return;
    }
    if (producto.id === '__huevos__') {
      setMostrarModalHuevos(true);
      return;
    }
    if (producto.id === '__lena_carbon__') {
      setMostrarModalLenaCarbon(true);
      return;
    }
    if (peso !== undefined) {
      if (!agregarComoNotaCredito && producto.tipo === 'pesableConStock' && (producto.stock || 0) <= 0) {
        showToast(`⚠️ ${producto.nombre} no tiene existencias` + (producto.stock < 0 ? ` (stock: ${producto.stock})` : ''), 'warning');
      }
      setCarrito([...carrito, { ...producto, cantidad: 1, peso, _key: ++nextCarritoKey.current, esNotaCredito: agregarComoNotaCredito }]);
      setBusqueda('');
      setVentaExitosa(null);
      return;
    }
    if (esPesable(producto.tipo)) {
      setProductoPesando(producto);
      return;
    }
    if (!agregarComoNotaCredito && caja && (producto.stock || 0) <= 0) {
      showToast(`⚠️ ${producto.nombre} no tiene existencias` + (producto.stock < 0 ? ` (stock: ${producto.stock})` : ''), 'warning');
    }
    const existe = carrito.find(p => p.id === producto.id && p.esNotaCredito === agregarComoNotaCredito);
    if (existe) {
      setCarrito(carrito.map(p => 
        p.id === producto.id && p.esNotaCredito === agregarComoNotaCredito ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1, _key: ++nextCarritoKey.current, esNotaCredito: agregarComoNotaCredito }]);
    }
    setBusqueda('');
    setVentaExitosa(null);
  };

  const quitarDelCarrito = (carritoKey) => {
    setCarrito(carrito.filter(p => p._key !== carritoKey));
    setVentaExitosa(null);
  };

  const actualizarCantidad = (carritoKey, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      quitarDelCarrito(carritoKey);
      return;
    }
    setCarrito(carrito.map(p => 
      p._key === carritoKey ? { ...p, cantidad: nuevaCantidad } : p
    ));
  };

  const cambiarPeso = (carritoKey, nuevoPeso) => {
    if (nuevoPeso < 0.001) nuevoPeso = 0.001;
    setCarrito(carrito.map(p =>
      p._key === carritoKey ? { ...p, peso: parseFloat(nuevoPeso.toFixed(3)) } : p
    ));
  };

  const handleConfirmPeso = (peso) => {
    if (!productoPesando) return
    agregarAlCarrito(productoPesando, peso)
    setProductoPesando(null)
  }

  const handleCancelPeso = () => {
    setProductoPesando(null)
  }

  const handleConfirmFV = () => {
    const total = parseFloat(fvTotalInput) || 0;
    if (total <= 0) return;
    setCarrito([...carrito, { id: `__frutas_verduras__${Date.now()}`, nombre: 'Frutas y Verduras', precio: total, cantidad: 1, tipo: 'frutasVerduras', _key: ++nextCarritoKey.current, esNotaCredito: false, esFrutasVerduras: true }]);
    setMostrarModalFV(false);
    setFvTotalInput('');
    setBusqueda('');
    setVentaExitosa(null);
  }

  const handleConfirmHuevos = (presentacion, cantidad) => {
    const itemId = `__huevos__${presentacion.nombre}_${Date.now()}`;
    setCarrito([...carrito, {
      id: itemId,
      nombre: `Huevos ${presentacion.nombre}`,
      precio: presentacion.precio,
      cantidad,
      tipo: 'huevos',
      esHuevos: true,
      presentacion: presentacion.nombre,
      unidades: presentacion.unidades,
      _key: ++nextCarritoKey.current,
      esNotaCredito: false,
    }]);
    setMostrarModalHuevos(false);
    setBusqueda('');
    setVentaExitosa(null);
  }

  const handleRegistrarRoturaHuevos = async (unidades) => {
    if (!unidades || unidades < 1) return;
    try {
      const huevoRef = doc(db, 'productos', 'huevos');
      const huevoDoc = await getDoc(huevoRef);
      const stockActual = huevoDoc.data().stock || 0;
      const nuevoStock = Math.max(0, stockActual - unidades);
      await updateDoc(huevoRef, { stock: nuevoStock });
      setHuevosStock(nuevoStock);

      setMostrarModalHuevos(false);
      showToast(`✅ Registrada rotura de ${unidades} huevos`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al registrar rotura', 'error');
    }
  }

  const handleActualizarPresentacionHuevos = async (nombre, nuevoPrecio) => {
    try {
      const huevoRef = doc(db, 'productos', 'huevos');
      const huevoSnap = await getDoc(huevoRef);
      const data = huevoSnap.data();
      const presentaciones = { ...(data.presentaciones || {}) };
      presentaciones[nombre] = { ...presentaciones[nombre], precio: nuevoPrecio };
      await updateDoc(huevoRef, { presentaciones });
      setHuevosPresentaciones(presentacionesToArray(presentaciones));
      showToast(`Precio de ${nombre} actualizado`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar precio', 'error');
    }
  }

  const handleActualizarPrecioProducto = async (producto, nuevoPrecio) => {
    try {
      await updateDoc(doc(db, 'productos', producto.id), { precio: nuevoPrecio });
      setProductos(productos.map(p =>
        p.id === producto.id ? { ...p, precio: nuevoPrecio } : p
      ));
      showToast(`Precio de ${producto.nombre} actualizado`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar precio', 'error');
    }
  }

  const handleConfirmLenaCarbon = (producto, cantidad) => {
    const existe = carrito.find(p => p.id === producto.id && p.esNotaCredito === agregarComoNotaCredito);
    if (existe) {
      setCarrito(carrito.map(p =>
        p.id === producto.id && p.esNotaCredito === agregarComoNotaCredito ? { ...p, cantidad: p.cantidad + cantidad } : p
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad, _key: ++nextCarritoKey.current, esNotaCredito: agregarComoNotaCredito }]);
    }
    setMostrarModalLenaCarbon(false);
    setBusqueda('');
    setVentaExitosa(null);
  }

  const cambiarPrecioFV = (carritoKey, nuevoPrecio) => {
    const total = Math.max(0, parseFloat(nuevoPrecio) || 0);
    if (total === 0) {
      setCarrito(carrito.filter(p => p._key !== carritoKey));
    } else {
      setCarrito(carrito.map(p =>
        p._key === carritoKey ? { ...p, precio: total } : p
      ));
    }
  }

  const toggleNotaCredito = (carritoKey) => {
    setCarrito(carrito.map(p => 
      p._key === carritoKey ? { ...p, esNotaCredito: !p.esNotaCredito } : p
    ));
  };

  const autoAjustarMontos = (pagos, changedIndex) => {
    const idx = changedIndex !== undefined ? changedIndex : 0;
    const sumaOtros = pagos.reduce((sum, p, i) => i !== idx ? sum + (parseFloat(p.monto) || 0) : sum, 0);
    const nuevoMonto = Math.round(Math.max(0, diferencia - sumaOtros) * 100) / 100;
    const actual = Math.round((parseFloat(pagos[idx]?.monto) || 0) * 100) / 100;
    if (Math.abs(nuevoMonto - actual) >= 0.01) {
      pagos[idx] = { ...pagos[idx], monto: nuevoMonto };
      return true;
    }
    return false;
  };

  const handlePagoChange = (index, campo, valor) => {
    const nuevosPagos = [...pagosSeleccionados];
    if (campo === 'metodo') {
      const yaExiste = nuevosPagos.some((p, i) => i !== index && p.metodo === valor);
      if (yaExiste) return;
      nuevosPagos[index] = {
        ...nuevosPagos[index],
        metodo: valor,
        clienteId: undefined,
        clienteNombre: undefined,
      };
      if (valor === 'deuda') {
        setPagosSeleccionados(nuevosPagos);
        setPagoIndexConDeuda(index);
        setShowSelectorCliente(true);
        setBusquedaCliente('');
        return;
      }
    } else if (campo === 'monto') {
      const val = parseFloat(valor) || 0;
      nuevosPagos[index] = { ...nuevosPagos[index], monto: val };
      const sumaTotal = nuevosPagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
      if (Math.abs(sumaTotal - diferencia) > 0.01 && nuevosPagos.length > 1) {
        setLastChangedPagoIndex(index);
        const fixIdx = index === 0 ? nuevosPagos.length - 1 : 0;
        setMontoToFixIndex(fixIdx);
      } else {
        setMontoToFixIndex(null);
      }
      setPagosSeleccionados(nuevosPagos);
      return;
    } else {
      nuevosPagos[index] = { ...nuevosPagos[index], [campo]: valor };
    }
    if (campo === 'descuentoValor') {
      autoAjustarMontos(nuevosPagos, index);
    }
    setPagosSeleccionados(nuevosPagos);
  };

  const handleDescuentoTipo = (index, tipo) => {
    const nuevosPagos = [...pagosSeleccionados];
    if (tipo === '10pct') {
      const yaActivo = nuevosPagos[index].descuentoTipo === 'porcentaje' && nuevosPagos[index].descuentoValor == 10;
      nuevosPagos[index] = {
        ...nuevosPagos[index],
        descuentoTipo: yaActivo ? null : 'porcentaje',
        descuentoValor: yaActivo ? 0 : 10,
      };
    } else {
      const actual = nuevosPagos[index].descuentoTipo;
      nuevosPagos[index] = {
        ...nuevosPagos[index],
        descuentoTipo: actual === tipo ? null : tipo,
        descuentoValor: actual === tipo ? 0 : nuevosPagos[index].descuentoValor,
      };
    }
    autoAjustarMontos(nuevosPagos, index);
    setPagosSeleccionados(nuevosPagos);
  };

  const handleMontoBlur = () => {
    // No auto-ajustar para no pisar el ingreso manual del usuario
  };

  const handleFixMontoClick = (index) => {
    if (montoToFixIndex !== index) return;
    const nuevosPagos = [...pagosSeleccionados];
    const otrosSum = nuevosPagos.reduce((s, p, i) => i !== index ? s + (parseFloat(p.monto) || 0) : s, 0);
    nuevosPagos[index] = { ...nuevosPagos[index], monto: Math.round(Math.max(0, diferencia - otrosSum) * 100) / 100 };
    setPagosSeleccionados(nuevosPagos);
    setMontoToFixIndex(null);
  };

  const agregarMetodoPago = () => {
    const metodosExistentes = pagosSeleccionados.map(p => p.metodo);
    const primerDisponible = METODOS_PAGO.find(m => !metodosExistentes.includes(m.id));
    if (!primerDisponible) return;
    const nuevosPagos = [...pagosSeleccionados, { metodo: primerDisponible.id, monto: 0, descuentoTipo: null, descuentoValor: 0 }];
    autoAjustarMontos(nuevosPagos, nuevosPagos.length - 1);
    setPagosSeleccionados(nuevosPagos);
  };

  const quitarMetodoPago = (index) => {
    if (pagosSeleccionados.length > 1) {
      const nuevosPagos = pagosSeleccionados.filter((_, i) => i !== index);
      autoAjustarMontos(nuevosPagos);
      setPagosSeleccionados(nuevosPagos);
    }
  };

  const seleccionarClienteParaDeuda = (index) => {
    setPagoIndexConDeuda(index);
    setShowSelectorCliente(true);
    setBusquedaCliente('');
  };

  const handleSeleccionarCliente = (cliente) => {
    const nuevosPagos = [...pagosSeleccionados];
    if (pagoIndexConDeuda !== null && nuevosPagos[pagoIndexConDeuda]) {
      nuevosPagos[pagoIndexConDeuda] = {
        ...nuevosPagos[pagoIndexConDeuda],
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
      };
      setPagosSeleccionados(nuevosPagos);
    }
    setShowSelectorCliente(false);
    setPagoIndexConDeuda(null);
  };

  const totalPagos = pagosSeleccionados.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);

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
    
    // Validar total de pagos (excluyendo deuda)
    const montoDeuda = pagosSeleccionados
      .filter(p => p.metodo === 'deuda')
      .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
    const montoCobrado = total - montoDeuda;
    const totalPagosSinDeuda = pagosSeleccionados
      .filter(p => p.metodo !== 'deuda')
      .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
    if (Math.abs(totalPagosSinDeuda - montoCobrado) > 0.01) {
      setError(`Los pagos suman $${totalPagosSinDeuda} pero el total de venta es $${montoCobrado}`);
      return;
    }

    // Validar que los pagos con deuda tengan cliente seleccionado
    for (const pago of pagosSeleccionados) {
      if (pago.metodo === 'deuda' && !pago.clienteId) {
        setError('Seleccioná un cliente para el pago con Deuda');
        setVendiendo(false);
        return;
      }
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

      const carritoSobranteNC = diferencia < 0 ? Math.abs(diferencia) : 0;
      const saldoFavorTotal = sobranteNC + carritoSobranteNC;

      const productosVenta = carrito.map(item => ({
        productoId: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad || 1,
        precio: item.precio,
        ...(item.peso !== undefined && { peso: item.peso }),
        esNotaCredito: item.esNotaCredito || false,
        ...(item.esFrutasVerduras && { esFrutasVerduras: true }),
        ...(item.esHuevos && { esHuevos: true, presentacion: item.presentacion, unidades: item.unidades }),
      }));

      const ventaDoc = await addDoc(collection(db, 'ventas'), {
        productos: productosVenta,
        total: montoCobrado,
        totalVenta,
        totalNotaCredito,
        diferencia: montoCobrado,
        tipoVenta,
        observacion: observacion || null,
        tipoPago: pagosSeleccionados.map(p => p.metodo),
        pagos: pagosSeleccionados.map(p => {
          const desc = calcularDescuento(p);
          return {
            metodo: p.metodo,
            monto: parseFloat(p.monto) || 0,
            descuentoTipo: desc > 0 ? p.descuentoTipo : null,
            descuentoValor: desc > 0 ? (parseFloat(p.descuentoValor) || 0) : 0,
            montoReal: Math.max(0, (parseFloat(p.monto) || 0) - desc),
          };
        }),
        ...(notaCreditoDescuento > 0 && { notaCreditoDescuento }),
        ...(montoNCReal > 0 && { notaCreditoOriginal: montoNCReal }),
        ...(saldoFavorTotal > 0 && { nuevoSaldoFavor: saldoFavorTotal }),
        facturada: false,
        usuarioId: user.uid,
        usuarioNombre: user.email || 'Usuario',
        fecha: serverTimestamp(),
        hora: ahora.toISOString(),
        tipoDescuento: totalDescuentos > 0 && tipoDescuento ? tipoDescuento : null,
        ...(() => {
          const pagoDeuda = pagosSeleccionados.find(p => p.metodo === 'deuda' && p.clienteId);
          return pagoDeuda ? { clienteId: pagoDeuda.clienteId, clienteNombre: pagoDeuda.clienteNombre, montoDeuda: parseFloat(pagoDeuda.monto) || 0 } : {};
        })(),
      });

      // Actualizar stock
      let huevosUnidades = 0;
      for (const item of carrito) {
        if (item.esFrutasVerduras) continue;
        if (item.esHuevos) {
          const factor = item.esNotaCredito ? 1 : -1;
          huevosUnidades += factor * item.unidades * item.cantidad;
          continue;
        }
        if (item.tipo === 'pesable') continue;
        const productoRef = doc(db, 'productos', item.id);
        const productoDoc = await getDoc(productoRef);
        const productoData = productoDoc.data();
        
        const stockActual = productoData.stock || 0;
        const esKg = item.tipo === 'pesableConStock';
        const cambio = item.esNotaCredito ? (esKg ? item.peso : item.cantidad) : -(esKg ? item.peso : item.cantidad);
        const nuevoStock = Math.max(-999999, stockActual + cambio);
        
        await updateDoc(productoRef, {
          stock: isNaN(nuevoStock) ? 0 : parseFloat(nuevoStock.toFixed(3)),
        });
      }
      if (huevosUnidades !== 0) {
        const huevoRef = doc(db, 'productos', 'huevos');
        const huevoDoc = await getDoc(huevoRef);
        const huevoStock = huevoDoc.data().stock || 0;
        await updateDoc(huevoRef, {
          stock: Math.max(0, huevoStock + huevosUnidades),
        });
        setHuevosStock(Math.max(0, huevoStock + huevosUnidades));
      }

      // Actualizar caja - ventas por método
      const updateData = {};
      let totalDescuentosCaja = 0;
      for (const pago of pagosSeleccionados) {
        const monto = parseFloat(pago.monto) || 0;
        totalDescuentosCaja += calcularDescuento(pago);
        if (monto > 0) {
          const campoKey = {
            'efectivo': 'ventasEfectivo',
            'tarjeta': 'ventasTarjeta',
            'debito': 'ventasDebito',
            'mercadopago': 'ventasMercadoPago',
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

      if (notaCreditoDescuento > 0) {
        updateData.notaCreditoDescuento = (caja.notaCreditoDescuento || 0) + notaCreditoDescuento;
      }

      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, 'caja', caja.id), updateData);
      }

      // Actualizar deuda del cliente
      const pagoDeuda = pagosSeleccionados.find(p => p.metodo === 'deuda' && p.clienteId);
      if (pagoDeuda) {
        const montoDeuda = parseFloat(pagoDeuda.monto) || 0;
        if (montoDeuda > 0) {
          const clienteRef = doc(db, 'clientes', pagoDeuda.clienteId);
          const clienteDoc = await getDoc(clienteRef);
          if (clienteDoc.exists()) {
            const deudaActual = clienteDoc.data().deuda || 0;
            await updateDoc(clienteRef, { deuda: deudaActual + montoDeuda });
          }
        }
      }

      // Recargar datos
      const productosActualizados = await getDocs(collection(db, 'productos'));
      setProductos(productosActualizados.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      setCarrito([]);
      setPagosSeleccionados([{ metodo: 'efectivo', monto: 0, descuentoTipo: null, descuentoValor: 0 }]);
      setMontoToFixIndex(null);
      setObservacion('');
      setFacturaData(null);
      setAgregarComoNotaCredito(false);
      setTipoDescuento('');
      setNuevoSaldoFavor(sobranteNC);
      setNotaCreditoOriginal('');
      setMostrarInputNC(false);
      
      const pagosConDescuento = pagosSeleccionados.map(p => {
        const desc = calcularDescuento(p);
        return {
          metodo: p.metodo,
          monto: parseFloat(p.monto) || 0,
          descuentoTipo: desc > 0 ? p.descuentoTipo : null,
          descuentoValor: desc > 0 ? (parseFloat(p.descuentoValor) || 0) : 0,
          montoReal: Math.max(0, (parseFloat(p.monto) || 0) - desc),
        };
      });
      const nuevaVenta = {
        id: ventaDoc.id,
        total: montoCobrado,
        subtotal: montoCobrado,
        productos: productosVenta,
        tipoPago: pagosSeleccionados.map(p => p.metodo),
        pagos: pagosConDescuento,
        tipoVenta,
        montoDeuda: montoDeuda > 0 ? montoDeuda : undefined,
        notaCreditoDescuento: notaCreditoDescuento > 0 ? notaCreditoDescuento : undefined,
        nuevoSaldoFavor: saldoFavorTotal > 0 ? saldoFavorTotal : undefined,
        ...(() => {
          const pagoDeuda = pagosSeleccionados.find(p => p.metodo === 'deuda' && p.clienteId);
          return pagoDeuda ? { clienteId: pagoDeuda.clienteId, clienteNombre: pagoDeuda.clienteNombre } : {};
        })(),
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
      console.error('Error al realizar venta:', err, 'message:', err.message);
      if (err.code === 'permission-denied') {
        setError('⚠️ La caja fue cerrada en otro dispositivo. Recargá la página.');
      } else if (err.message?.includes('undefined') || err.message?.includes('NaN')) {
        setError('⚠️ Error interno: dato inválido en la venta. Reintentá o contactá al administrador.');
      } else {
        setError('⚠️ Error al realizar la venta. Revisá la conexión e intentá de nuevo.');
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

  useBarcodeScanner((codigo) => {
    const resultados = productos.filter(p => p.codigoBarras === codigo);
    if (resultados.length === 1) {
      setFlashGreenId(resultados[0].id);
      setTimeout(() => setFlashGreenId(null), 600);
      agregarAlCarrito(resultados[0]);
      setBusqueda('');
    } else if (resultados.length > 1) {
      setVarianteModal(resultados);
    } else {
      setBusqueda(codigo);
      setScanError(codigo);
      setTimeout(() => setScanError(null), 4000);
    }
  });

  const handleVariantSelect = (producto) => {
    setVarianteModal(null);
    setFlashGreenId(producto.id);
    setTimeout(() => setFlashGreenId(null), 600);
    agregarAlCarrito(producto);
    setBusqueda('');
  };

  const productosVisibles = (() => {
    let lista = [...productos];
    if (filtroActivo !== 'todos') {
      lista = lista.filter(p => p.filtro === filtroActivo);
    }
    if (busqueda) {
      const texto = busqueda.toLowerCase().trim();
      lista = lista.filter(p =>
        p.codigoBarras?.toLowerCase().includes(texto) ||
        p.nombre?.toLowerCase().includes(texto)
      );
    }
    if (ordenActivo === 'az') {
      lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } else if (ordenActivo === 'za') {
      lista.sort((a, b) => (b.nombre || '').localeCompare(a.nombre || ''));
    }
    return lista;
  })();

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

      <h2 className="text-2xl font-bold mb-4">Ventas</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <BuscadorProductos
            busqueda={busqueda}
            productos={productosVisibles}
            productosTodos={productos}
            agregarComoNotaCredito={agregarComoNotaCredito}
            onBusquedaChange={setBusqueda}
            onToggleNotaCredito={() => setAgregarComoNotaCredito(!agregarComoNotaCredito)}
            onProductClick={(p) => agregarAlCarrito(p)}
            scanError={scanError}
            flashGreenId={flashGreenId}
            filtroActivo={filtroActivo}
            ordenActivo={ordenActivo}
            onChangeFiltro={setFiltroActivo}
            onChangeOrden={setOrdenActivo}
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
            tiposDescuento={tiposDescuento}
            tipoDescuento={tipoDescuento}
            onChangeTipoDescuento={setTipoDescuento}
            onAbrirModalTipoDesc={() => setMostrarModalNuevoTipoDesc(true)}
            onCambiarCantidad={actualizarCantidad}
            onCambiarPeso={cambiarPeso}
            onCambiarPrecioFV={cambiarPrecioFV}
            onQuitarDelCarrito={quitarDelCarrito}
            onToggleNotaCredito={toggleNotaCredito}
            onPagoChange={handlePagoChange}
            onDescuentoTipo={handleDescuentoTipo}
            onMontoBlur={handleMontoBlur}
            onAgregarMetodoPago={agregarMetodoPago}
            montoToFixIndex={montoToFixIndex}
            onFixMontoClick={handleFixMontoClick}
            onQuitarMetodoPago={quitarMetodoPago}
            onObservacionChange={setObservacion}
            onImprimirAFavor={() => imprimirTicketAFavor(diferencia, caja, user?.email)}
            onRealizarVenta={realizarVenta}
            onSeleccionarCliente={seleccionarClienteParaDeuda}
            notaCreditoOriginal={notaCreditoOriginal}
            mostrarInputNC={mostrarInputNC}
            notaCreditoDescuento={notaCreditoDescuento}
            sobranteNC={sobranteNC}
            onNotaCreditoChange={setNotaCreditoOriginal}
            onToggleInputNC={() => {
              if (mostrarInputNC) setNotaCreditoOriginal('');
              setMostrarInputNC(!mostrarInputNC);
            }}
          />

          {/* Selector de cliente para pago con deuda */}
          <Modal open={showSelectorCliente} onClose={() => { setShowSelectorCliente(false); setPagoIndexConDeuda(null); }} title="Seleccionar Cliente" className="max-w-sm">
            <input
              type="text"
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full border border-line-input bg-input text-body rounded px-3 py-2 mb-3"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto">
              {clientes
                .filter(c => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))
                .map(cliente => (
                  <button
                    key={cliente.id}
                    onClick={() => handleSeleccionarCliente(cliente)}
                    className="w-full text-left px-3 py-2 hover:bg-elevated rounded transition-colors border-b border-line last:border-b-0"
                  >
                    <span className="font-medium">{cliente.nombre}</span>
                  </button>
                ))}
              {clientes.length === 0 && (
                <p className="text-muted text-sm text-center py-4">No hay clientes registrados</p>
              )}
            </div>
          </Modal>

          <ModalPesarProducto
            producto={productoPesando}
            open={!!productoPesando}
            onConfirm={handleConfirmPeso}
            onCancel={handleCancelPeso}
          />

          <Modal open={mostrarModalFV} onClose={() => setMostrarModalFV(false)} title="🍎 Frutas y Verduras" className="max-w-sm">
            <p className="text-sm text-muted mb-3">Ingresá el total del ticket de la balanza</p>
            <input
              type="number"
              min="0"
              step="0.01"
              value={fvTotalInput}
              onChange={(e) => setFvTotalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && parseFloat(fvTotalInput) > 0) handleConfirmFV(); }}
              placeholder="0.00"
              className="w-full border-2 border-line-input bg-input text-body p-3 rounded text-center text-2xl font-bold mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarModalFV(false)}
                className="flex-1 px-4 py-2 rounded border border-line text-secondary hover:text-body"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmFV}
                disabled={!fvTotalInput || parseFloat(fvTotalInput) <= 0}
                className="flex-1 px-4 py-2 rounded bg-amber text-white font-semibold hover:bg-amber/80 disabled:opacity-50"
              >
                Agregar al carrito
              </button>
            </div>
          </Modal>

          <ModalHuevos
            open={mostrarModalHuevos}
            onClose={() => setMostrarModalHuevos(false)}
            onConfirm={handleConfirmHuevos}
            onRegistrarRotura={handleRegistrarRoturaHuevos}
            onActualizarPresentacion={handleActualizarPresentacionHuevos}
            presentaciones={huevosPresentaciones}
            stock={huevosStock}
          />

          <ModalLenaCarbon
            open={mostrarModalLenaCarbon}
            onClose={() => setMostrarModalLenaCarbon(false)}
            onConfirm={handleConfirmLenaCarbon}
            onActualizarPrecio={handleActualizarPrecioProducto}
            productos={productos.filter(p => p.filtro === 'Leña' || p.filtro === 'Carbón')}
          />

          {ventaExitosa && (
            <div className="bg-green-soft border border-green text-green p-4 rounded-lg shadow-sm mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold">✅ Venta exitosa</p>
                  <p className="text-sm">Total: ${ventaExitosa.total}</p>
                  {ventaExitosa.notaCreditoDescuento > 0 && (
                    <p className="text-sm text-purple mt-1">NC aplicada: -${ventaExitosa.notaCreditoDescuento}</p>
                  )}
                  {ventaExitosa.nuevoSaldoFavor > 0 && (
                    <p className="text-sm text-green font-semibold mt-1">Saldo a favor: $${ventaExitosa.nuevoSaldoFavor}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <button
                    onClick={() => imprimirTicketVenta(ventaExitosa, caja, facturaData)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    🖨️ Imprimir Ticket
                  </button>
                  {ventaExitosa.nuevoSaldoFavor > 0 && (
                    <button
                      onClick={() => imprimirTicketAFavor && imprimirTicketAFavor(-ventaExitosa.nuevoSaldoFavor, caja, user?.email)}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
                    >
                      🖨️ NC sobrante (${ventaExitosa.nuevoSaldoFavor})
                    </button>
                  )}
                </div>
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

      <VarianteSelector
        open={varianteModal !== null}
        productos={varianteModal || []}
        onSeleccionar={handleVariantSelect}
        onCancel={() => setVarianteModal(null)}
      />
    </Layout>
  );
};

export default VentasPage;