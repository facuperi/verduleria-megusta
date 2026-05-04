# Sistema de Facturación - Negocio de Ropa

## 1. Roles y Permisos

### Gerente
- Modificar montos de ventas (por errores)
- Editar precios de productos
- Eliminar ventas
- Ver reportes
- Abrir/cerrar caja
- Ver stock global de todos los negocios

### Empleado
- Realizar ventas
- Ver stock
- Entrada/salida de mercadería
- Abrir/cerrar caja
- **NO** puede modificar ventas directamente
- Si necesita corregir: crea "venta de error" (nota de crédito) que queda registrada

## 2. Productos
- Código de barras (EAN-13)
- Código interno
- Nombre
- Precio
- Stock

## 3. Stock
- Múltiples ubicaciones (2 negocios inicial)
- Gerente ve stock global de todos los negocios

## 4. Flujo de Ventas
1. Agregar al carrito (manual o scanner)
2. Confirmar venta → modifica stock
3. Si toca "facturar" → conecta ARCA e imprime ticket
4. Sino → venta en negro (sin factura)

## 5. Datos registrados por venta
- Fecha
- Hora
- Vendedora
- Total
- Facturada o no

## 6. Caja
- Apertura y cierre obligatorios
- Registrar monto inicial y final

## 7. Backend
- Firebase (Auth, Firestore, Storage)
- Cloud Functions para:
  - Facturación ARCA
  - Generación de códigos de barras
  - Validaciones de negocio