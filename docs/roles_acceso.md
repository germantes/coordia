# Roles y permisos en COORDIA

Este documento define **qué operaciones** puede realizar cada **rol** dentro del proyecto y **sobre qué datos u organismos** tienen acceso.  Está pensado para ser usado por el equipo de desarrollo, QA y gestión de producto, y para servir de referencia al crear la configuración de autorización en la API.

---

## Tabla de roles

| Rol | Operaciones permitidas | Datos/Entidades accesibles | Comentarios |
|---|---|---|---|
| **Administrador** (admin) | • Crear, leer, actualizar y borrar cualquier recurso. <br>• Gestionar usuarios y asignar roles. <br>• Configurar la infraestructura (base de datos, CI/CD). | • Todos los **reportes** (`reports`). <br>• **Usuarios** (`users`). <br>• **Proyectos**, **zonas**, **configuración**. <br>• Acceso a **PostgreSQL**, **PostGIS**, **OpenStreetMap** (API externa). | Rol de máxima confianza. Se usa para despliegues y mantenimiento. |
| **Desarrollador** (dev) | • Crear, leer y actualizar código (frontend & backend). <br>• Ejecutar pruebas unitarias y de integración. <br>• Crear y modificar reportes de prueba. | • **Reportes** en modo *draft* (no publicados). <br>• **Entidades de dominio** (proyectos, zonas) en entorno de desarrollo. <br>• Acceso de lectura/escritura a la base de datos *dev*. | No puede borrar usuarios ni cambiar permisos de otros. |
| **Analista / QA** (qa) | • Leer todos los reportes. <br>• Cambiar estado de un reporte (p.ej., *pendiente ➜ validado*). <br>• Ejecutar pruebas automatizadas contra la API. | • **Reportes** (todos los estados). <br>• **Mapas** (consulta a OSM). <br>• **Logs** de aplicación. | No tiene permisos de escritura en la base de datos productiva, solo lectura. |
| **Product Owner** (po) | • Leer y comentar reportes. <br>• Aprobar o rechazar reportes según las reglas de negocio. <br>• Gestionar backlog en ClickUp (fuera del código). | • **Reportes** (solo lectura + *approval*). <br>• **Entidades de negocio** (proyectos, prioridades). | Puede cambiar el campo `status` del reporte a *approved*/*rejected* mediante la API. |
| **Usuario externo** (guest) | • Crear un nuevo reporte (vía UI). <br>• Ver sus propios reportes y su estado. | • **Reportes** creados por él/ella. <br>• **Datos de mapa** (consulta a OSM para visualización). | No ve ni modifica reportes de otros usuarios. |

---

## Matriz mínima implementada

La API centraliza la autorización en `backend/src/middleware/ability.ts`. Los ámbitos condicionados se evalúan sobre los atributos del recurso (`ownerId`, `organizationId`, `environment` y `status`); los endpoints de administración están en `/api/users` y `/api/organizations`.

| Rol | Reportes | Usuarios | Organismos | Proyectos / mapas |
|---|---|---|---|---|
| admin | CRUD global | CRUD global, incluido asignar rol | CRUD global | CRUD global |
| dev | Crear, leer y actualizar solo en desarrollo | Solo lectura | Solo lectura | Crear, leer y actualizar solo en desarrollo; mapas lectura |
| qa | Leer global; actualizar estados `pending` o `validated` | Sin acceso | Lectura | Lectura; mapas lectura |
| po | Leer global; actualizar estados `pending` o `validated`; no borrar | Sin acceso | Lectura | Lectura; mapas lectura |
| guest | Crear; leer solo reportes propios (`ownerId`) | Sin acceso | Lectura | Sin acceso; mapas lectura |

La matriz describe autorización, no persistencia: los endpoints de usuarios y organismos devuelven `501` hasta que se conecten sus repositorios. La API también depende de que cada reporte lleve los atributos de ámbito correspondientes. Las operaciones del admin sobre recursos no implementados quedan definidas en la política, pero no se exponen como funcionalidad persistente.

## Operaciones detalladas por recurso

| Recurso | Acción | Roles que pueden ejecutar | Reglas de negocio asociadas |
|---|---|---|---|
| **Reportes** (`/api/reports`) | **CREATE** | guest, dev | Validar según las *Reglas clave* (sección 1‑5 del documento `reglas_reportes.md`). |
|  | **READ** | admin, dev, qa, po, guest (solo sus propios) | Los usuarios solo pueden leer sus propios reportes; el resto tiene vista global. |
|  | **UPDATE** | admin, dev, po | Cambiar estado, añadir comentarios, actualizar datos. Debe pasar la validación de *criterios de aceptación*. |
|  | **DELETE** | admin | Sólo administradores pueden eliminar permanentemente. |
| **Usuarios** (`/api/users`) | **READ/UPDATE** | admin | Gestión de credenciales, asignación de roles. |
| **Mapas / Layers** | **READ** | admin, dev, qa, po, guest | Consulta a OpenStreetMap y a la tabla `spatial_layers` en PostGIS. |
| **Configuración** (CI/CD, .env) | **READ/WRITE** | admin | Sólo administradores pueden modificar variables de entorno y pipelines. |

---

## Acceso a organismos externos

| Organismo | Tipo de acceso | Roles que pueden usarlo |
|---|---|---|
| **PostgreSQL + PostGIS** | Conexión directa a base de datos (SQL) | admin (producción), dev (dev), qa (solo lectura) |
| **OpenStreetMap API** | GET de tiles y datos geojson | admin, dev, qa, po, guest (solo lectura) |
| **GitHub Actions** | Ejecutar CI/CD pipelines | admin (configuración) |

---

## Implementación práctica (ejemplo)

En el **backend** (`src/middleware/auth.ts`) se pueden mapear los roles a permisos usando *express‑jwt* y *casl*:
```ts
import { defineAbility } from '@casl/ability';

export function defineUserAbility(user) {
  const { role } = user;
  const { can, cannot, build } = new AbilityBuilder(Ability);

  if (role === 'admin') {
    can('manage', 'all');
  } else if (role === 'dev') {
    can(['create', 'read', 'update'], ['Report', 'Project']);
    cannot('delete', 'User');
  } else if (role === 'qa') {
    can('read', 'Report');
    can('update', 'Report', { status: { $in: ['pending', 'validated'] } });
  } else if (role === 'po') {
    can(['read', 'update'], 'Report');
    cannot(['delete'], 'Report');
  } else if (role === 'guest') {
    can('create', 'Report');
    can('read', 'Report', { ownerId: user.id });
  }

  return build();
}
```
Este ejemplo muestra cómo **centralizar** la lógica de autorización y poder añadir nuevas reglas de manera sencilla.

---

## Próximos pasos
1. **Revisar** este documento con el equipo de Seguridad y ajustarlo a cualquier normativa interna. 
2. **Implementar** la capa de autorización en el backend usando la tabla anterior como referencia. 
3. **Añadir** el markdown a la documentación del proyecto (`docs/roles_acceso.md`). 
4. **Crear tests** de autorización (Supertest) para asegurar que cada rol cumple sus límites.

> **Nota:** Este archivo está pensado para evolucionar. Cada cambio deberá abrirse en un Pull Request y seguir el proceso de revisión descrito en `reglas_reportes.md`.

