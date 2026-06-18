import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';

const hoy = () => new Date().toISOString().split('T')[0];
const hace30dias = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

export const MovimientosPage = () => {
  const { user } = useAuth();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(hace30dias());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [filtroProducto, setFiltroProducto] = useState('');

  useEffect(() => {
    if (!fechaDesde && !fechaHasta) return;
    cargarMovimientos();
  }, [fechaDesde, fechaHasta]);

  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      const condiciones = [orderBy('fecha', 'desc'), limit(200)];
      if (fechaDesde) condiciones.unshift(where('fecha', '>=', `${fechaDesde}T00:00:00.000Z`));
      if (fechaHasta) condiciones.unshift(where('fecha', '<=', `${fechaHasta}T23:59:59.999Z`));

      const snapshot = await getDocs(query(collection(db, 'movimientosStock'), ...condiciones));
      setMovimientos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const movimientosFiltrados = filtroProducto
    ? movimientos.filter(m =>
        m.productoNombre?.toLowerCase().includes(filtroProducto.toLowerCase())
      )
    : movimientos;

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6">Historial de Movimientos</h2>

      <div className="bg-card p-4 rounded-lg border border-line mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1 text-secondary">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full border border-line-input bg-input text-body p-2 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 text-secondary">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full border border-line-input bg-input text-body p-2 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 text-secondary">Producto</label>
            <input
              type="text"
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full border border-line-input bg-input text-body p-2 rounded text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={cargarMovimientos}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm w-full"
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-line overflow-hidden">
        {loading ? (
          <LoadingSkeleton type="table" rows={8} />
        ) : movimientosFiltrados.length === 0 ? (
          <EmptyState title="No hay movimientos en este período" icon="📋" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-table-header">
                <tr>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-center px-4 py-3">Cantidad</th>
                  <th className="text-left px-4 py-3">Realizado por</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map(m => (
                  <tr key={m.id} className="border-b border-line hover:bg-elevated">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        m.tipo === 'ingreso' ? 'bg-green-soft text-green' :
                        m.tipo === 'egreso' ? 'bg-red-soft text-red' :
                        'bg-purple-soft text-purple'
                      }`}>
                        {m.tipo === 'ingreso' ? '⬆ Ingreso' : m.tipo === 'egreso' ? '⬇ Egreso' : '✎ Corrección'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.productoNombre}</td>
                    <td className={`px-4 py-3 text-center font-semibold ${
                      m.signo === 'sumar' || m.tipo === 'ingreso' ? 'text-green' : 'text-red'
                    }`}>
                      {(m.signo === 'sumar' || m.tipo === 'ingreso') ? '+' : '-'}{m.cantidad}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.realizadoPor || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MovimientosPage;
