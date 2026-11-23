# technical-readiness.md (Equipo B) — COORDIA

Base: revisión en solo lectura del repo `germantes/coordia` (privado, rama por defecto) vía API de GitHub el 23-nov-2026. Nada se ha modificado.

## Qué se ha podido y no se ha podido ver
- Visto: README, `package.json` (raíz, backend, frontend), `ci.yml`, `.gitignore`, `database.ts`, `index.ts`, `middleware/auth.ts`, `routes/auth.ts`, `auth/password.ts`, `auth/store.ts`, índice de ~69 ficheros, 20 PRs.
- Verificado por el equipo el 23-nov-2026 (ejecución local): `gitleaks detect --log-opts="--all"` sobre 48 commits, sin fugas; `npm audit --omit=dev --audit-level=high` en la raíz, 0 vulnerabilidades.
- Licencias de producción (license-checker en `backend/` y `frontend/`): solo MIT, ISC y BSD-2; el único "UNLICENSED" es el propio paquete, por falta de `LICENSE`. `npm audit` completo: 0 vulnerabilidades.
- Builds: `frontend` compila (vite 8.3.7 resuelve, versión validada); `backend` compila con `tsc` desde la raíz tras `npm ci`.
- **Fallo confirmado**: tras `npm ci --omit=dev`, `npm start -w backend` falla con `ERR_MODULE_NOT_FOUND: jsonwebtoken` (importado en `dist/middleware/auth.js`). Una instalación de producción no arranca: hay dependencias de ejecución que solo están en devDependencies (`jsonwebtoken` y, según el análisis del código, `@casl/ability`). Acción: moverlas a `dependencies` y repetir la prueba.
- Ajustes de GitHub: creado el 23-nov un ruleset sobre `main` (PR obligatorio con 1 aprobación, sin force push ni borrado). Pendiente de añadir el job de CI como check obligatorio cuando haya corrido en un PR. Secret scanning de GitHub no disponible en el repo privado (no aparece en Advanced Security); se cubre con gitleaks en CI. Dependabot: se recomienda activarlo (Settings → Advanced Security); estado por confirmar.

## 1. Estructura
Monorepo npm workspaces: `frontend/` (React 18, Vite), `backend/` (Express 4, TypeScript), `docs/`, `.github/workflows/ci.yml`.
- Decisión: publicar `frontend`, `backend` y `docs/` técnicos (reglas de reportes, roles, confianza).
- Problema: `docs/control/` (registros y revisiones del Sprint 2) es gestión interna del curso y nombra a personas; `docs/test_edge_cases.py` es un prototipo suelto con nombre de test. Decisión: mover `docs/control/` fuera de la publicación y pasar el prototipo a `backend/tests/` o borrarlo.
- `.gitignore` menciona `docs-daniil/`: carpeta personal de un compañero. Hay que confirmar que nunca se subió (ver historial).
- Faltan `LICENSE`, `.env.example`, `SECURITY.md`, `CONTRIBUTING.md` (404 en la raíz).

## 2. Secretos y datos sensibles
- En el código leído no hay credenciales incrustadas. `.data/` (las bases SQLite con cuentas y sesiones) está en `.gitignore`.
- `middleware/auth.ts` usa `'insecure-dev-secret'` como valor por defecto de `JWT_SECRET` y solo lo exige si `NODE_ENV=production`. Quien despliegue sin esa variable firma tokens con un secreto público. Decisión: el arranque debe fallar siempre sin `JWT_SECRET` (también en dev, con `.env.example`).
- Hashes de contraseña Argon2id con salt y parámetros; refresh token en cookie `httpOnly`; límite de intentos por IP y email. Buenas decisiones, se mantienen.
- Historial: escaneado con gitleaks sobre todas las ramas (48 commits), sin fugas. Se mantiene la recomendación de añadir gitleaks a CI para que siga siendo así. Si apareciera algo en el futuro, rotar la credencial y reescribir historial.
- Los correos de usuarios de prueba/personas en `docs/control/` y tests deben revisarse (RGPD).

## 3. Dependencias y licencias
- `jsonwebtoken` está duplicado en `dependencies` y `devDependencies`; `leaflet` está en el backend sin usarse allí (solo frontend).
- `@casl/ability` está en `devDependencies` pero `middleware/ability.ts` lo importa en ejecución: una instalación de producción (`npm ci --omit=dev`) rompe el backend. Mover a `dependencies`.
- Versiones que conviene verificar antes de publicar (parecen inexistentes o muy nuevas para lo que aparece en el lockfile/README): `vitest ^5.1.0`, `vite ^8.3.7`, `tsx ^4.23.15`. Comprobar con `npm ls` que resuelven.
- Express 4 sigue soportado, pero sin plan de migración a 5.
- Licencias: sin analizar. Acción: `npx license-checker --production --summary` y comprobar que no hay GPL/AGPL incompatibles con la licencia elegida por el Equipo C. Leaflet (BSD-2) y OpenStreetMap (ODbL, atribución obligatoria en el mapa) deben citarse en el README.

## 4. Configuración
- Variables leídas del entorno: `JWT_SECRET`, `AUTH_DB_PATH`, `REPORT_DB_PATH`, `DISTRIBUTION_INTERVAL_MS`, `FRONTEND_ORIGIN`, `PORT`, `VITE_API_URL`. Ninguna está documentada.
- **README incoherente con el código**: dice PostgreSQL + PostGIS, pero `database.ts` usa `node:sqlite` (`DatabaseSync`), y `pg` figura como dependencia sin uso aparente. Un colaborador externo montaría Postgres para nada. Decisión: corregir README (SQLite para el MVP) o documentar la migración prevista.
- Requiere Node >=24.7 (`engines`, `crypto.argon2`, `node:sqlite` experimental). Documentarlo, es una barrera de entrada.
- README cita Playwright y no hay tests e2e en el repo.
- Hay una sola base de datos de ficheros sin migraciones versionadas (`CREATE TABLE IF NOT EXISTS`).

## 5. Tests, CI/CD y automatización
- Tests: ~15 en backend (Vitest + Supertest, incluidos criterios de aceptación HU-01/02/04/07) y 2 en frontend (`session`, `report-form`). El frontend usa `--passWithNoTests`, así que un fallo de cobertura no rompe nada.
- CI (`ci.yml`): lint (solo `tsc --noEmit`, aunque hay `eslint` instalado), test, build de ambos paquetes en PR y push a `main`.
- Carencias a cubrir: `actions/checkout@v3` y `setup-node@v3` obsoletos (subir a v4); sin `npm audit`, sin escaneo de secretos, sin Dependabot, sin informe de cobertura, sin permisos mínimos (`permissions: contents: read`); no consta protección de rama en `main` ni revisión obligatoria (no visible).
- Propuesta mínima: añadir job `security` (gitleaks + `npm audit --omit=dev --audit-level=high`), activar Dependabot, `permissions` de solo lectura y proteger `main` con CI obligatorio.

## Tres riesgos técnicos a resolver antes de publicar
1. **`JWT_SECRET` por defecto público y datos personales en `docs/control/`.** El historial está limpio según gitleaks (48 commits, todas las ramas). Impacto: sesiones falsificables en cualquier despliegue sin variable. Acción: fallar sin `JWT_SECRET`, `.env.example`, retirar `docs/control/` de la publicación. Responsable: Equipo B. Antes de publicar.
2. **Dependencias y build no reproducibles para un tercero.** `@casl/ability` en devDependencies rompe producción, hay paquetes duplicados o sin uso (`pg`, `leaflet` en backend) y versiones por validar. Además, licencias sin auditar. Acción: corregir `package.json`, `npm ls`, `license-checker`, probar `npm ci --omit=dev && npm run build && npm start` en limpio.
2b. **Confirmado: la instalación de producción no arranca** (`jsonwebtoken` ausente tras `npm ci --omit=dev`).
3. **Documentación técnica que contradice el código y barrera de arranque.** README promete PostgreSQL/PostGIS y Playwright, el código es SQLite sin migraciones y Node >=24.7, sin `.env.example`. Un contribuyente no puede levantar el proyecto con confianza. Acción: reescribir sección de instalación, documentar variables, probar el arranque desde cero en una máquina limpia.

## Primera tarea de mañana
Mover `jsonwebtoken` y `@casl/ability` a `dependencies`, repetir `npm ci --omit=dev && npm start -w backend` y anotar el resultado.
