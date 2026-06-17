import { collection, getDocs, addDoc, updateDoc, doc, getDoc, setDoc, query, where, orderBy } from 'firebase/firestore';

export const getCajaAbierta = (db) => query(
  collection(db, 'caja'), where('estado', '==', 'abierta')
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

export const getUltimoCierre = (db) =>
  getDoc(doc(db, 'ultimoCierre', 'unico'));

export const setUltimoCierre = (db, data) =>
  setDoc(doc(db, 'ultimoCierre', 'unico'), data, { merge: true });

