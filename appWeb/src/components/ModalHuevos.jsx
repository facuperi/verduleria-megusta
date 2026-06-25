import { useState } from 'react'
import { Modal } from './Modal'
import { formatNum } from '../utils/format'
import { useConfirm } from '../contexts/ConfirmContext'

const PRESENTACIONES_DEFECTO = [
  { nombre: 'x6', unidades: 6, precio: 1500 },
  { nombre: 'x12', unidades: 12, precio: 2800 },
  { nombre: 'x20', unidades: 20, precio: 4500 },
  { nombre: 'x30', unidades: 30, precio: 6500 },
]

export const ModalHuevos = ({ open, onClose, onConfirm, onRegistrarRotura, onActualizarPresentacion, presentaciones: presentacionesProp, stock }) => {
  const [selected, setSelected] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [roturaUnidades, setRoturaUnidades] = useState('')
  const [editandoPrecioId, setEditandoPrecioId] = useState(null)
  const [precioEditando, setPrecioEditando] = useState('')
  const { confirm } = useConfirm()

  if (!open) return null

  const presentaciones = presentacionesProp || PRESENTACIONES_DEFECTO

  const subtotal = selected ? selected.precio * cantidad : 0

  const handleConfirm = () => {
    if (!selected || cantidad < 1) return
    const unidadesVendidas = selected.unidades * cantidad
    if (unidadesVendidas > stock) return
    onConfirm(selected, cantidad)
  }

  const handleRotura = () => {
    const unidades = parseInt(roturaUnidades)
    if (!unidades || unidades < 1) return
    onRegistrarRotura(unidades)
    setRoturaUnidades('')
  }

  const guardarPrecio = async (p) => {
    const nuevo = parseFloat(precioEditando)
    if (nuevo && nuevo > 0 && nuevo !== p.precio) {
      const ok = await confirm(`Confirmar nuevo precio para Huevos ${p.nombre}: $${nuevo.toLocaleString('es-AR')}?`, 'Modificar precio')
      if (!ok) return
      onActualizarPresentacion(p.nombre, nuevo)
    }
    setEditandoPrecioId(null)
    setPrecioEditando('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Huevos" className="max-w-md">
      <div className="mb-3 flex justify-between items-center">
        <span className="text-sm text-muted">Stock: {stock} unidades</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {presentaciones.map(p => (
          <div
            key={p.nombre}
            onClick={() => { if (editandoPrecioId !== p.nombre) setSelected(p) }}
            className={`p-3 rounded-lg border-2 text-center transition-all cursor-pointer select-none ${
              selected?.nombre === p.nombre
                ? 'border-amber bg-amber-soft/20'
                : 'border-line-input bg-input hover:border-amber'
            }`}
          >
            <p className="font-bold text-lg">{p.nombre}</p>
            {editandoPrecioId === p.nombre ? (
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
                  if (onActualizarPresentacion) {
                    setEditandoPrecioId(p.nombre)
                    setPrecioEditando(p.precio.toString())
                  }
                }}
              >
                ${formatNum(p.precio)}
              </p>
            )}
            <p className="text-xs text-muted">{p.unidades} uds</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Cantidad de envases</label>
          <input
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-line-input bg-input text-body p-2 rounded text-center text-lg"
          />
          <div className="mt-2 text-sm space-y-1">
            <p className="text-muted">
              {selected.nombre} x {cantidad} = <strong className="text-body">${formatNum(subtotal)}</strong>
            </p>
            <p className="text-xs text-muted">
              Unidades a descontar: {selected.unidades * cantidad} huevos
              {selected.unidades * cantidad > stock && (
                <span className="text-red font-semibold ml-1">Stock insuficiente</span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleConfirm}
          disabled={!selected || cantidad < 1 || (selected && selected.unidades * cantidad > stock)}
          className="flex-1 bg-amber text-white py-2 rounded font-semibold hover:bg-amber/80 disabled:opacity-50"
        >
          Agregar al carrito
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-line-input rounded hover:bg-elevated">
          Cancelar
        </button>
      </div>

      <div className="border-t border-line pt-3">
        <p className="text-sm font-bold text-red mb-2">Huevos rotos</p>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="1"
            value={roturaUnidades}
            onChange={(e) => setRoturaUnidades(e.target.value)}
            placeholder="Cantidad de huevos"
            className="flex-1 border border-red/30 bg-input text-body p-2 rounded text-center text-lg"
          />
          <button
            onClick={handleRotura}
            disabled={!roturaUnidades || parseInt(roturaUnidades) < 1}
            className="bg-red text-white px-4 py-2 rounded font-semibold hover:bg-red/80 disabled:opacity-50 whitespace-nowrap"
          >
            Registrar rotura
          </button>
        </div>
      </div>
    </Modal>
  )
}
