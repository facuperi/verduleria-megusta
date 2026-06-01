import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';

export const getCajaAbierta = (db, sucursal) => query(
  collection(db, 'caja'), where('sucursal', '==', sucursal), where('estado', '==', 'abierta')
);
export const abrirCaja = (db, data) => addDoc(collection(db, 'caja'), data);
export const cerrarCaja = (db, id, data) => updateDoc(doc(db, 'caja', id), data);
export const addRetiro = (db, data) => addDoc(collection(db, 'retirosCaja'), data);
export const addTipoRetiro = (db, data) => addDoc(collection(db, 'tiposRetiro'), data);
export const getTiposRetiro = (db) => getDocs(query(collection(db, 'tiposRetiro'), orderBy('nombre')));
export const getRetirosByCaja = (db, cajaId) => query(
  collection(db, 'retirosCaja'), where('cajaId', '==', cajaId), orderBy('fecha', 'desc')
);

