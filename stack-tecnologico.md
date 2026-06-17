# Stack Tecnológico - Sistema de Facturación para Verdulería

## Requisitos del Proyecto

- **Usuarios**: 5 a 15 usuarios
- **Tipo de acceso**: Multi-dispositivo (PC y móvil)
- **Base de datos**: En la nube (cloud)

---

## Propuesta de Stack

### Frontend

| Capa | Tecnología | Justificación |
|------|-------------|---------------|
| Web (PC) | React + Vite | Permite crear una SPA robusta para ventas y gestión desde escritorio |
| Móvil | React Native (Expo) | Comparte lógica con el frontend web, acceso directo a cámara y notificaciones push |
| Estilos | Tailwind CSS | Desarrollo rápido, consistencia visual entre web y móvil |

### Backend

| Capa | Tecnología | Justificación |
|------|-------------|---------------|
| API | Node.js + Express | JavaScript en todo el stack, comunidad amplia |
| Auth | Firebase Auth | Manejo de usuarios, login con email/contraseña, integración con React |
| Funciones serverless | Firebase Cloud Functions | Lógica restringida solo para servidor (cierre de caja, cálculos de inventario) |

### Base de Datos

| Servicio | Tecnología | Justificación |
|----------|-------------|---------------|
| Cloud DB | Firebase Firestore | Base de datos NoSQL en tiempo real, cloud-native, escala automática |
| Storage | Firebase Cloud Storage | Almacenamiento de imágenes de productos |

### Despliegue

| Servicio | Uso |
|----------|-----|
| Vercel / Netlify | Hosting del frontend web |
| Firebase Hosting | Hosting de la API y funciones serverless |

---

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **Gerente** | Acceso completo: ventas, cierre/apertura de caja, gestión de inventario, reportes, gestión de usuarios |
| **Empleado** | Consultar stock, consultar precios, procesar ventas (solo desde PC) |

---

## Restricciones por Dispositivo

| Funcionalidad | PC (Web) | Móvil |
|---------------|----------|-------|
| Realizar venta | ✓ | ✗ |
| Cierre/Apertura de caja | ✓ | ✗ |
| Ver stock | ✓ | ✓ |
| Consultar precios | ✓ | ✓ |
| Gestionar usuarios | ✓ (Gerente) | ✗ |
| Reportes | ✓ (Gerente) | ✗ |

---

## Arquitectura de Seguridad

```
                    ┌─────────────────┐
                    │   Cliente Web    │
                    │   (React)       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Firebase Auth   │
                    │ (Verifica rol)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐  ┌──────▼──────┐  ┌──▼────────┐
     │ Firestore  │  │ Cloud Func  │  │ Firestore │
     │ (lectura) │  │ (restringida)│ │ (escritura)│
     └───────────┘  └─────────────┘  └───────────┘
```

### Reglas de Seguridad

1. **Firestore Rules**: Permitir lectura de inventario a cualquier usuario autenticado
2. **Cloud Functions**: Solo el gerente puede ejecutar cierre de caja desde el backend
3. **Restricción móvil**: Validar `navigator.userAgent` para bloquear ventas desde móvil

---

## Costos Estimados (Firebase)

| Servicio | Plan Gratis |
|----------|------------|
| Auth | Ilimitado |
| Firestore | 1 GB |
| Cloud Functions | 125K invocaciones/mes |
| Storage | 5 GB |
| Hosting | 1 GB |

**Nota**: Para 5-15 usuarios con uso moderado, el plan gratuito de Firebase es suficiente.

---

## Próximos Pasos

1. Crear proyecto en Firebase Console
2. Inicializar repo con React + Vite
3. Configurar Firestore y reglas de seguridad
4. Implementar autenticación
5. Desarrollar módulo de inventario
6. Desarrollar módulo de ventas
7. Implementar restricciones por dispositivo