import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

export const getAllProductos = (db) => getDocs(collection(db, 'productos'));

export const getProducto = (db, id) => getDoc(doc(db, 'productos', id));

export const addProducto = (db, data) => addDoc(collection(db, 'productos'), data);

export const updateProducto = (db, id, data) => updateDoc(doc(db, 'productos', id), data);

export const deleteProducto = (db, id) => deleteDoc(doc(db, 'productos', id));
