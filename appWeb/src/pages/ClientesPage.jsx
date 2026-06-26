import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDevice, checkDeviceRestriction } from '../hooks/useDevice';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { formatNum } from '../utils/format';

const METODOS_PAGO = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'mercadopago', nombre: 'Mercado Pago' },
  { id: 'cuentadni', nombre: 'Cuenta DNI' },
];

const necesitaFacturaAuto = (metodo) => ['tarjeta', 'debito', 'cuentadni', 'mercadopago'].includes(metodo);

export const ClientesPage = () => {
  const { isGerente } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [clientePago, setClientePago] = useState(null);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [pagoProcesando, setPagoProcesando] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const [formData, setFormData] = useState({ nombre: '', infoAdicional: '', deuda: 0 });
  const [tipoFactura, setTipoFactura] = useState(null);
  const [cuitFactura, setCuitFactura] = useState('');
  const [facturaError, setFacturaError] = useState('');
  const [facturando, setFacturando] = useState(false);
  const [facturaData, setFacturaData] = useState(null);

  const restriction = checkDeviceRestriction('clientes');
  const canAccess = !isMobile && isGerente;

  const resetForm = () => { setFormData({ nombre: '', infoAdicional: '', deuda: 0 }); setEditando(null); };

  useEffect(() => {
    if (!canAccess) return;
    const fetchData = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'clientes'));
        setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [canAccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;
    setProcesando(true);
    try {
      const data = {
        nombre: formData.nombre.trim(),
        infoAdicional: formData.infoAdicional.trim(),
        deuda: parseFloat(formData.deuda) || 0,
        actualizado: new Date().toISOString(),
      };
      if (editando) {
        await updateDoc(doc(db, 'clientes', editando.id), data);
      } else {
        data.creado = new Date().toISOString();
        await addDoc(collection(db, 'clientes'), data);
      }
      setShowModal(false);
      resetForm();
      const snapshot = await getDocs(collection(db, 'clientes'));
      setClientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      showToast(editando ? 'Cliente actualizado' : 'Cliente creado', 'success');
    } catch (err) { showToast('Error al guardar cliente', 'error'); }
    finally { setProcesando(false); }
  };

  const abrirEditar = (cliente) => {
    setEditando(cliente);
    setFormData({ nombre: cliente.nombre || '', infoAdicional: cliente.infoAdicional || '', deuda: cliente.deuda || 0 });
    setShowModal(true);
  };

  const eliminarCliente = async (id) => {
    if (!await confirm('¿Estás seguro de eliminar este cliente?', 'Eliminar cliente')) return;
    try {
      await deleteDoc(doc(db, 'clientes', id));
      setClientes(clientes.filter(c => c.id !== id));
      showToast('Cliente eliminado', 'success');
    } catch (err) { showToast('Error al eliminar cliente', 'error'); }
  };

  const cargarHistorial = async (cliente) => {
    setCargandoHistorial(true);
    try {
      const q = query(collection(db, 'ventas'), where('clienteId', '==', cliente.id), orderBy('fecha', 'desc'));
      const snapshot = await getDocs(q);
      setHistorial(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const snapshot = await getDocs(collection(db, 'ventas'));
        const todas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(m => m.clienteId === cliente.id)
          .sort((a, b) => {
            const da = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
            const db2 = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
            return db2 - da;
          });
        setHistorial(todas);
      } catch { setHistorial([]); }
    }
    finally { setCargandoHistorial(false); }
  };

  const abrirCliente = async (cliente) => {
    setClienteSeleccionado(cliente);
    setFacturaData(null);
    setFacturaError('');
    setShowClienteModal(true);
    await cargarHistorial(cliente);
  };

  const facturarVenta = async (ventaId, total, tipoFactura, documentoCliente) => {
    const FUNCTIONS_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL;
    if (!FUNCTIONS_URL) throw new Error('FUNCTIONS_URL no configurada');
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ventaId, total, tipoFactura, documentoCliente }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de conexión' }));
      throw new Error(err.error || 'Error al facturar');
    }
    return res.json();
  };

  const handlePagoDeuda = async () => {
    const monto = parseFloat(montoPago);
    if (!monto || monto <= 0) { showToast('Ingresá un monto válido', 'error'); return; }
    if (monto > (clientePago.deuda || 0)) { showToast('El monto supera la deuda del cliente', 'error'); return; }
    setPagoProcesando(true);
    try {
      const ahora = new Date();

      const ventaDoc = await addDoc(collection(db, 'ventas'), {
        tipoVenta: 'pagoDeuda',
        productos: [{ nombre: 'Deuda', precio: monto, cantidad: 1 }],
        total: monto,
        totalVenta: 0,
        totalNotaCredito: 0,
        diferencia: monto,
        pagos: [{ metodo: metodoPago, monto: parseFloat(montoPago) || 0 }],
        tipoPago: [metodoPago],
        clienteId: clientePago.id,
        clienteNombre: clientePago.nombre,
        facturada: false,
        usuarioId: auth.currentUser.uid,
        usuarioNombre: auth.currentUser.email || 'Usuario',
        fecha: serverTimestamp(),
        hora: ahora.toISOString(),
      });

      await updateDoc(doc(db, 'clientes', clientePago.id), {
        deuda: Math.max(0, (clientePago.deuda || 0) - monto),
        actualizado: new Date().toISOString(),
      });

      const cajaSnapshot = await getDocs(query(collection(db, 'caja'), where('estado', '==', 'abierta')));
      if (!cajaSnapshot.empty) {
        const caja = { id: cajaSnapshot.docs[0].id, ...cajaSnapshot.docs[0].data() };
        const campoKey = {
          'efectivo': 'ventasEfectivo', 'tarjeta': 'ventasTarjeta', 'debito': 'ventasDebito',
          'mercadopago': 'ventasMercadoPago', 'cuentadni': 'ventasCuentaDNI',
        }[metodoPago];

        const updateData = {};
        if (campoKey) updateData[campoKey] = (caja[campoKey] || 0) + monto;
        if (metodoPago === 'efectivo') updateData.montoEfectivo = (caja.montoEfectivo || 0) + monto;
        if (Object.keys(updateData).length > 0) await updateDoc(doc(db, 'caja', caja.id), updateData);
      }

      if (necesitaFacturaAuto(metodoPago)) {
        const quiereFacturaA = await confirm(
          'Este método de pago requiere factura electrónica. ¿Qué tipo de factura querés emitir?',
          'Facturación',
          'Factura A (con CUIT)',
          'Factura B (consumidor final)'
        );

        if (quiereFacturaA) {
          setTipoFactura('A');
          setCuitFactura('');
          setFacturaError('');
          setFacturaData(null);
        } else {
          setFacturando(true);
          try {
            const resultado = await facturarVenta(ventaDoc.id, monto, 'B', null);
            setFacturaData(resultado);
            await updateDoc(doc(db, 'ventas', ventaDoc.id), {
              cae: resultado.cae, facturaNumero: resultado.numero, facturaFechaVto: resultado.fechaVto,
              facturaTipo: 'Factura B', facturaPtoVta: import.meta.env.VITE_AFIP_PTO_VTA || '0001',
              facturaNeto: resultado.neto, facturaIva: resultado.iva,
            });
            showToast(`Factura B generada: N° ${resultado.numero}`, 'success');
          } catch (error) {
            console.error('Error en facturación:', error);
            showToast(`Error al facturar: ${error.message}`, 'error');
          } finally { setFacturando(false); }
        }
      }

      setShowPagoModal(false);
      setMontoPago('');
      setMetodoPago('efectivo');

      const snapshot = await getDocs(collection(db, 'clientes'));
      setClientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      const updated = snapshot.docs.find(d => d.id === clientePago.id);
      if (updated) {
        const data = { id: updated.id, ...updated.data() };
        setClientePago(data);
        setClienteSeleccionado(data);
      }
      await cargarHistorial(clientePago);
      showToast(`Pago registrado: $${formatNum(monto)} con ${METODOS_PAGO.find(m => m.id === metodoPago)?.nombre || metodoPago}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al registrar pago', 'error');
    } finally { setPagoProcesando(false); }
  };

  const confirmarFacturaA = async () => {
    if (!cuitFactura.trim() || cuitFactura.trim().length < 11) {
      setFacturaError('Ingresá un CUIT válido de 11 dígitos');
      return;
    }
    setFacturando(true);
    setFacturaError('');
    try {
      const q = query(collection(db, 'ventas'), where('clienteId', '==', clientePago.id), where('fecha', '==', serverTimestamp()));
      const ventaSnapshot = await getDocs(q);
      // Find the last pagoDeuda for this client
      const ventasSnapshot = await getDocs(query(collection(db, 'ventas'), where('clienteId', '==', clientePago.id), orderBy('fecha', 'desc')));
      const ventaDoc = ventasSnapshot.docs.find(d => d.data().tipoVenta === 'pagoDeuda' && !d.data().cae);
      if (!ventaDoc) throw new Error('No se encontró la venta');

      const resultado = await facturarVenta(ventaDoc.id, ventaDoc.data().total, 'A', cuitFactura.trim());
      setFacturaData(resultado);
      await updateDoc(doc(db, 'ventas', ventaDoc.id), {
        cae: resultado.cae, facturaNumero: resultado.numero, facturaFechaVto: resultado.fechaVto,
        facturaTipo: 'Factura A', facturaPtoVta: import.meta.env.VITE_AFIP_PTO_VTA || '0001',
        facturaNeto: resultado.neto, facturaIva: resultado.iva, cuitCliente: cuitFactura.trim(),
      });
      setTipoFactura(null);
      setCuitFactura('');
      showToast(`Factura A generada: N° ${resultado.numero}`, 'success');
    } catch (error) {
      console.error('Error en facturación:', error);
      setFacturaError(error.message || 'Error al facturar');
    } finally { setFacturando(false); }
  };

  if (!canAccess) {
    return (
      <Layout>
        <div className="bg-yellow-soft border border-yellow-line text-yellow px-4 py-3 rounded">
          {restriction.message || 'Solo los gerentes pueden gestionar clientes desde PC'}
        </div>
      </Layout>
    );
  }

  if (loading) return <Layout><LoadingSkeleton type="page" /></Layout>;

  const clientesFiltrados = busqueda
    ? clientes.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || c.infoAdicional?.toLowerCase().includes(busqueda.toLowerCase()))
    : clientes;

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <div className="flex gap-2">
          {isGerente && (
            <button
              onClick={() => { setShowModal(true); resetForm(); }}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              + Agregar Cliente
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar cliente por nombre o info..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border border-line-input bg-input text-body p-2 rounded"
        />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-line overflow-hidden">
        <table className="w-full">
          <thead className="bg-table-header">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">Info adicional</th>
              <th className="px-4 py-2 text-right">Deuda</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={4}><EmptyState title="No hay clientes" icon="👥" /></td>
              </tr>
            ) : (
              clientesFiltrados.map(cliente => (
                <tr
                  key={cliente.id}
                  className="border-t border-line cursor-pointer hover:bg-elevated transition-colors"
                  onClick={() => abrirCliente(cliente)}
                >
                  <td className="px-4 py-2 font-medium">{cliente.nombre}</td>
                  <td className="px-4 py-2 text-sm text-muted">{cliente.infoAdicional || '—'}</td>
                  <td className={`px-4 py-2 text-right font-bold ${(cliente.deuda || 0) > 0 ? 'text-red' : 'text-green'}`}>
                    ${formatNum(cliente.deuda || 0)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); abrirEditar(cliente); }}
                      className="text-blue hover:text-blue mr-2 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); eliminarCliente(cliente.id); }}
                      className="text-red hover:text-red text-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editando ? 'Editar Cliente' : 'Agregar Cliente'}>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Nombre</label>
            <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className="w-full border border-line-input bg-input text-body p-2 rounded" required />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Información adicional</label>
            <textarea value={formData.infoAdicional} onChange={(e) => setFormData({ ...formData, infoAdicional: e.target.value })} className="w-full border border-line-input bg-input text-body p-2 rounded" rows={2} placeholder="Teléfono, dirección, notas..." />
          </div>
          {!editando && (
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Deuda inicial</label>
              <input type="number" step="0.01" value={formData.deuda} onChange={(e) => setFormData({ ...formData, deuda: e.target.value })} className="w-full border border-line-input bg-input text-body p-2 rounded" />
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={procesando} className="bg-indigo-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
              {procesando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="bg-surface px-4 py-2 rounded">Cancelar</button>
          </div>
        </form>
      </Modal>

      <Modal open={showClienteModal} onClose={() => { setShowClienteModal(false); setClienteSeleccionado(null); setHistorial([]); setFacturaData(null); setFacturaError(''); }}
        title={clienteSeleccionado?.nombre || 'Cliente'} className="max-w-2xl">
        {clienteSeleccionado && (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                {clienteSeleccionado.infoAdicional && (
                  <p className="text-sm text-muted">{clienteSeleccionado.infoAdicional}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-secondary">Deuda actual</p>
                <p className={`text-3xl font-bold ${(clienteSeleccionado.deuda || 0) > 0 ? 'text-red' : 'text-green'}`}>
                  ${formatNum(clienteSeleccionado.deuda || 0)}
                </p>
              </div>
            </div>

            {(clienteSeleccionado.deuda || 0) > 0 && (
              <button
                onClick={() => { setClientePago(clienteSeleccionado); setMontoPago(''); setMetodoPago('efectivo'); setTipoFactura(null); setFacturaData(null); setFacturaError(''); setShowPagoModal(true); }}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mb-4 font-semibold"
              >
                💰 Registrar pago
              </button>
            )}

            <h4 className="text-sm font-bold mb-2">Historial</h4>
            {cargandoHistorial ? (
              <LoadingSkeleton type="table" rows={3} />
            ) : historial.length === 0 ? (
              <p className="text-sm text-muted">Sin movimientos</p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-line rounded">
                <table className="w-full text-sm">
                  <thead className="bg-table-header sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Fecha</th>
                      <th className="px-3 py-1.5 text-left">Tipo</th>
                      <th className="px-3 py-1.5 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map(m => {
                      const esPago = m.tipoVenta === 'pagoDeuda';
                      const esDeuda = !esPago && m.pagos?.some(p => p.metodo === 'deuda');
                      const monto = esDeuda ? (m.montoDeuda || 0) : (m.total || 0);
                      return (
                        <tr key={m.id} className="border-t border-line">
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {m.hora ? new Date(m.hora).toLocaleDateString('es-AR') : (m.fecha?.toDate ? m.fecha.toDate().toLocaleDateString('es-AR') : '—')}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${esPago ? 'bg-green-soft text-green' : esDeuda ? 'bg-red-soft text-red' : 'bg-blue-soft text-blue'}`}>
                              {esPago ? 'Pago' : esDeuda ? 'Compra (deuda)' : m.tipoVenta || 'Venta'}
                            </span>
                          </td>
                          <td className={`px-3 py-1.5 text-right font-semibold ${esPago ? 'text-green' : 'text-red'}`}>
                            {esPago ? '+' : '-'}${formatNum(monto)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {facturaData && (
              <div className="mt-4 p-3 bg-green-soft rounded border border-green-line">
                <p className="text-sm font-semibold text-green">✅ Factura {facturaData.tipo || 'B'} N° {facturaData.numero}</p>
                <p className="text-xs text-green mt-1">CAE: {facturaData.cae} — Vto: {facturaData.fechaVto}</p>
              </div>
            )}
            {facturaError && (
              <div className="mt-4 p-3 bg-red-soft rounded border border-red-line">
                <p className="text-sm text-red font-semibold">⚠️ {facturaError}</p>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={showPagoModal} onClose={() => { setShowPagoModal(false); setTipoFactura(null); setFacturaData(null); setFacturaError(''); }}
        title="Registrar pago" className="max-w-sm">
        <p className="text-sm text-secondary mb-3">
          Cliente: <strong>{clientePago?.nombre}</strong> — Deuda actual: <strong>${formatNum(clientePago?.deuda || 0)}</strong>
        </p>

        {tipoFactura === 'A' ? (
          <>
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">CUIT del cliente</label>
              <input type="text" value={cuitFactura} onChange={(e) => setCuitFactura(e.target.value)} placeholder="11 dígitos sin guiones" className="w-full border border-line-input bg-input text-body p-2 rounded" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarFacturaA} disabled={facturando} className="bg-indigo-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
                {facturando ? 'Facturando...' : 'Confirmar Factura A'}
              </button>
              <button onClick={() => setTipoFactura(null)} className="bg-surface px-4 py-2 rounded">Volver</button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">Monto</label>
              <input type="number" step="0.01" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} placeholder="0.00" className="w-full border border-line-input bg-input text-body p-2 rounded" autoFocus />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Método de pago</label>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full border border-line-input bg-input text-body p-2 rounded">
                {METODOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePagoDeuda} disabled={pagoProcesando || facturando} className="bg-green-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50 font-semibold">
                {(pagoProcesando || facturando) ? 'Procesando...' : 'Confirmar pago'}
              </button>
              <button onClick={() => { setShowPagoModal(false); setTipoFactura(null); setFacturaData(null); setFacturaError(''); }} className="bg-surface px-4 py-2 rounded" disabled={pagoProcesando}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
};

export default ClientesPage;
