import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';

export const UsuariosPage = () => {
  const { isGerente, user } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '', nombre: '', rol: 'empleado', activo: true });

  const restriction = checkDeviceRestriction('gestionarUsuarios');
  const canAccess = !isMobile && isGerente;

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsuarios();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await updateDoc(doc(db, 'users', editando.id), {
          nombre: formData.nombre,
          rol: formData.rol,
          activo: formData.activo,
        });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: formData.email,
          nombre: formData.nombre,
          rol: formData.rol,
          activo: true,
          creadoPor: user.uid,
          creadoEn: new Date().toISOString(),
        });
      }
      setShowModal(false);
      setEditando(null);
      setFormData({ email: '', password: '', nombre: '', rol: 'empleado', activo: true });
      
      const snapshot = await getDocs(collection(db, 'users'));
      setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      showToast('Error al guardar usuario: ' + err.message, 'error');
    }
  };

  const eliminarUsuario = async (id) => {
    const ok = await confirm('¿Estás seguro de eliminar este usuario?', 'Eliminar usuario');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setUsuarios(usuarios.filter(u => u.id !== id));
      showToast('Usuario eliminado', 'success');
    } catch (err) {
      showToast('Error al eliminar usuario: ' + err.message, 'error');
    }
  };

  const abrirEditar = (usuario) => {
    setEditando(usuario);
    setFormData({ nombre: usuario.nombre, rol: usuario.rol, email: '', password: '', activo: usuario.activo !== false });
    setShowModal(true);
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Cargando...</div></Layout>;
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          {restriction.message}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
        <button
          onClick={() => { setShowModal(true); setEditando(null); setFormData({ email: '', password: '', nombre: '', rol: 'empleado', activo: true }); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Agregar Usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Rol</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(usuario => (
              <tr key={usuario.id} className="border-t">
                <td className="px-4 py-2">{usuario.nombre}</td>
                <td className="px-4 py-2">{usuario.email}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-sm ${usuario.rol === 'gerente' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {usuario.rol}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => abrirEditar(usuario)} className="text-blue-600 hover:text-blue-800 mr-2">
                    Editar
                  </button>
                  <button onClick={() => eliminarUsuario(usuario.id)} className="text-red-600 hover:text-red-800">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usuarios.length === 0 && (
          <p className="text-center py-4 text-gray-500">No hay usuarios registrados</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{editando ? 'Editar' : 'Agregar'} Usuario</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              {!editando && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-bold mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border p-2 rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-bold mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full border p-2 rounded"
                      required
                    />
                  </div>
                </>
              )}
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full border p-2 rounded"
                >
                  <option value="empleado">Empleado</option>
                  <option value="gerente">Gerente</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded flex-1">
                  Guardar
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="bg-gray-300 px-4 py-2 rounded">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default UsuariosPage;