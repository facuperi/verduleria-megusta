import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAllProductos } from '../services/productosService';

const PRODUCTOS_DEFECTO = [
  { id: 'lena_x5', data: { nombre: 'Leña x5', tipo: 'lena', precio: 0, stock: 0, filtro: 'Leña' } },
  { id: 'lena_x10', data: { nombre: 'Leña x10', tipo: 'lena', precio: 0, stock: 0, filtro: 'Leña' } },
  { id: 'carbon', data: { nombre: 'Carbón', tipo: 'carbon', precio: 0, stock: 0, filtro: 'Carbón' } },
];

const asegurarProductosDefecto = async (db) => {
  let creados = false;
  for (const prod of PRODUCTOS_DEFECTO) {
    const ref = doc(db, 'productos', prod.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, prod.data);
      creados = true;
    } else {
      const data = snap.data();
      const updates = {};
      if (!data.filtro) updates.filtro = prod.data.filtro;
      if (Object.keys(updates).length > 0) {
        await updateDoc(ref, updates);
        creados = true;
      }
    }
  }
  return creados;
};

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
        await asegurarProductosDefecto(db);
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
