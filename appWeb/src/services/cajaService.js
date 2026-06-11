import { collection, getDocs, addDoc, updateDoc, doc, getDoc, setDoc, query, where, orderBy } from 'firebase/firestore';

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

// === INGRESO FUNCTIONS ===
export const addIngreso = (db, data) => addDoc(collection(db, 'ingresosCaja'), data);
export const addTipoIngreso = (db, data) => addDoc(collection(db, 'tiposIngreso'), data);
export const getTiposIngreso = (db) => getDocs(query(collection(db, 'tiposIngreso'), orderBy('nombre')));
export const getIngresosByCaja = (db, cajaId) => query(
  collection(db, 'ingresosCaja'), where('cajaId', '==', cajaId), orderBy('fecha', 'desc')
);

export const getUltimoCierre = (db, sucursal) =>
  getDoc(doc(db, 'ultimoCierre', sucursal));

export const setUltimoCierre = (db, sucursal, data) =>
  setDoc(doc(db, 'ultimoCierre', sucursal), data, { merge: true });

