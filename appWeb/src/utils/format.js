export const formatNum = (n) => {
  const val = Number(n || 0);
  return val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};
