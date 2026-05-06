import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

const NEGOCIOS = [
  { id: 'chiclana', nombre: 'Chiclana' },
  { id: 'belgrano', nombre: 'Belgrano' },
];

export const CajaPage = () => {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [caja, setCaja] = useState(null);
  const [ventasHoy, setVentasHoy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  
  // Campos del formulario
  const [negocioSeleccionado, setNegocioSeleccionado] = useState('');
  const [saldoApertura, setSaldoApertura] = useState('');
  const [saldoCierre, setSaldoCierre] = useState('');

  const restriction = checkDeviceRestriction('aperturaCaja');
  const canAccess = !isMobile;

  useEffect(() => {
    const fetchCaja = async () => {
      try {
        const cajaQuery = query(
          collection(db, 'caja'),
          where('estado', '==', 'abierta')
        );
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          const cajaData = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
          setCaja(cajaData);
          setNegocioSeleccionado(cajaData.sucursal);
          
          // Traer ventas de hoy para esta caja
          const ventasSnapshot = await getDocs(collection(db, 'ventas'));
          const fechaApertura = cajaData.fecha?.toDate ? cajaData.fecha.toDate() : new Date(cajaData.fecha);
          const ventasDelTurno = ventasSnapshot.docs
            .filter(d => {
              const fechaVenta = d.data().fecha?.toDate ? d.data().fecha.toDate() : new Date(d.data().fecha);
              return fechaVenta >= fechaApertura && d.data().negocio === cajaData.sucursal;
            })
            .map(d => ({ id: d.id, ...d.data() }));
          setVentasHoy(ventasDelTurno);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCaja();
  }, []);

  const abrirCaja = async () => {
    if (!negocioSeleccionado) {
      alert('Seleccioná un negocio');
      return;
    }
    setProcesando(true);
    try {
      const ahora = new Date();
      const docRef = await addDoc(collection(db, 'caja'), {
        estado: 'abierta',
        sucursal: negocioSeleccionado,
        saldoApertura: parseFloat(saldoApertura) || 0,
        montoEfectivo: parseFloat(saldoApertura) || 0,
        abiertoPor: user.uid,
        abiertoPorNombre: user.email || 'Usuario',
        fecha: ahora.toISOString(),
        hora: ahora.toISOString(),
        ventasEfectivo: 0,
        ventasTarjeta: 0,
        ventasMercadoPago: 0,
        ventasCuentaDNI: 0,
      });
      setCaja({ 
        id: docRef.id, 
        estado: 'abierta', 
        sucursal: negocioSeleccionado,
        saldoApertura: parseFloat(saldoApertura) || 0,
        montoEfectivo: parseFloat(saldoApertura) || 0,
      });
      setSaldoApertura('');
    } catch (err) {
      console.error(err);
      alert('Error al abrir caja');
    } finally {
      setProcesando(false);
    }
  };

  const calcularVentas = () => {
    const ventasEfectivo = ventasHoy
      .filter(v => v.tipoPago?.includes('efectivo'))
      .reduce((sum, v) => sum + v.total, 0);
    
    const ventasTarjeta = ventasHoy
      .filter(v => v.tipoPago?.includes('tarjeta'))
      .reduce((sum, v) => sum + v.total, 0);
    
    const ventasMercadoPago = ventasHoy
      .filter(v => v.tipoPago?.includes('mercadopago'))
      .reduce((sum, v) => sum + v.total, 0);
    
    const ventasCuentaDNI = ventasHoy
      .filter(v => v.tipoPago?.includes('cuentadni'))
      .reduce((sum, v) => sum + v.total, 0);
    
    const ventaTotal = ventasEfectivo + ventasTarjeta + ventasMercadoPago + ventasCuentaDNI;
    const saldoSistema = (caja?.saldoApertura || 0) + ventasEfectivo;
    const diferencia = (parseFloat(saldoCierre) || 0) - saldoSistema;

    return { ventasEfectivo, ventasTarjeta, ventasMercadoPago, ventasCuentaDNI, ventaTotal, saldoSistema, diferencia };
  };

  const cerrarCaja = async () => {
    setProcesando(true);
    try {
      const ahora = new Date();
      const { ventasEfectivo, ventasTarjeta, ventasMercadoPago, ventasCuentaDNI, ventaTotal, saldoSistema, diferencia } = calcularVentas();
      
      await updateDoc(doc(db, 'caja', caja.id), {
        estado: 'cerrada',
        ventasEfectivo,
        ventasTarjeta,
        ventasMercadoPago,
        ventasMercadoPago,
        ventasCuentaDNI,
        ventaTotal,
        saldoSistema,
        saldoCierre: parseFloat(saldoCierre) || 0,
        diferencia,
        cerradoPor: user.uid,
        cerradoPorNombre: user.email || 'Usuario',
        horaCierre: ahora.toISOString(),
      });
      
      alert('Caja cerrada con éxito');
      setCaja(null);
      setSaldoCierre('');
      setVentasHoy([]);
    } catch (err) {
      console.error(err);
      alert('Error al cerrar caja');
    } finally {
      setProcesando(false);
    }
  };

  const imprimirTicketCierre = () => {
    if (!caja) return;
    alert('Funcionalidad de impresión de ticket de cierre - pendiente implementar');
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          {restriction.message || 'La caja solo puede abrirse desde PC'}
        </div>
      </Layout>
    );
  }

  const { ventasEfectivo, ventasTarjeta, ventasMercadoPago, ventasCuentaDNI, ventaTotal, saldoSistema, diferencia } = calcularVentas();

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Gestión de Caja</h2>

      {!caja ? (
        <div className="bg-white p-6 rounded-lg shadow max-w-md">
          <h3 className="text-xl font-semibold mb-4">Apertura de Caja</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Seleccionar Negocio</label>
            <select
              value={negocioSeleccionado}
              onChange={(e) => setNegocioSeleccionado(e.target.value)}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">-- Seleccionar --</option>
              {NEGOCIOS.map(n => (
                <option key={n.id} value={n.id}>{n.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Saldo de Apertura (Efectivo)</label>
            <input
              type="number"
              step="0.01"
              value={saldoApertura}
              onChange={(e) => setSaldoApertura(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="0.00"
            />
          </div>

          <button
            onClick={abrirCaja}
            disabled={procesando || !negocioSeleccionado || !saldoApertura}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {procesando ? 'Procesando...' : 'Abrir Caja'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold">Caja Abierta</h3>
                <p className="text-sm text-gray-500">Negocio: <span className="font-semibold capitalize">{caja.sucursal}</span></p>
              </div>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Abierta</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-500">Saldo Apertura</p>
                <p className="font-semibold">${caja.saldoApertura}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-500">Venta Total</p>
                <p className="font-semibold text-green-600">${ventaTotal}</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="text-sm font-semibold mb-2">Ventas por Método:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>Efectivo: <span className="font-semibold">${ventasEfectivo}</span></p>
                <p>Tarjeta: <span className="font-semibold">${ventasTarjeta}</span></p>
                <p>MercadoPago: <span className="font-semibold">${ventasMercadoPago}</span></p>
                <p>Cuenta DNI: <span className="font-semibold">${ventasCuentaDNI}</span></p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Cierre de Caja</h3>
              <button
                onClick={imprimirTicketCierre}
                className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
              >
                🖨️ Imprimir Ticket
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Saldo en Caja (Efectivo)</label>
              <input
                type="number"
                step="0.01"
                value={saldoCierre}
                onChange={(e) => setSaldoCierre(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="0.00"
              />
            </div>

            {saldoCierre && (
              <div className="mb-4 p-3 bg-yellow-50 rounded text-sm">
                <p>Diferencia: <span className={`font-semibold ${diferencia === 0 ? 'text-green-600' : 'text-red-600'}`}>${diferencia}</span></p>
              </div>
            )}

            <button
              onClick={cerrarCaja}
              disabled={procesando || !saldoCierre}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {procesando ? 'Procesando...' : 'Cerrar Caja'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CajaPage;