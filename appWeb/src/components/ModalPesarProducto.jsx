import { useEffect, useRef } from 'react'
import { Modal } from './Modal'
import { formatNum } from '../utils/format'
import { useScaleInput } from '../hooks/useScaleInput'

export const ModalPesarProducto = ({
  producto,
  open,
  onConfirm,
  onCancel,
}) => {
  if (!producto) return null

  const { displayValue, handleKeyDown, getKg, reset } = useScaleInput(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleManualConfirm = () => {
    const kg = getKg()
    if (kg > 0) {
      onConfirm(kg)
    }
  }

  const onKeyDown = (e) => {
    handleKeyDown(e)
    if (e.key === 'Enter') {
      const kg = getKg()
      if (kg > 0) {
        onConfirm(kg)
      }
    }
  }

  const kgVal = getKg()

  return (
    <Modal open={open} onClose={onCancel} title={null} className="max-w-sm p-6">
      <div className="text-center">
        <p className="text-lg font-bold mb-1">{producto.nombre}</p>
        <p className="text-sm text-muted mb-4">${formatNum(producto.precio)} / kg</p>

        <div className="mb-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={displayValue}
            onKeyDown={onKeyDown}
            placeholder="0.000"
            className="w-full border-2 border-line-input bg-input text-body p-3 rounded text-center text-2xl font-mono"
            autoFocus
          />
          <p className="text-xs text-muted mt-1">Peso en kg — escribí como en la balanza (ej: 100 → 0.100)</p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded border border-line text-secondary hover:text-body"
          >
            Cancelar
          </button>
          <button
            onClick={handleManualConfirm}
            disabled={!kgVal || kgVal <= 0}
            className="px-5 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>
    </Modal>
  )
}
