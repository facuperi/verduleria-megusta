import { formatNum } from '../utils/format';

const FILTROS_PREDEFINIDOS = ['Frutos secos', 'Quesos', 'Almacén'];
const ORDENES = ['default', 'az', 'za'];
const ORDEN_LABEL = { default: 'Default', az: 'A-Z', za: 'Z-A' };

export const BuscadorProductos = ({
  busqueda,
  productos,
  productosTodos,
  agregarComoNotaCredito,
  onBusquedaChange,
  onToggleNotaCredito,
  onProductClick,
  scanError,
  flashGreenId,
  filtroActivo,
  ordenActivo,
  onChangeFiltro,
  onChangeOrden,
}) => {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div
          onClick={() => onProductClick({ id: '__frutas_verduras__', nombre: 'Frutas y Verduras', tipo: 'frutasVerduras', precio: 0 })}
          className="bg-card p-3 rounded-lg shadow-sm border-2 border-amber border-dashed cursor-pointer hover:bg-amber-soft/30 flex flex-col items-center justify-center min-h-[80px]"
        >
          <h4 className="font-semibold text-sm mt-1">Frutas y Verduras</h4>
          <span className="text-xs text-amber font-medium">Total del ticket</span>
        </div>
        <div
          onClick={() => onProductClick({ id: '__huevos__', nombre: 'Huevos', tipo: 'huevos', precio: 0 })}
          className="bg-card p-3 rounded-lg shadow-sm border-2 border-amber border-dashed cursor-pointer hover:bg-amber-soft/30 flex flex-col items-center justify-center min-h-[80px]"
        >
          <h4 className="font-semibold text-sm mt-1">Huevos</h4>
          <span className="text-xs text-amber font-medium">Elegir presentación</span>
        </div>
        <div
          onClick={() => onProductClick({ id: '__lena_carbon__', nombre: 'Leña y Carbón', tipo: 'lenaCarbon', precio: 0 })}
          className="bg-card p-3 rounded-lg shadow-sm border-2 border-amber border-dashed cursor-pointer hover:bg-amber-soft/30 flex flex-col items-center justify-center min-h-[80px]"
        >
          <h4 className="font-semibold text-sm mt-1">Leña y Carbón</h4>
          <span className="text-xs text-amber font-medium">Elegir opción</span>
        </div>
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-line mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold">Buscar producto</h3>
          <button
            onClick={onToggleNotaCredito}
            className={`px-3 py-1 rounded text-xs font-semibold border ${agregarComoNotaCredito ? 'bg-red-600 text-white border-red-600' : 'bg-elevated text-secondary border-line'}`}
          >
            {agregarComoNotaCredito ? 'Nota Crédito' : 'Agregar como Nota Crédito'}
          </button>
        </div>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          placeholder="Escanee o escriba para buscar..."
          className="w-full border border-line-input bg-input text-body p-2 rounded mb-3"
        />

        {scanError && (
          <div className="mb-3 p-2 bg-red-soft text-red text-sm rounded flex items-center gap-1 font-semibold">
            Código <strong>{scanError}</strong> no encontrado en la base de datos
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onChangeFiltro('todos')}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              filtroActivo === 'todos'
                ? 'bg-amber text-white'
                : 'bg-elevated text-secondary hover:bg-amber-soft/30'
            }`}
          >
            Todos
          </button>
          {FILTROS_PREDEFINIDOS.map(f => (
            <button
              key={f}
              onClick={() => onChangeFiltro(f)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                filtroActivo === f
                  ? 'bg-amber text-white'
                  : 'bg-elevated text-secondary hover:bg-amber-soft/30'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-sm">
            <span className="text-muted">Orden:</span>
            <button
              onClick={() => {
                const idx = ORDENES.indexOf(ordenActivo);
                onChangeOrden(ORDENES[(idx + 1) % ORDENES.length]);
              }}
              className="px-2 py-1 rounded bg-elevated text-secondary hover:bg-amber-soft/30 font-semibold"
            >
              {ORDEN_LABEL[ordenActivo]}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {productos.length === 0 && !busqueda && filtroActivo === 'todos' ? (
          <div className="col-span-full">
            <p className="text-muted text-center py-8">No hay productos disponibles</p>
          </div>
        ) : productos.length === 0 ? (
          <div className="col-span-full">
            <p className="text-muted text-center py-8">
              {busqueda
                ? `No se encontraron productos para "${busqueda}"`
                : `No hay productos en "${filtroActivo}"`}
            </p>
          </div>
        ) : (
          productos
            .filter(p => p.tipo !== 'pesable' && p.tipo !== 'lena' && p.tipo !== 'carbon' && p.tipo !== 'huevos')
            .map(producto => (
              <div
                key={producto.id}
                onClick={() => onProductClick(producto)}
                className={`bg-card p-3 rounded-lg shadow-sm border border-line cursor-pointer hover:bg-elevated ${agregarComoNotaCredito ? 'ring-2 ring-red' : ''} ${producto.tipo === 'pesableConStock' ? 'ring-1 ring-amber' : ''} ${flashGreenId === producto.id ? 'bg-green-200 ring-2 ring-green' : ''}`}
              >
                <h4 className="font-semibold text-sm">{producto.nombre}</h4>
                <div className="mt-1 flex justify-between items-center text-sm">
                  <span className="text-green">${formatNum(producto.precio)}</span>
                  {producto.tipo === 'pesableConStock' && <span className="text-xs text-amber font-medium">Pesable</span>}
                </div>
                {producto.tipo === 'noPesable' && (
                  <p className="text-xs text-muted mt-1">
                    Stock: {producto.stock || 0}
                  </p>
                )}
                {producto.tipo === 'pesableConStock' && (
                  <p className="text-xs text-muted mt-1">
                    Stock: {producto.stock || 0} kg
                  </p>
                )}
                {producto.filtro && (
                  <p className="text-xs text-muted mt-1">
                    {producto.filtro}
                  </p>
                )}
              </div>
            ))
        )}
      </div>
    </>
  );
};
