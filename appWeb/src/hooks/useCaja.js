import { useState, useEffect, useCallback } from 'react';
import { getDocs } from 'firebase/firestore';
import { getCajaAbierta } from '../services/cajaService';

export const useCaja = (db, sucursal) => {
  const [caja, setCaja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCaja = useCallback(async () => {
    if (!db || !sucursal) {
      setCaja(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = getCajaAbierta(db, sucursal);
      const snapshot = await getDocs(q);
      setCaja(snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    } catch (err) {
      setError(err.message || 'Error al cargar caja');
    } finally {
      setLoading(false);
    }
  }, [db, sucursal]);

  useEffect(() => {
    fetchCaja();
  }, [fetchCaja]);

  return { caja, loading, error, refetch: fetchCaja };
};
