# Community Readiness: Licencia, Documentación y Colaboración

> **Documento de preparación comunitaria y gobernanza abierta para el proyecto COORDIA**  
> **Versión**: 1.0  
> **Fecha**: 23 de noviembre de 2026  
> **Ámbito**: Repositorio `coordia` (Monorepo Frontend + Backend)  
> **Estado**: Propuesta formal del Equipo C para ratificación del equipo y partes interesadas.

---

## 1. Elección y Justificación de la Licencia

### 1.1 Contexto y requisitos de COORDIA
COORDIA es una plataforma cívica y de servicio público concebida para la gestión, geolocalización, validación comunitaria y despacho multiorganismo de incidentes urbanos y de emergencia. Participan en su ecosistema:
- **Ciudadanos** que notifican, confirman o cuestionan reportes cercanos.
- **Organismos públicos y servicios de emergencia** (policía local, bomberos, protección civil, servicios sanitarios, áreas de mantenimiento municipal) que reciben los avisos según su competencia y jurisdicción.
- **Terceros desarrolladores y comunidad tecnológica** que aportan extensiones, módulos de análisis o clientes alternativos.

Bajo este marco, la licencia seleccionada debe cumplir cuatro condiciones críticas:
1. **Fomentar la adopción institucional**: Las administraciones públicas (AAPP) y consorcios locales deben poder desplegar, integrar o auditar el software sin inseguridad jurídica ni temores a litigios sobre patentes.
2. **Compatibilidad técnica del stack**: El software combina frontend en React 18, Leaflet/OpenStreetMap, backend en Node.js/Express, TypeScript y PostgreSQL/PostGIS. Todas estas dependencias son código abierto permisivo o de dominio público compatible.
3. **Protección frente a patentes y marcas**: Garantizar que quien contribuya código otorgue licencia irrevocable de patentes a los usuarios, protegiendo al equipo mantenedor de patentes hostiles.
4. **Protección de la denominación e identidad**: Preservar el nombre *COORDIA* e impedir que entidades externas lo utilicen con fines de patrocinio o respaldo engañoso sin autorización.

---

### 1.2 Comparativa de licencias candidatas

| Criterio | MIT | GNU GPL v3 / AGPL v3 | Apache License 2.0 | EUPL v1.2 |
|---|---|---|---|---|
| **Tipo de licencia** | Permisiva minimalista | Copyleft fuerte / de red | Permisiva estructurada | Copyleft moderado europeo |
| **Cláusula de patentes** | No explícita (vacío legal) | Sí (explícita en v3) | **Sí (expresa y con rescisión ante litigio)** | Sí (incluida en el articulado) |
| **Protección de marcas** | No explícita | Limitada | **Explícita (reserva expresa de marcas)** | Implícita |
| **Adopción por AAPP y CAD** | Alta | Compleja (resistencia en compras públicas y CAD privados) | **Óptima (estándar internacional)** | Óptima en entorno UE |
| **Compatibilidad con stack** | Plena | Requiere análisis de vinculación | **Plena con npm, Leaflet y PostGIS** | Plena con compatibilidad inversa |
| **Trazabilidad de cambios** | No exige log de cambios | Exige documentar cambios | **Exige conservar avisos y cambios en ficheros** | Exige marcar modificaciones |

---

### 1.3 Decisión y justificación: Apache License 2.0

Se elige formalmente **Apache License 2.0** como la licencia oficial de COORDIA.

#### Razones de la elección:
1. **Concesión expresa de licencias de patentes (Sección 3)**: A diferencia de la licencia MIT tradicional, la Apache 2.0 otorga a cada usuario una licencia de patente perpetua, mundial y libre de regalías sobre cualquier contribución de código. Además, estipula una cláusula de terminación defensiva: si una entidad demanda a COORDIA o a sus usuarios por infracción de patentes, pierde automáticamente sus derechos de uso.
2. **Protección de marca registrada (Sección 6)**: Apache 2.0 prohíbe explícitamente usar los nombres comerciales, marcas o logotipos de los contribuyentes y del proyecto para patrocinio o propaganda. Esto salvaguarda la identidad institucional de COORDIA frente a usos comerciales indebidos.
3. **Flexibilidad para integración en centros de control y despacho (CAD/112)**: Muchos servicios de emergencias operan sistemas propietarios o híbridos. Una licencia de copyleft viral estricto (como AGPL v3) generaría fricciones legales en los pliegos de contratación pública y auditorías técnicas municipales. Apache 2.0 permite la integración limpia mediante APIs y adaptadores sin forzar a los organismos a liberar la totalidad de sus infraestructuras internas preexistentes.
4. **Trazabilidad y atribución (Sección 4)**: Requiere mantener las declaraciones de copyright originales y detallar si los archivos fuente han sido modificados, facilitando el cumplimiento de los estándares de auditoría de software de la Administración Pública.

*(Nota de compatibilidad: Si en el futuro un organismo de la Unión Europea exigiera específicamente la **European Union Public Licence (EUPL v1.2)**, ambas licencias son compatibles y pueden coexistir bajo régimen de doble licenciamiento o compatibilidad descendente según el Anexo de compatibilidad de la EUPL).*

---

## 2. Contenido Mínimo del README

El archivo `README.md` es la puerta de entrada para cualquier persona que clone o examine el proyecto. El README actual del repositorio contiene una base funcional pero incompleta para estándares comunitarios abiertos.

A continuación se definen los **11 bloques mínimos obligatorios** que debe contener el `README.md` estandarizado:

```markdown
# COORDIA — Plataforma Cívica de Coordinación y Reporte de Incidentes

[![CI Status](https://github.com/DVerdeV/Coordia/actions/workflows/ci.yml/badge.svg)](https://github.com/DVerdeV/Coordia/actions)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D24.7.0-brightgreen.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](tsconfig.json)

COORDIA es una plataforma modular de software libre diseñada para empoderar a la ciudadanía
y optimizar la respuesta de organismos de emergencia y mantenimiento urbano ante incidentes
geolocalizados, mediante validación participativa y derivación inteligente.

---

## Tabla de Contenidos
1. [Visión y Objetivos](#visión-y-objetivos)
2. [Características Principales](#características-principales)
3. [Arquitectura y Estructura del Monorepo](#arquitectura-y-estructura-del-monorepo)
4. [Prerrequisitos del Sistema](#prerrequisitos-del-sistema)
5. [Instalación y Configuración Local](#instalación-y-configuración-local)
6. [Ejecución en Desarrollo](#ejecución-en-desarrollo)
7. [Pruebas y Calidad de Código](#pruebas-y-calidad-de-código)
8. [Variables de Entorno](#variables-de-entorno)
9. [Documentación Técnica](#documentación-técnica)
10. [Contribución y Comunidad](#contribución-y-comunidad)
11. [Licencia y Contacto](#licencia-y-contacto)
```

### Especificación de cada sección:
1. **Encabezado y Badges**: Estado de la integración continua (GitHub Actions), licencia activa, versiones compatibles de Node.js y TypeScript.
2. **Visión y Objetivos**: Resumen ejecutivo del problema (descoordinación de alertas ciudadanas, duplicidad de llamadas, reportes falsos) y la solución que aporta COORDIA.
3. **Características Principales**:
   - Creación de incidentes con captura de coordenadas GPS y precisión métrica (HU-01/02).
   - Confirmación y cuestionamiento entre ciudadanos cercanos con mitigación de duplicados (HU-04).
   - Motor de evaluación de confianza y anti-abuso (HU-05).
   - Matriz de destinatarios y derivación a organismos competentes (HU-07).
   - Control de acceso por roles (RBAC: Ciudadano, Técnico, Calidad, PO, Admin) y aislamiento por organismo (HU-11).
4. **Estructura del Monorepo**: Mapa claro de directorios (`frontend/`, `backend/`, `docs/`, `.github/`).
5. **Prerrequisitos**:
   - Node.js versión `>= 24.7.0`.
   - Gestor de paquetes `npm` (compatible con workspaces).
   - PostgreSQL 15+ con extensión PostGIS (o base SQLite en memoria para tests y desarrollo rápido).
6. **Guía de Arranque Rápido (Quickstart)**:
   - Instrucciones exactas: `git clone`, `npm ci`, copia de `.env.example`, `npm run dev`.
7. **Pruebas y Calidad**:
   - `npm test`: Ejecución de pruebas unitarias y de integración (Vitest y Supertest).
   - `npm run lint`: Verificación estática con TypeScript y ESLint.
8. **Variables de Entorno**: Tabla exhaustiva con variables como `PORT`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN`, indicando valores por defecto seguros para desarrollo local.
9. **Documentación Adicional**: Enlaces indexados a los manuales en `docs/` (`roles_acceso.md`, `reglas_reportes.md`, `matriz_destinatarios.md`, etc.).
10. **Contribución y Código de Conducta**: Punteros a `CONTRIBUTING.md`, `community-readiness.md` y `CODE_OF_CONDUCT.md`.
11. **Licencia**: Mención explícita a la Licencia Apache 2.0.

---

## 3. Protocolo de Reporte de Bugs y Propuesta de Funcionalidades

Para asegurar un mantenimiento ordenado y accesible para contribuidores de cualquier nivel, se articula el sistema de incidencias a través de **GitHub Issues** con plantillas predefinidas en `.github/ISSUE_TEMPLATE/`.

### 3.1 Política de divulgación responsable de vulnerabilidades de seguridad
> [!CAUTION]
> **Seguridad y Privacidad**: Cualquier vulnerabilidad relacionada con fuga de coordenadas privadas de ciudadanos, escalada de privilegios entre organismos (HU-11) o pérdida de incidentes críticos **NUNCA** debe reportarse a través de un Issue público de GitHub.
> Debe enviarse mediante un **GitHub Private Vulnerability Report** en el repositorio o contactando confidencialmente a `security@coordia.org` (o al correo de los mantenedores). Se aplica un plazo de respuesta de 48 horas y embargo de 30 días hasta la publicación del parche.

---

### 3.2 Plantilla para Reporte de Bugs (`.github/ISSUE_TEMPLATE/bug_report.md`)

```markdown
---
name: Reporte de Bug
about: Informar de un error reproducible en la plataforma COORDIA
title: '[BUG] <Resumen claro del problema>'
labels: ['bug', 'triage']
assignees: ''
---

### Descripción del Bug
Una descripción clara y concisa de lo que sucede.

### Pasos para Reproducir
1. Iniciar sesión con el rol: `[guest | dev | qa | po | admin]`
2. Navegar a '...'
3. Realizar la acción '...'
4. Observar el error ocurrido.

### Comportamiento Esperado
Qué debería haber ocurrido de acuerdo con las especificaciones o criterios de aceptación.

### Capturas de Pantalla o Logs
Si aplica, adjunte capturas o el volcado de la consola / respuesta de la API (asegúrese de ocultar tokens o datos sensibles).

### Entorno
- **Componente**: [Frontend / Backend / Monorepo]
- **Navegador / SO**: [ej. Chromium 128, Ubuntu 24.04, Firefox 130]
- **Versión de Node**: [ej. 24.7.0]
- **Commit / Versión**: [ej. main @ 0aa44df]

### Severidad
- [ ] **Crítica / Urgente** (Impide el uso, compromete la seguridad, integridad o entrega de alertas urgentes)
- [ ] **Normal** (Fallo funcional con alternativa o en flujo secundario)
- [ ] **Menor / Visual** (Inconsistencia estética o de texto sin pérdida funcional)
```

---

### 3.3 Plantilla para Solicitud de Funcionalidades (`.github/ISSUE_TEMPLATE/feature_request.md`)

```markdown
---
name: Propuesta de Funcionalidad
about: Sugerir una idea o mejora para el proyecto COORDIA
title: '[FEATURE] <Título descriptivo de la propuesta>'
labels: ['enhancement', 'triage']
assignees: ''
---

### Problema o Necesidad
¿Qué limitación o problema resuelve esta funcionalidad?
> *Ejemplo: Como [rol de usuario], necesito [acción/capacidad] para [objetivo/beneficio].*

### Solución Propuesta
Descripción detallada de la funcionalidad sugerida, componentes afectados y flujo de usuario.

### Impacto en Módulos Existentes
Marque los módulos que se verían modificados o afectados:
- [ ] Creación y Georreferenciación de Reportes (HU-01 / HU-02)
- [ ] Confirmación / Detección de Duplicados (HU-04)
- [ ] Motor de Confianza y Calificación (HU-05)
- [ ] Matriz de Destinatarios y Envío a Organismos (HU-07)
- [ ] Roles, Autenticación y Administración (HU-11)
- [ ] Base de datos / Modelo de almacenamiento
- [ ] Interfaz de Usuario (Frontend)

### Criterios de Aceptación Preliminares
1. Dado que... cuando... entonces...
2. ...

### Alternativas Consideradas
¿Se han valorado otras soluciones o herramientas existentes?
```

---

### 3.4 Flujo de estados y etiquetado (Triage)
Las incidencias siguen un ciclo de vida transparente:
1. `triage`: Recién creada; el equipo revisa completitud en un máximo de 2 días laborables.
2. `needs-info`: Se solicita más información al autor. Si no hay respuesta en 7 días, se cierra temporalmente.
3. `accepted`: Aprobada para desarrollo; se añaden etiquetas de ámbito (`domain:frontend`, `domain:backend`, `domain:docs`) y prioridad.
4. `good first issue` / `help wanted`: Tareas catalogadas para nuevos contribuyentes o colaboración comunitaria.
5. `in-progress`: Rama o PR activa vinculada al issue.
6. `resolved`: Cerrada tras merge de la PR correspondiente.

---

## 4. Normas para Pull Requests (PR Guidelines)

Para salvaguardar la robustez del código y mantener el principio ágil de COORDIA (**"nadie aprueba su propio trabajo; toda integración requiere revisión independiente"**), toda contribución debe ajustarse a las siguientes normas:

### 4.1 Estrategia de Ramas
- La rama base y protegida es `main`. Ningún desarrollador puede hacer `push` directo a `main`.
- Toda aportación debe nacer de una rama temática derivada del último estado de `main`:
  - `feature/<issue-id>-<descripcion-corta>` (para nuevas funcionalidades)
  - `fix/<issue-id>-<descripcion-corta>` (para corrección de bugs)
  - `docs/<descripcion-corta>` (para mejoras en documentación)
  - `test/<descripcion-corta>` (para ampliación o aislamiento de pruebas)

### 4.2 Convención de Commits (Conventional Commits)
Los mensajes de commit deben seguir el estándar `tipo(alcance): descripción breve en imperativo`:
- `feat(reports)`: Nueva funcionalidad en el sistema de reportes.
- `fix(auth)`: Corrección de un fallo en autenticación o sesiones.
- `test(hu04)`: Adición o refactorización de casos de prueba.
- `docs(api)`: Modificación de especificaciones o documentación.
- `refactor(backend)`: Mejora interna sin cambio de comportamiento externo.

### 4.3 Requisitos obligatorios para la aceptación de una PR (Definition of Done)
Antes de solicitar revisión, el autor debe verificar:
1. **Compilación y Linters limpios**: `npm run lint` no produce errores ni advertencias (`tsc --noEmit` exitoso en frontend y backend).
2. **Suite de Pruebas en verde**: `npm test` ejecuta todos los tests unitarios y de integración satisfactoriamente (incluyendo el aislamiento de base de datos en memoria para evitar colisiones).
3. **Nuevas Pruebas Aportadas**: Si se añade funcionalidad o se corrige un bug, es **obligatorio** incluir pruebas automatizadas en Vitest que validen el cambio y prevengan regresiones.
4. **No degradación de arquitectura**: Respetar el aislamiento de organismos (`organizationId`), los permisos CASL definidos en `roles_acceso.md` y los contratos OpenAPI.
5. **Documentación sincronizada**: Si se modifica un endpoint, variable de entorno o contrato de datos, se deben actualizar los ficheros relevantes en `docs/`.

### 4.4 Plantilla de Pull Request (`.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## Resumen del Cambio
Descripción clara de qué aporta esta PR y qué problema resuelve.

Closes #<número-de-issue>

## Tipo de Cambio
- [ ] Corrección de bug (fix sin rotura de API)
- [ ] Nueva funcionalidad (feat sin rotura de API)
- [ ] Cambio mayor / rotura de compatibilidad (breaking change)
- [ ] Mejora de documentación o tests

## Lista de Verificación (Checklist)
- [ ] He ejecutado `npm run lint` y pasa sin errores.
- [ ] He ejecutado `npm test` y todos los tests pasan en local.
- [ ] He añadido pruebas que cubren las nuevas líneas y casos límite.
- [ ] He actualizado la documentación pertinente en `docs/` o `README.md`.
- [ ] El código respeta el principio de menor privilegio y aislamiento por organismo.

## Notas para el Revisor
Detalles sobre cómo probar el cambio, casos frontera comprobados o decisiones de diseño destacables.
```

### 4.5 Política de Code Review
- Se requiere la aprobación explícita de al menos **1 revisor independiente**. En cambios que afecten a seguridad, roles (`ability.ts`) o despacho de emergencias se requerirán **2 aprobaciones**.
- Las revisiones deben centrarse en: corrección lógica, legibilidad, seguridad, cobertura de tests y adhesión a los criterios de aceptación de la historia de usuario.
- El merge se realiza mediante **Squash and Merge** para mantener un histórico de `main` conciso y trazable.

---

## 5. Código de Conducta (Code of Conduct)

COORDIA adopta íntegramente el **Contributor Covenant versión 2.1**, adaptado a los canales de comunicación, repositorios y grupos de trabajo del proyecto.

### 5.1 Nuestro Compromiso
Como miembros, colaboradores y mantenedores de COORDIA, nos comprometemos a hacer de la participación en nuestra comunidad una experiencia libre de acoso para todos, independientemente de la edad, dimensión corporal, discapacidad visible o no visible, etnicidad, características sexuales, identidad y expresión de género, nivel de experiencia, educación, estatus socioeconómico, nacionalidad, apariencia personal, raza, religión o identidad y orientación sexual.

Nos comprometemos a actuar e interactuar de maneras que contribuyan a una comunidad abierta, acogedora, diversa, inclusiva y saludable.

### 5.2 Estándares de Conducta

#### Comportamientos que contribuyen a un entorno positivo:
- Demostrar empatía y amabilidad hacia otras personas.
- Respetar los diferentes puntos de vista, experiencias y niveles de conocimiento técnico.
- Dar y recibir retroalimentación constructiva de manera profesional y elegante.
- Aceptar la responsabilidad y pedir disculpas con sinceridad cuando se cometen errores, aprendiendo de la experiencia.
- Centrarse en lo que es mejor no solo para nosotros individualmente, sino para la comunidad y el fin social de la plataforma.

#### Comportamientos inaceptables:
- El uso de lenguaje o imágenes de connotación sexual, aproximaciones o atenciones sexuales no deseadas.
- El trolleo, comentarios insultantes o despectivos, y los ataques personales o políticos.
- El acoso público o privado, humillación o intimidación.
- Publicar información privada de otras personas (como direcciones físicas o electrónicas, coordenadas personales) sin su consentimiento explícito (*doxxing*).
- Cualquier otra conducta que razonablemente pueda considerarse inapropiada en un entorno profesional o comunitario.

### 5.3 Aplicación y Responsabilidades de los Mantenedores
Los mantenedores del proyecto son responsables de aclarar y hacer cumplir los estándares de conducta aceptable y tomarán medidas correctivas justas y proporcionadas ante cualquier comportamiento que consideren inapropiado, amenazante, ofensivo o dañino.

Tienen el derecho y la responsabilidad de eliminar, editar o rechazar comentarios, commits, código, ediciones de wiki, issues y otras contribuciones que no se alineen con este Código de Conducta.

### 5.4 Procedimiento de Denuncia y Gradación de Medidas

Cualquier infracción puede ser denunciada de manera confidencial contactando al comité de conducta o a los mantenedores responsables a través de `conduct@coordia.org` o en privado al responsable designado. Todas las quejas serán revisadas e investigadas de manera justa y confidencial.

En caso de vulneración, los mantenedores aplicarán las siguientes directrices de resolución:

1. **Corrección**:
   - *Impacto*: Uso de lenguaje inapropiado u otra conducta considerada poco profesional.
   - *Consecuencia*: Advertencia privada y solicitud de modificación o disculpa.
2. **Aviso formal**:
   - *Impacto*: Violación de estándares mediante un único incidente o comportamiento continuado.
   - *Consecuencia*: Aviso formal con explicación de las consecuencias de la reincidencia.
3. **Suspensión temporal**:
   - *Impacto*: Violación grave de estándares comunitarios, incluyendo acoso persistente.
   - *Consecuencia*: Suspensión temporal de cualquier interacción o comunicación en los repositorios y canales del proyecto por un período determinado.
4. **Expulsión permanente**:
   - *Impacto*: Demostración de un patrón de violación de estándares, acoso sistemático, agresión o discriminación hacia grupos protegidos.
   - *Consecuencia*: Prohibición permanente de acceso a cualquier canal o repositorio del proyecto.

---

## 6. Tres Tareas Adecuadas como "Good First Issue"

Para facilitar la incorporación de nuevos colaboradores al proyecto COORDIA, se han identificado tres tareas acotadas, de bajo riesgo arquitectónico, con valor funcional real y con límites bien definidos.

---

### Issue 1: [FRONTEND] Indicador de coordenadas y animación visual en el selector de mapa

- **Etiquetas**: `good first issue`, `domain:frontend`, `ui/ux`, `help wanted`
- **Componente**: `frontend/src/LocationPicker.tsx` y `frontend/src/styles.css`
- **Estimación orientativa**: 2–3 horas

#### Contexto y Necesidad:
Actualmente, el componente `LocationPicker.tsx` permite al usuario hacer clic sobre el mapa Leaflet para fijar la ubicación del reporte. Sin embargo, no hay una indicación textual inmediata de las coordenadas seleccionadas ni un feedback visual de confirmación, lo que genera dudas al usuario sobre si el clic fue registrado con precisión.

#### Tareas a Desarrollar:
1. Añadir debajo del contenedor del mapa un bloque informativo que muestre las coordenadas activas con formato legible: `Latitud: XX.XXXXX, Longitud: YY.YYYYY` (redondeadas a 5 decimales para precisión de ~1 metro).
2. Si no hay ubicación seleccionada (`value === null`), mostrar el mensaje amigable: *"Haz clic sobre el mapa para señalar la ubicación exacta del incidente"*.
3. Incorporar un botón sutil *"Restablecer ubicación"* que limpie el marcador actual permitiendo volver a elegir.
4. Añadir una animación CSS sencilla (`pulse` o rebote suave) sobre el icono del marcador cuando se actualiza la posición.

#### Criterios de Aceptación:
- Al hacer clic en cualquier punto del mapa, las coordenadas en pantalla se actualizan de inmediato.
- El diseño es totalmente responsivo y respeta la paleta CSS global existente.
- Se añade un test unitario en `frontend/` (con Vitest / React Testing Library) que compruebe la renderización del texto de coordenadas al recibir props.

---

### Issue 2: [BACKEND] Validación estricta de longitud y limpieza de espacios en la descripción del reporte

- **Etiquetas**: `good first issue`, `domain:backend`, `validation`, `help wanted`
- **Componente**: `backend/src/validation/report.ts` y `backend/tests/report-validation.test.ts`
- **Estimación orientativa**: 2–3 horas

#### Contexto y Necesidad:
En `backend/src/validation/report.ts`, la función `validateCreateReport` valida la categoría y la existencia del objeto de localización, pero la validación del texto de la descripción es rudimentaria. Para evitar reportes vacíos, spam o descripciones kilométricas que saturen el backend, se necesita una validación robusta con límites bien definidos.

#### Tareas a Desarrollar:
1. Normalizar el campo `description` aplicando `trim()` para eliminar espacios en blanco redundantes al inicio y final.
2. Comprobar longitud mínima y máxima:
   - Longitud mínima: al menos **10 caracteres** significativos (sin contar espacios vacíos).
   - Longitud máxima: máximo **2000 caracteres**.
3. Si la descripción no cumple los requisitos, devolver el error descriptivo en el objeto `errors`:
   - Menor a 10 caracteres: `"La descripción debe contener al menos 10 caracteres descriptivos del incidente"`.
   - Mayor a 2000 caracteres: `"La descripción no puede superar los 2000 caracteres"`.
4. Sanitizar posibles caracteres de control no imprimibles en el cuerpo del texto.

#### Criterios de Aceptación:
- Un reporte con descripción `"   hola   "` es rechazado con error de validación claro.
- Un reporte con una descripción válida de entre 10 y 2000 caracteres es aceptado y saneado.
- Se amplía la suite en `backend/tests/report-validation.test.ts` con al menos 4 casos de prueba (caso límite inferior, superior, espacios vacíos y caso nominal).

---

### Issue 3: [DX / API] Endpoint de comprobación de salud (`GET /api/health`) con estado y versión

- **Etiquetas**: `good first issue`, `domain:backend`, `api`, `dx`
- **Componente**: `backend/src/routes/` y `backend/src/index.ts`
- **Estimación orientativa**: 2 horas

#### Contexto y Necesidad:
Actualmente el servidor Express arranca y expone rutas bajo `/api/auth`, `/api/reports` y `/api/admin`, pero no existe un endpoint de comprobación de salud (*healthcheck*) ligero y sin autenticación. Este endpoint es esencial para monitorización, sondas de despliegue en Kubernetes/Docker y comprobaciones rápidas de conectividad desde el frontend o scripts de mantenimiento.

#### Tareas a Desarrollar:
1. Crear una ruta pública `GET /api/health` en Express que no requiera cabeceras de autorización.
2. Devolver una respuesta JSON con código `200 OK` y el siguiente esquema:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-11-23T14:30:00.000Z",
     "uptimeSeconds": 142.5,
     "version": "0.1.0",
     "environment": "development"
   }
   ```
3. Registrar la ruta en el router principal de la aplicación.
4. Crear un archivo de prueba `backend/tests/health-route.test.ts` utilizando Supertest y Vitest.

#### Criterios de Aceptación:
- Una petición `curl -i http://localhost:3000/api/health` devuelve `HTTP/1.1 200 OK` y cabecera `Content-Type: application/json`.
- El campo `timestamp` es una fecha ISO-8601 válida y `uptimeSeconds` es un número positivo creciente.
- La suite de pruebas de backend pasa al 100% con la nueva prueba añadida.

---

## 7. Plan de Adopción e Integración en el Repositorio

Para llevar a la práctica las decisiones de este documento en el repositorio `coordia`, se seguirá la siguiente hoja de ruta de implementación:

1. **Creación del fichero de licencia**:
   - Añadir [`LICENSE`](file:///home/ubuntu/projects/coordia/LICENSE) en la raíz del proyecto conteniendo el texto íntegro oficial de la **Apache License 2.0**.
2. **Plantillas de colaboración en GitHub**:
   - Crear el directorio [`.github/ISSUE_TEMPLATE/`](file:///home/ubuntu/projects/coordia/.github/ISSUE_TEMPLATE/) con `bug_report.md` y `feature_request.md`.
   - Crear [`.github/PULL_REQUEST_TEMPLATE.md`](file:///home/ubuntu/projects/coordia/.github/PULL_REQUEST_TEMPLATE.md) con la lista de comprobación de DoD.
3. **Políticas comunitarias**:
   - Crear [`CODE_OF_CONDUCT.md`](file:///home/ubuntu/projects/coordia/CODE_OF_CONDUCT.md) con el texto del Contributor Covenant 2.1.
   - Crear [`CONTRIBUTING.md`](file:///home/ubuntu/projects/coordia/CONTRIBUTING.md) resumiendo las normas de PRs y convenciones de código.
4. **Actualización del README**:
   - Incorporar en [`README.md`](file:///home/ubuntu/projects/coordia/README.md) la estructura completa, badges y enlaces directos a este documento y a las guías de colaboración.
