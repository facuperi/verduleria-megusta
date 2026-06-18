export const formatNum = (n, decimals = 1) => {
  const val = Number(n || 0);
  return val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
};
