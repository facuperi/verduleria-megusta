import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

export const ReportesPage = () => {
  const { isGerente } = useAuth();
  const { isMobile } = useDevice();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('hoy');

  const restriction = checkDeviceRestriction('reportes');
  const canAccess = !isMobile && isGerente;

  useEffect(() => {
    const fetchVentas = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'ventas'));
        let ventasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const now = new Date();
        if (filtro === 'hoy') {
          const today = startOfDay(now);
          ventasData = ventasData.filter(v => v.fecha?.toDate?.() >= today);
        } else if (filtro === 'semana') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          ventasData = ventasData.filter(v => v.fecha?.toDate?.() >= weekAgo);
        }
        
        setVentas(ventasData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVentas();
  }, [filtro]);

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

  const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
  const cantidadVentas = ventas.length;
  const promedio = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Reportes</h2>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFiltro('hoy')}
          className={`px-4 py-2 rounded ${filtro === 'hoy' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Hoy
        </button>
        <button
          onClick={() => setFiltro('semana')}
          className={`px-4 py-2 rounded ${filtro === 'semana' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Esta Semana
        </button>
        <button
          onClick={() => setFiltro('todos')}
          className={`px-4 py-2 rounded ${filtro === 'todos' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Todo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Total Ventas</p>
          <p className="text-2xl font-bold text-green-600">${totalVentas}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Cantidad de Ventas</p>
          <p className="text-2xl font-bold">{cantidadVentas}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Promedio por Venta</p>
          <p className="text-2xl font-bold">${promedio.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Fecha</th>
              <th className="px-4 py-2 text-left">Productos</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map(venta => (
              <tr key={venta.id} className="border-t">
                <td className="px-4 py-2">
                  {venta.fecha?.toDate?.()?.toLocaleDateString() || 'N/A'}
                </td>
                <td className="px-4 py-2">
                  {venta.productos?.map(p => p.nombre).join(', ')}
                </td>
                <td className="px-4 py-2 text-right font-semibold">${venta.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ventas.length === 0 && (
          <p className="text-center py-4 text-gray-500">No hay ventas en este período</p>
        )}
      </div>
    </Layout>
  );
};

export default ReportesPage;