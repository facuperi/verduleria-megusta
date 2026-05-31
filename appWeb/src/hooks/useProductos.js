import { useState, useEffect } from 'react';
import { getAllProductos } from '../services/productosService';

export const useProductos = (db) => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const snapshot = await getAllProductos(db);
        if (!cancelled) {
          setProductos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al cargar productos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { productos, loading, error };
};
