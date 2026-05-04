import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

export const CajaPage = () => {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [caja, setCaja] = useState(null);
  const [ventasHoy, setVentasHoy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [montoApertura, setMontoApertura] = useState('');
  const [montoCierre, setMontoCierre] = useState('');
  const [procesando, setProcesando] = useState(false);

  const restriction = checkDeviceRestriction('cierreCaja');
  const canAccess = !isMobile;

  useEffect(() => {
    const fetchCaja = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const cajaQuery = query(
          collection(db, 'caja'),
          where('fecha', '>=', today.toISOString())
        );
        const cajaSnapshot = await getDocs(cajaQuery);
        
        if (!cajaSnapshot.empty) {
          setCaja({ id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() });
          
          const ventasSnapshot = await getDocs(collection(db, 'ventas'));
          const ventasDelDia = ventasSnapshot.docs
            .filter(d => d.data().fecha?.toDate?.() >= today)
            .map(d => ({ id: d.id, ...d.data() }));
          setVentasHoy(ventasDelDia);
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
    setProcesando(true);
    try {
      const docRef = await addDoc(collection(db, 'caja'), {
        estado: 'abierta',
        montoApertura: parseFloat(montoApertura),
        montoActual: parseFloat(montoApertura),
        abiertoPor: user.uid,
        fecha: new Date().toISOString(),
      });
      setCaja({ id: docRef.id, estado: 'abierta', montoApertura: parseFloat(montoApertura), montoActual: parseFloat(montoApertura) });
      setMontoApertura('');
    } catch (err) {
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  const cerrarCaja = async () => {
    setProcesando(true);
    try {
      const totalVentas = ventasHoy.reduce((sum, v) => sum + v.total, 0);
      const montoFinal = caja.montoActual + totalVentas;
      
      await updateDoc(doc(db, 'caja', caja.id), {
        estado: 'cerrada',
        montoCierre: parseFloat(montoCierre),
        montoFinal,
        cerradoPor: user.uid,
        fechaCierre: new Date().toISOString(),
      });
      setCaja(null);
      setMontoCierre('');
      alert('Caja cerrada con éxito');
    } catch (err) {
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          {restriction.message}
        </div>
      </Layout>
    );
  }

  const totalVentas = ventasHoy.reduce((sum, v) => sum + v.total, 0);

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Gestión de Caja</h2>

      {!caja ? (
        <div className="bg-white p-6 rounded-lg shadow max-w-md">
          <h3 className="text-xl font-semibold mb-4">Apertura de Caja</h3>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Monto inicial</label>
            <input
              type="number"
              step="0.01"
              value={montoApertura}
              onChange={(e) => setMontoApertura(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="0.00"
            />
          </div>
          <button
            onClick={abrirCaja}
            disabled={procesando || !montoApertura}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {procesando ? 'Procesando...' : 'Abrir Caja'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Caja Abierta</h3>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Abierta</span>
            </div>
            <p className="text-gray-600">Monto de apertura: ${caja.montoApertura}</p>
            <p className="text-gray-600">Ventas del día: ${totalVentas}</p>
            <p className="text-xl font-bold">Monto actual: ${caja.montoActual + totalVentas}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow max-w-md">
            <h3 className="text-xl font-semibold mb-4">Cierre de Caja</h3>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Monto en caja</label>
              <input
                type="number"
                step="0.01"
                value={montoCierre}
                onChange={(e) => setMontoCierre(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="0.00"
              />
            </div>
            <button
              onClick={cerrarCaja}
              disabled={procesando || !montoCierre}
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