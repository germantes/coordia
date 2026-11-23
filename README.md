# COORDIA

Repositorio único para el proyecto COORDIA.

## Estructura del proyecto

```
coordia/
├─ frontend/            # React + TypeScript
├─ backend/             # Node.js + Express + TypeScript
├─ .github/workflows/   # GitHub Actions CI/CD
├─ README.md            # Este archivo
└─ package.json         # Scripts y dependencias comunes
```

## Tecnologías
- **Frontend**: React, TypeScript, Vite, Vitest, Playwright
- **Backend**: Node.js, Express, TypeScript, Vitest, SQLite embebido (demo/desarrollo local) y adaptador PostgreSQL + PostGIS (producción)
- **Mapas**: Leaflet + OpenStreetMap
- **CI**: Lint, pruebas automatizadas (102 tests) y build en cada Pull Request.

## Comandos principales
- `npm install` – Instala dependencias de todo el monorepo.
- `cp .env.example .env` – Configura variables de entorno para desarrollo local.
- `npm run dev` – Inicia tanto frontend como backend en modo desarrollo.
- `npm run lint` – Comprobación estática de tipos con `tsc --noEmit`.
- `npm test` – Ejecuta todas las suites de pruebas unitarias y de integración en Vitest.

## Apertura y Gobernanza (Práctica P9)
- [Plan de lanzamiento de código abierto (`docs/open-source-launch-plan.md`)](docs/open-source-launch-plan.md) – **Entregable conjunto**: Visión compartida (Act. 1), integración, roadmap, indicadores de salud (Act. 3) y evaluación de cierre (Act. 4).
- [Estrategia de código abierto (`open-source-strategy.md`)](open-source-strategy.md) – **Equipo A**: Objetivos, público, alcance y componentes reservados.
- [Preparación técnica para código abierto (`docs/technical-readiness.md`)](docs/technical-readiness.md) – **Equipo B**: Dependencias, secretos, licencias, CI y arquitectura de persistencia.
- [Preparación comunitaria (`docs/community-readiness.md`)](docs/community-readiness.md) – **Equipo C**: Licencia Apache 2.0, Código de Conducta y plantillas de colaboración.
- [Gobernanza y sostenibilidad (`docs/governance-and-sustainability.md`)](docs/governance-and-sustainability.md) – **Equipo D**: Comité de mantenedores, ciclo de vida de PRs y modelo de sostenibilidad.

## Documentación funcional y técnica adicional
- [Control del Sprint 2 (`docs/control/`)](docs/control/README.md)
- [Roles y permisos (`docs/roles_acceso.md`)](docs/roles_acceso.md)
- [Cuenta, validación y sesión (`docs/cuenta_sesion.md`)](docs/cuenta_sesion.md)
- [Reglas de validación de reportes (`docs/reglas_reportes.md`)](docs/reglas_reportes.md)
- [Diseño de creación de reportes (`docs/crear_reporte.md`)](docs/crear_reporte.md)
- [Reglas para confirmar o cuestionar reportes (`docs/confirmacion_reportes.md`)](docs/confirmacion_reportes.md)
