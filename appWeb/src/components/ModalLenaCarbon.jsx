import { useState } from 'react'
import { Modal } from './Modal'
import { formatNum } from '../utils/format'
import { useConfirm } from '../contexts/ConfirmContext'

export const ModalLenaCarbon = ({ open, onClose, onConfirm, onActualizarPrecio, productos }) => {
  const [selected, setSelected] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [editandoPrecioId, setEditandoPrecioId] = useState(null)
  const [precioEditando, setPrecioEditando] = useState('')
  const { confirm } = useConfirm()

  if (!open) return null

  const subtotal = selected ? selected.precio * cantidad : 0
  const sinStock = selected && (selected.stock || 0) < cantidad

  const guardarPrecio = async (p) => {
    const nuevo = parseFloat(precioEditando)
    if (nuevo && nuevo > 0 && nuevo !== p.precio) {
      const ok = await confirm(`Confirmar nuevo precio para ${p.nombre}: $${nuevo.toLocaleString('es-AR')}?`, 'Modificar precio')
      if (!ok) return
      onActualizarPrecio(p, nuevo)
    }
    setEditandoPrecioId(null)
    setPrecioEditando('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Leña y Carbón" className="max-w-md">
      <div className="grid grid-cols-2 gap-2 mb-4">
        {productos.map(p => (
          <div
            key={p.id}
            onClick={() => { if (editandoPrecioId !== p.id) { setSelected(p); setCantidad(1) } }}
            className={`p-3 rounded-lg border-2 text-center transition-all cursor-pointer select-none ${
              selected?.id === p.id
                ? 'border-amber bg-amber-soft/20'
                : 'border-line-input bg-input hover:border-amber'
            } ${(!p.stock || p.stock <= 0) ? 'opacity-40' : ''}`}
          >
            <p className="font-bold text-sm mt-1">{p.nombre}</p>
            {editandoPrecioId === p.id ? (
              <input
                type="number"
                value={precioEditando}
                onChange={(e) => setPrecioEditando(e.target.value)}
                onBlur={() => guardarPrecio(p)}
                onKeyDown={(e) => { if (e.key === 'Enter') guardarPrecio(p); if (e.key === 'Escape') { setEditandoPrecioId(null); setPrecioEditando('') } }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-full text-center text-green font-semibold bg-input border border-line-input rounded p-1 text-sm"
              />
            ) : (
              <p
                className="text-green font-semibold hover:bg-green-soft/30 rounded px-1 py-0.5 cursor-pointer inline-block"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onActualizarPrecio) {
                    setEditandoPrecioId(p.id)
                    setPrecioEditando(p.precio.toString())
                  }
                }}
              >
                ${formatNum(p.precio)}
              </p>
            )}
            <p className="text-xs text-muted">
              Stock: {p.stock || 0}
              {(!p.stock || p.stock <= 0) && <span className="text-red ml-1">(sin stock)</span>}
            </p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Cantidad</label>
          <input
            type="number"
            min="1"
            max={selected.stock || 1}
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Math.min(parseInt(e.target.value) || 1, selected.stock || 999)))}
            className="w-full border border-line-input bg-input text-body p-2 rounded text-center text-lg"
          />
          <div className="mt-2 text-sm">
            <p className="text-muted">
              Subtotal: <strong className="text-body">${formatNum(subtotal)}</strong>
            </p>
            {sinStock && (
              <p className="text-red text-xs font-semibold mt-1">Stock insuficiente (disponible: {selected.stock || 0})</p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!selected || cantidad < 1 || sinStock) return
            onConfirm(selected, cantidad)
          }}
          disabled={!selected || cantidad < 1 || sinStock}
          className="flex-1 bg-amber text-white py-2 rounded font-semibold hover:bg-amber/80 disabled:opacity-50"
        >
          Agregar al carrito
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-line-input rounded hover:bg-elevated">
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
