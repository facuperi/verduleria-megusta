import { useEffect, useRef, useCallback } from 'react';

export const useBarcodeScanner = (onScan) => {
  const buffer = useRef('');
  const timer = useRef(null);
  const callback = useRef(onScan);

  callback.current = onScan;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && buffer.current.length >= 8) {
        e.preventDefault();
        const codigo = buffer.current;
        buffer.current = '';
        clearTimeout(timer.current);
        callback.current?.(codigo);
        return;
      }

      if (e.key === 'Enter') return;

      if (e.key.length === 1) {
        clearTimeout(timer.current);
        buffer.current += e.key;
        timer.current = setTimeout(() => {
          buffer.current = '';
        }, 150);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer.current);
    };
  }, []);
};
