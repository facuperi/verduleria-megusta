import { useState, useEffect } from 'react';
import { collection, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Layout } from '../components/Layout';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tieneUsuarios, setTieneUsuarios] = useState(true);

  useEffect(() => {
    const verificar = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        setTieneUsuarios(snapshot.size > 0);
      } catch (err) {
        console.error('Error:', err);
        setTieneUsuarios(false);
      }
    };
    verificar();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const emailConvertido = `${username.toLowerCase().trim()}@santos.com`;
      const userCredential = await signInWithEmailAndPassword(auth, emailConvertido, password);
      const uid = userCredential.user.uid;
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        setError('Usuario no autorizado. Contacta al administrador.');
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      if (userData.activo === false) {
        await signOut(auth);
        setError('Usuario deshabilitado. Contacta al administrador.');
        setLoading(false);
        return;
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        setError('Usuario o contraseña incorrectos');
      } else if (err.code === 'auth/invalid-email') {
        setError('Usuario inválido');
      } else if (err.code === 'auth/user-disabled') {
        setError('Usuario deshabilitado');
      } else {
        setError('Error: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6">Iniciar Sesión</h1>
          
          {!tieneUsuarios && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
              No hay usuarios. Сrea el primero.
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default LoginPage;