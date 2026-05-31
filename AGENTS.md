# Proyecto Santos y Santas — Estado al 30/05/2026

## Stack
- Frontend: React + Vite + Tailwind + Firebase Hosting
- Backend: Firebase Firestore + Cloud Functions (Node 20, v2)
- Facturación: AFIP WS (Factura A/B vía Cloud Function con Secret Manager)

## Último commit
093ae00 — fix: imports de EmptyState en CarritoVentas e HistorialMovimientos

Commits anteriores relevantes:
- 84ef0bc — UI: ErrorBoundary, LoadingSkeleton, EmptyState
- 51bf1d4 — Refactor: Modal genérico, services, hooks, componentes extraídos
- 8db365d — varios fixes de seguridad y caja
- 1d3a2c7 — Seguridad: firestore.rules, auth en Cloud Function, .env untracked

## Arquitectura actual

### Componentes (src/components/)
- `Layout.jsx` — Nav + sidebar responsive + Modal de logout
- `Modal.jsx` — Overlay genérico con title, close, className, noClose
- `ErrorBoundary.jsx` — Class component, envuelve <BrowserRouter> en App.jsx
- `LoadingSkeleton.jsx` — type: text|card|table|page, rows, count
- `EmptyState.jsx` — icon + title + description + action button
- `ResumenCaja.jsx` — Stats cards de caja
- `HistorialMovimientos.jsx` — Tabla ventas+retiros combinada
- `FiltrosReportes.jsx` — Panel de filtros de reportes
- `ResumenReportes.jsx` — Summary cards de reportes
- `TablaReportes.jsx` — Tabla con expandibles + botón 🧾 reimprimir ticket
- `CarritoVentas.jsx` — Carrito de ventas
- `BuscadorProductos.jsx` — Buscador de productos

### Servicios (src/services/)
- `productosService.js` — CRUD productos
- `ventasService.js` — Query ventas por fecha/sucursal
- `stockService.js` — Movimientos e ingresos
- `cajaService.js` — Caja, retiros, tipos de retiro

### Hooks (src/hooks/)
- `useProductos.js` — Fetch productos on mount
- `useCaja.js` — Fetch caja abierta por sucursal con refetch
- `useDevice.js` — Detección mobile/PC

### Contextos (src/contexts/)
- `AuthContext.jsx` — user, userRole, isGerente, selectedNegocio, login, logout
- `ToastContext.jsx` — showToast(msg, type)
- `ConfirmContext.jsx` — await confirm(message, title) → boolean

### Utilidades (src/utils/)
- `ticketPrinter.js` — imprimirTicketVenta, imprimirTicketAFavor, imprimirTicketCajaCerrada, getDireccion, getSucursalNombre, TELEFONO

### Cloud Functions (functions/)
- `index.js` — onRequest con verifyIdToken, llama AFIP WS
- Secrets: AFIP_ACCESS_TOKEN, AFIP_CUIT, AFIP_PTO_VTA, AFIP_CERT, AFIP_KEY

## Reglas Firestore (firestore.rules)
- update en caja: requiere (auth + abiertoPor match + estado abierta) O isGerente()
- update/delete en ventas: solo gerente
- update/delete en retirosCaja: false
- movimientosStock: solo gerente

## .env (appWeb/.env)
- Firebase creds + VITE_FIREBASE_FUNCTIONS_URL + VITE_AFIP_PTO_VTA
- IMPORTANTE: no pushear, ya está en .gitignore

## Lo que hicimos hasta ahora (resumen)

### Seguridad
- firestore.rules con control por colección + estado 'abierta' en caja
- PrivateRoute para /ventas, /stock, /movimientos, /reportes, /usuarios
- Auth JWT verification en Cloud Function
- .env removido de git tracking

### Refactor frontend
- 10 modales inline → Modal genérico
- services/ extraídos (4 archivos)
- hooks/ extraídos (useProductos, useCaja)
- CajaPage 1160→~600 lines (ResumenCaja, HistorialMovimientos)
- ReportesPage 799→~400 lines (FiltrosReportes, ResumenReportes, TablaReportes)

### UI
- ErrorBoundary (captura errores de render)
- LoadingSkeleton (animate-pulse, 4 variantes)
- EmptyState (icono + mensaje + acción)
- Reemplazados todos los "Cargando..." y "No hay..." con estos componentes

### Features
- 🧾 Ticket de cierre reimprimible desde Reportes
- Migración de cajas viejas (backfill ventasBrutas, diferencia)
- Migración de retiros viejos (backfill negocio)
- Una caja por negocio (antes una por usuario)
- Cloud Function factura con AFIP + auth

### Bugs corregidos
- Login redirect: useEffect → <Navigate> declarativo
- Multi-caja: rules evitan modificar caja cerrada
- Caja colgada: force-close + reglas permiten a gerente update
- EmptyState imports mal ubicados (CarritoVentas, HistorialMovimientos)

## Lo que falta por hacer

### 🔵 Prioridad baja — Mejoras puntuales
1. ~Mover FIREBASE_FUNCTIONS_URL a .env~ ✅
2. ~Mover AFIP_PTO_VTA a .env~ ✅
3. ~Eliminar lib/afip.js~ ✅
4. ~Mover direcciones/teléfono a constantes~ ✅
5. ~Reemplazar último alert()~ ✅
6. ~ErrorBoundary~ ✅
7. ~LoadingSkeleton~ ✅
8. ~EmptyState~ ✅

### 🔴 Pendiente del usuario
9. **Probar facturación end-to-end** — Hacer venta con tarjeta/débito que dispare Cloud Function y genere Factura B. Probar también con CUIT para Factura A.

### ☑️ Completo (verificar en próxima sesión)
- Migración de cajas viejas desde Reportes (botón ⚠️)
- 🧾 en cierres de Reportes
- Los LoadingSkeleton/EmptyState no rompen nada

## Puntos críticos / donde tener cuidado

### Al cargar una nueva sesión de opencode
- **NO pushear .env** — contiene API keys, ya está en .gitignore
- **NO tocar functions/secretManager** sin entender el flujo actual
- **NO cambiar firestore.rules** sin deployar ambos (rules + hosting)
- Las reglas de caja requieren `estado == 'abierta'` O `isGerente()`
- `selectedNegocio` se guarda en sessionStorage, no localStorage

### Archivos que NO mover/renombrar sin revisar imports
- Cualquier archivo en `src/components/` o `src/services/` o `src/hooks/`
- Verificar TODOS los imports antes de renombrar

### Cloud Function
- Usa `onRequest({secrets: [...]})` — sintaxis v2 de firebase-functions v7
- URL: https://facturarventa-v7nkl2aufq-uc.a.run.app
- Node 20, native fetch (no node-fetch)
- Secrets: AFIP_ACCESS_TOKEN, AFIP_CUIT, AFIP_PTO_VTA, AFIP_CERT, AFIP_KEY

### Firestore
- Colección `caja` (singular), no `cajas`
- Colección `retirosCaja`, no `retiros`
- Las queries de caja filtran por `sucursal == selectedNegocio` y `estado == 'abierta'`

### Deploy
```bash
firebase deploy --only hosting          # frontend
firebase deploy --only firestore:rules  # rules
firebase deploy --only functions        # cloud functions
```
Siempre buildear antes: `cd appWeb && npm run build`
