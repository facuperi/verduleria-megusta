import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';

export const UsuariosPage = () => {
  const { isGerente } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ id: '', password: '', nombre: '', rol: 'empleado', activo: true });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const restriction = checkDeviceRestriction('gestionarUsuarios');
  const canAccess = !isMobile && isGerente;

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        setUsuarios(snapshot.docs.map(doc => ({ _uid: doc.id, ...doc.data() })));
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
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editando) {
        await updateDoc(doc(db, 'users', editando._uid), {
          nombre: formData.nombre,
          rol: formData.rol,
          activo: formData.activo,
        });
      } else {
        const idNormalizado = formData.id.trim().toLowerCase();

        if (formData.password.length < 6) {
          showToast('La contraseña debe tener al menos 6 caracteres', 'error');
          setSubmitting(false);
          return;
        }

        const crearUsuario = httpsCallable(functions, 'crearUsuario');
        await crearUsuario({
          id: idNormalizado,
          nombre: formData.nombre,
          password: formData.password,
          rol: formData.rol,
        });
      }
      setShowModal(false);
      setEditando(null);
      setFormData({ id: '', password: '', nombre: '', rol: 'empleado', activo: true });
      
      const snapshot = await getDocs(collection(db, 'users'));
      setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      const code = err.code?.split('/').pop() || err.message;
      if (code === 'already-exists') {
        showToast('Ese ID ya está registrado en el sistema', 'error');
      } else if (code === 'permission-denied') {
        showToast('No tenés permisos de gerente para crear usuarios', 'error');
      } else {
        showToast('Error al guardar usuario: ' + err.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const abrirCambiarPassword = (usuario) => {
    setPasswordTarget(usuario);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (changingPassword) return;
    if (newPassword.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const fn = httpsCallable(functions, 'actualizarPassword');
      await fn({ uid: passwordTarget._uid, newPassword });
      showToast('Contraseña actualizada', 'success');
      setShowPasswordModal(false);
      setPasswordTarget(null);
    } catch (err) {
      const code = err.code?.split('/').pop();
      if (code === 'permission-denied') {
        showToast('No tenés permisos de gerente para cambiar contraseñas', 'error');
      } else {
        showToast('Error al cambiar contraseña: ' + err.message, 'error');
      }
    } finally {
      setChangingPassword(false);
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
    setFormData({ nombre: usuario.nombre, rol: usuario.rol, id: '', password: '', activo: usuario.activo !== false });
    setShowModal(true);
  };

  if (loading) {
    return <Layout><LoadingSkeleton type="page" /></Layout>;
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-300 px-4 py-3 rounded">
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
          onClick={() => { setShowModal(true); setEditando(null); setFormData({ id: '', password: '', nombre: '', rol: 'empleado', activo: true }); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Agregar Usuario
        </button>
      </div>

      <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700/50 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">ID de usuario</th>
              <th className="px-4 py-2 text-left">Rol</th>
              <th className="px-4 py-2 text-left">Contraseña</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(usuario => (
              <tr key={usuario._uid} className="border-t border-gray-700/50">
                <td className="px-4 py-2">{usuario.nombre}</td>
                <td className="px-4 py-2">{usuario.id || usuario.email}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-sm ${usuario.rol === 'gerente' ? 'bg-purple-900/30 text-purple-300' : 'bg-blue-900/30 text-blue-300'}`}>
                    {usuario.rol}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="text-gray-400 tracking-widest">••••••••</span>
                  <button
                    onClick={() => abrirCambiarPassword(usuario)}
                    className="ml-2 text-gray-400 hover:text-indigo-400"
                    title="Cambiar contraseña"
                  >
                    ✏️
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => abrirEditar(usuario)} className="text-blue-400 hover:text-blue-300 mr-2">
                    Editar
                  </button>
                   <button onClick={() => eliminarUsuario(usuario._uid)} className="text-red-400 hover:text-red-300">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usuarios.length === 0 && (
            <EmptyState title="No hay usuarios registrados" icon="👤" />
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editando ? 'Editar Usuario' : 'Agregar Usuario'}>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Nombre</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
              required
            />
          </div>
          {!editando && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">ID de usuario</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
                  placeholder="ej: juan, maria123"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Contraseña</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
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
              className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
            >
              <option value="empleado">Empleado</option>
              <option value="gerente">Gerente</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className={`${submitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded flex-1`}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="bg-gray-600 px-4 py-2 rounded">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} title={`Cambiar contraseña - ${passwordTarget?.nombre || ''}`}>
        <form onSubmit={handlePasswordChange}>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
              required
              minLength={6}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-600 bg-gray-700 text-gray-100 p-2 rounded"
              required
              minLength={6}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={changingPassword} className={`${changingPassword ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded flex-1`}>
              {changingPassword ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setShowPasswordModal(false)} className="bg-gray-600 px-4 py-2 rounded">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default UsuariosPage;