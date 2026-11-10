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
- **Backend**: Node.js, Express, TypeScript, Supertest, PostgreSQL + PostGIS
- **Mapas**: Leaflet + OpenStreetMap
- **CI**: Lint, pruebas y build en cada Pull Request.

## Comandos principales
- `npm install` – Instala dependencias de ambos paquetes.
- `npm run dev` – Inicia tanto frontend como backend en modo desarrollo.
- `npm run lint` – Lint de todo el monorepo.
- `npm test` – Ejecuta Vitest (frontend) y Supertest (backend).

## Documentación adicional
- [Roles y permisos (`docs/roles_acceso.md`)](docs/roles_acceso.md)
- [Reglas de validación de reportes (`docs/reglas_reportes.md`)](docs/reglas_reportes.md)
- [Diseño de creación de reportes (`docs/crear_reporte.md`)](docs/crear_reporte.md)
