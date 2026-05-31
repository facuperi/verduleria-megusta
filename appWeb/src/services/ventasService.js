import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';

export const createVenta = (db, data) => addDoc(collection(db, 'ventas'), data);

export const updateVenta = (db, id, data) => updateDoc(doc(db, 'ventas', id), data);

export const getVentasByDate = (db, start, end) => query(
  collection(db, 'ventas'),
  where('fecha', '>=', start),
  where('fecha', '<=', end),
  orderBy('fecha', 'desc')
);

export const getVentasByDateAndSucursal = (db, start, end, sucursal) => query(
  collection(db, 'ventas'),
  where('fecha', '>=', start),
  where('fecha', '<=', end),
  where('sucursal', '==', sucursal),
  orderBy('fecha', 'desc')
);

export const getAllVentas = (db) => getDocs(collection(db, 'ventas'));
