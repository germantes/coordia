# COORDIA · Preparación Técnica para Código Abierto

**Equipo B · Preparación técnica**

> **Documento de auditoría técnica, seguridad de secretos, dependencias y reproducibilidad**  
> **Versión**: 1.0  
> **Fecha**: 23 de noviembre de 2026  
> **Ámbito**: Monorepo `coordia` (`frontend/`, `backend/`, `.github/`)

---

## 1. Auditoría de Dependencias y Compatibilidad de Licencias

Se ha analizado el árbol completo de dependencias en `backend/package.json` y `frontend/package.json`, asegurando que todas cuenten con versiones bloqueadas en [`package-lock.json`](file:///home/ubuntu/projects/coordia/package-lock.json) y licencias compatibles con **Apache License 2.0**:

| Paquete | Versión declarada | Licencia upstream | Compatibilidad con Apache 2.0 | Uso en COORDIA |
|---|---|---|---|---|
| `express` | `^4.18.2` | MIT | Plena | Servidor HTTP y enrutamiento REST en backend |
| `react` / `react-dom` | `^18.2.0` | MIT | Plena | Biblioteca de interfaz de usuario en frontend |
| `leaflet` | `^1.9.4` | BSD-2-Clause | Plena | Visualización de mapas y posicionamiento de incidentes |
| `@casl/ability` | `^6.5.0` | MIT | Plena | Motor de control de acceso basado en atributos y roles (RBAC) |
| `jsonwebtoken` | `^9.0.2` | MIT | Plena | Emisión y validación de tokens de sesión |
| `pg` | `^8.11.3` | MIT | Plena | Cliente para PostgreSQL / PostGIS |
| `cors` | `^2.8.2` | MIT | Plena | Middleware de seguridad de orígenes cruzados |
| `typescript` | `^5.3.3` | Apache-2.0 | Idéntica | Compilación y comprobación estática de tipos |
| `vite` | `^8.3.7` | MIT | Plena | Empaquetado y servidor de desarrollo en frontend |
| `vitest` | `^5.1.0` | MIT | Plena | Ejecutor de pruebas unitarias y de integración |

### Acciones técnicas tomadas:
- No se han detectado dependencias bajo licencias copyleft hostiles (GPL/AGPL) que restrinjan la distribución permisiva.
- El repositorio mantiene el fichero [`package-lock.json`](file:///home/ubuntu/projects/coordia/package-lock.json) versionado en Git para garantizar compilaciones e instalaciones deterministas con `npm ci`.

---

## 2. Gestión de Secretos, Credenciales y Ficheros Ignorados

### 2.1 Verificación de secretos en el código
- Se ha comprobado que el código base no incluye contraseñas, claves privadas de producción ni tokens fijos.
- La configuración sensible se carga dinámicamente mediante variables de entorno:
  - `JWT_SECRET`: En desarrollo local utiliza un valor por defecto inocuo (`coordia-dev-secret-do-not-use-in-production`). En producción, la aplicación exige su definición explícita.
  - `DATABASE_URL` y `PORT`: Configurables mediante variables de entorno estándar.

### 2.2 Política de `.gitignore` y ficheros de entorno
El archivo [`.gitignore`](file:///home/ubuntu/projects/coordia/.gitignore) salvaguarda la exclusión de ficheros críticos:
- Archivos `.env` y `.env.*` locales.
- Directorio de almacenamiento de datos `.data/` y ficheros `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`.
- Directorios `node_modules/`, `dist/` y `.vitest-cache/`.

### 2.3 Plantilla de entorno para colaboradores
Se incluye un fichero modelo [`.env.example`](file:///home/ubuntu/projects/coordia/.env.example) que permite arrancar el entorno en 1 paso sin exponer credenciales:
```bash
# Servidor Backend
PORT=3000
NODE_ENV=development
JWT_SECRET=coordia-dev-secret-local-only-replace-in-prod
CORS_ORIGIN=http://localhost:5173

# Base de datos (opcional para SQLite local; por defecto usa .data/coordia.sqlite)
DATABASE_URL=sqlite:.data/coordia.sqlite
```

---

## 3. Arquitectura de Ejecución y Desacoplamiento de Persistencia

### 3.1 Situación actual vs. Documentación heredada
Existe una incoherencia histórica en la documentación que queda subsanada en esta publicación:
- **Lo que decía el README preliminar**: Mencionaba instalación obligatoria de PostgreSQL y PostGIS.
- **La realidad técnica del código en `main`**:
  - El backend implementa autenticación, cuentas, contraseñas hash y organizaciones en **SQLite** mediante [`backend/src/auth/store.ts`](file:///home/ubuntu/projects/coordia/backend/src/auth/store.ts).
  - El almacén de reportes, confirmaciones y órdenes de distribución ([`backend/src/models/report.ts`](file:///home/ubuntu/projects/coordia/backend/src/models/report.ts)) también cuenta con persistencia transaccional en **SQLite** (`PRAGMA journal_mode = WAL; busy_timeout = 5000;`).
  - Los cálculos geométricos de distancia y proximidad métrica se resuelven mediante fórmulas haversine nativas en TypeScript en [`backend/src/validation/report-response.ts`](file:///home/ubuntu/projects/coordia/backend/src/validation/report-response.ts), haciendo que la demo local y las pruebas no dependan del cluster PostgreSQL/PostGIS.

### 3.2 Decisión técnica para la primera release (v0.1.0-alpha)
1. **Publicar con motor SQLite embebido**: Permite a cualquier evaluador o desarrollador externo arrancar la plataforma en 1 comando (`npm run dev`) sin desplegar dependencias externas pesadas.
2. **Clarificación explícita en el README**: Dejar documentado que la suite local opera con SQLite embebido (`.data/auth.sqlite` y `.data/reports.sqlite`) y que PostgreSQL + PostGIS constituye la ruta de migración para despliegues de alta concurrencia multiorganismo.

---

## 4. Calidad, Automatización y Pipeline de CI

### 4.1 Entorno de ejecución
- **Node.js**: Motor fijado en `engines: { "node": ">=24.7.0" }`.
- **Monorepo**: Gestión mediante `npm workspaces` nativo (`npm run lint`, `npm test`, `npm run dev`).

### 4.2 Pipeline de Integración Continua ([`.github/workflows/ci.yml`](file:///home/ubuntu/projects/coordia/.github/workflows/ci.yml))
En cada Pull Request y push a `main`, el flujo ejecuta automáticamente:
1. `npm ci --include-workspace-root`
2. `npm run lint` (verificación de tipado estricto con `tsc --noEmit` en frontend y backend).
3. `npm test` (ejecución de las 13 suites y 102 pruebas en Vitest).
4. `npm run build --workspace=frontend` y `npm run build --workspace=backend`.

### 4.3 Aislamiento de pruebas
Para evitar colisiones de concurrencia y bloqueos de base de datos (*"database is locked"*), cada suite de pruebas unitarias (`hu04-acceptance.test.ts`, etc.) instancia almacenes de base de datos aislados en memoria efímera que se destruyen al finalizar.

---

## 5. Riesgos Técnicos y Plan de Mitigación

| Riesgo Técnico | Severidad | Mitigación Implementada / Planificada |
|---|---|---|
| **Discrepancia documental PostgreSQL vs SQLite** | Media | Documentado claramente en el README y `.env.example`. La demo local funciona inmediatamente sin infraestructura externa. |
| **Incompatibilidad de versión de Node** (errores de sintaxis si se usa Node < 24) | Alta | Declaración de `engines` en `package.json` y runner de CI fijo en Node 24. |
| **Colisiones de bloqueo en SQLite** bajo concurrencia elevada | Media | Activación de WAL mode (`PRAGMA journal_mode = WAL`) y timeout de 5s. Para producción multiciudad se migrará al adaptador PostgreSQL. |
| **Fuga de datos personales en logs o errores** | Crítica | El middleware de manejo de errores captura excepciones y devuelve mensajes sanitizados sin volcados de traza ni datos sensibles de ciudadanos. |
