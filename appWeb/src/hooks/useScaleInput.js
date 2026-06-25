import { useState, useCallback } from 'react'

export const useScaleInput = (initialKg = 0) => {
  const [grams, setGrams] = useState(Math.round(initialKg * 1000))

  const displayValue = (grams / 1000).toFixed(3)

  const handleKeyDown = useCallback((e) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      setGrams(prev => Math.min(prev * 10 + parseInt(e.key), 9999999))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setGrams(prev => Math.floor(prev / 10))
    }
  }, [])

  const getKg = useCallback(() => grams / 1000, [grams])
  const setKg = useCallback((kg) => setGrams(Math.round(kg * 1000)), [])
  const reset = useCallback(() => setGrams(0), [])

  return { grams, displayValue, handleKeyDown, getKg, setKg, reset }
}
