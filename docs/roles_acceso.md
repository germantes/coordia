# Matriz de roles, permisos y ámbitos

Esta es la definición única de perfiles de COORDIA. La API usa cinco valores técnicos de `role`, agrupados en tres perfiles funcionales: ciudadano, miembro de un organismo y administrador.

## Perfiles funcionales

| Perfil | Roles de API | Ámbito | Permisos principales |
|---|---|---|---|
| **Ciudadano** | `guest` | Un organismo asignado. | Crear reportes y consultar los propios. Puede ver una ficha sanitizada de reportes pendientes cercanos de su organismo para confirmarlos o cuestionarlos, sin ver quién los creó ni sus coordenadas exactas. No puede cambiar el estado del reporte ni borrarlo. |
| **Miembro de un organismo** | `dev`, `qa`, `po` | Solo el `organizationId` asignado. | Las operaciones dependen del subrol técnico, descrito en la siguiente tabla. Ninguno tiene acceso global ni administra usuarios u organismos. |
| **Administrador** | `admin` | Global. | Gestionar recursos y permisos en todos los organismos. |

Los roles `dev`, `qa` y `po` son permisos técnicos dentro del perfil **miembro de un organismo**, no ámbitos globales. La única excepción al aislamiento por organismo es `admin`.

## Matriz de operaciones

| Recurso / operación | Ciudadano (`guest`) | Miembro de organismo (`dev`, `qa`, `po`) | Administrador (`admin`) |
|---|---|---|---|
| **Crear reportes** | Sí; el servidor asigna autor y organismo. | `dev`, solo en entorno de desarrollo. | Sí, en cualquier ámbito. |
| **Leer reportes** | Propios. Además, `/api/reports/nearby` devuelve campos limitados de reportes pendientes del mismo organismo y dentro del radio permitido. | Solo del organismo asignado. `dev` solo lee reportes de desarrollo. | Todos los organismos y entornos. |
| **Cambiar reportes** | No. Puede enviar o cambiar su respuesta de confirmar/cuestionar mientras el reporte esté pendiente, si cumple las reglas de HU-04. | `dev`: reportes de desarrollo. `qa`: solo `pending` → `validated` o `rejected`. `po`: `pending` o `validated` → `approved` o `rejected`. | Cualquier campo y estado. |
| **Borrar reportes** | No. | No. | Sí. |
| **Usuarios y roles** | Sin acceso. | Sin acceso. | Gestión global. |
| **Organismos** | Solo lectura del organismo asignado. | Solo lectura del organismo asignado. | Gestión global. |
| **Proyectos** | Sin acceso. | `dev`: crear, leer y actualizar en desarrollo. `qa` y `po`: lectura dentro del organismo. | Gestión global. |
| **Mapas** | Lectura dentro del organismo asignado. | Lectura dentro del organismo asignado. | Acceso global. |
| **Configuración** | Sin acceso. | Sin acceso. | Gestión global. |

## Reglas de ámbito y datos

- Todo usuario que no sea `admin` necesita un `organizationId` asignado; si falta, las rutas protegidas por ámbito responden `403`.
- La API deriva `ownerId`, `organizationId`, entorno y estado inicial del reporte desde la identidad y las reglas del servidor. El cliente no puede elegirlos libremente.
- La respuesta de `/api/reports/nearby` contiene solo categoría, descripción, fecha, distancia aproximada, respuesta del usuario y contadores. No expone identidad del autor ni coordenadas exactas.
- El endpoint de cercanía es una excepción acotada a la lectura propia del ciudadano; no concede acceso a la ficha completa ni una lista global de reportes.
- Las respuestas por organismo están definidas en `backend/src/middleware/ability.ts`; el acceso ciudadano a reportes cercanos se limita en `backend/src/routes/reports.ts`.

## Estado de persistencia

Los endpoints administrativos de `/api/users` y `/api/organizations` cuentan con persistencia en SQLite mediante `AuthStore` (`backend/src/auth/store.ts`), incluyendo sincronización inmediata de cambios de rol o `organizationId` y revocación de sesiones activas. La gestión de reportes continúa manteniendo el estado de dominio conforme al modelo de reportes vigente.
