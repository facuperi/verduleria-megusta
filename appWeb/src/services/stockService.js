import { collection, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';

export const addMovimientoStock = (db, data) => addDoc(collection(db, 'movimientosStock'), data);

export const getMovimientos = (db) => getDocs(query(
  collection(db, 'movimientosStock'),
  orderBy('fecha', 'desc'),
  limit(100)
));

export const addIngreso = (db, data) => addDoc(collection(db, 'ingresosMercaderia'), data);

export const getIngresos = (db) => getDocs(query(
  collection(db, 'ingresosMercaderia'),
  orderBy('fecha', 'desc'),
  limit(100)
));
