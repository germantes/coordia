# COORDIA · Plan de Lanzamiento de Código Abierto (Open Source Launch Plan)

> **Documento común e integrado de todo el equipo COORDIA (Equipos A, B, C y D)**  
> **Práctica P9: Apertura y Gobernanza de Proyectos de Software**  
> **Fecha**: 23 de noviembre de 2026  
> **Estado**: Plan común acordado y ratificado por el conjunto del equipo.

---

## Índice
1. [Actividad 1: Análisis Inicial y Visión Compartida del Proyecto](#1-actividad-1-análisis-inicial-y-visión-compartida-del-proyecto)
2. [Actividad 3: Integración y Plan de Lanzamiento](#2-actividad-3-integración-y-plan-de-lanzamiento)
   - 2.1 [Detección y Corrección de Incoherencias entre Entregables](#21-detección-y-corrección-de-incoherencias-entre-entregables)
   - 2.2 [Roadmap de Apertura](#22-roadmap-de-apertura)
   - 2.3 [Indicadores de Salud del Proyecto](#23-indicadores-de-salud-del-proyecto)
3. [Actividad 4: Cierre y Preguntas Clave](#3-actividad-4-cierre-y-preguntas-clave)
4. [Índice de Entregables Relacionados](#4-índice-de-entregables-relacionados)

---

## 1. Actividad 1: Análisis Inicial y Visión Compartida del Proyecto

Tras el análisis conjunto del proyecto, el equipo consensúa la siguiente visión unificada respecto a la apertura del software:

### 1.1 ¿Por qué queremos abrir el proyecto?
1. **Transparencia en el servicio público**: Los sistemas que gestionan avisos ciudadanos y emergencias urbanas no deben ser cajas negras. Abrir el código permite auditar cómo se valoran las incidencias, cómo funciona el motor de confianza (HU-05) y con qué criterios se derivan avisos a los organismos públicos (HU-07).
2. **Reutilización y soberanía tecnológica municipal**: Los ayuntamientos y entidades locales a menudo carecen de presupuesto para adquirir licencias privativas complejas. Abrir COORDIA permite que cualquier comunidad adapte la herramienta a su catálogo de incidencias y mapas locales.
3. **Validación comunitaria y co-creación**: La colaboración abierta permite recibir mejoras en accesibilidad web, traducción a lenguas cooficiales, afinamiento de la heurística de duplicados (HU-04) y extensiones cartográficas con OpenStreetMap.

### 1.2 ¿Qué tipo de comunidad o colaboradores queremos atraer?
- **Desarrolladores de tecnología cívica (*Civic Tech*) y comunidad OpenStreetMap / GIS**: Para optimizar el renderizado de mapas Leaflet, la precisión en geolocalización y el rendimiento cartográfico.
- **Técnicos de administraciones locales y servicios de protección civil**: Para validar flujos de trabajo operativos reales, categorización de incidentes y protocolos de despacho.
- **Perfiles de Calidad (QA), Seguridad y Accesibilidad**: Para probar casos límite en dispositivos móviles, contrastar pautas WCAG y auditar el aislamiento de permisos por organismo (HU-11).
- **Nuevos colaboradores en formación**: Estudiantes y desarrolladores que busquen un entorno bien documentado, con pruebas automáticas y tareas etiquetadas para iniciarse en proyectos de impacto social.

### 1.3 ¿Qué partes del proyecto se publicarán y cuáles deberían quedar fuera?
| Ámbito | Componentes que se publican | Componentes que quedan fuera (privados) |
|---|---|---|
| **Frontend** | Código React 18, componentes Leaflet, formularios y estilos CSS. Pruebas unitarias de interfaz. | Credenciales de mapas de pago o claves privadas de servicios de terceros. |
| **Backend** | Código de la API Express, modelos de dominio, validaciones, control de acceso CASL y suites de pruebas en Vitest. | Claves maestras (`JWT_SECRET` de producción), certificados TLS y configuraciones de despliegue en servidores reales. |
| **Datos** | Datos semilla ficticios (*seed data*), catálogo genérico de organismos simulados y escenarios de prueba. | **Bases de datos de usuarios reales**, registros de incidentes de personas reales, coordenadas de viviendas y copias de seguridad. |
| **Documentación** | Guías técnicas, contratos OpenAPI, roles, reglas de negocio públicas, plantillas de PR e issues y Código de Conducta. | Actas internas académicas, tableros de control de esfuerzo (`docs/control/`), matrices telefónicas operativas y agendas del equipo. |

### 1.4 ¿En qué estado de madurez se encuentra el proyecto?
- **Fase actual**: **Prototipo funcional / Alfa técnico (`v0.1.0-alpha`)**.
- **Lo que funciona y está validado**: Autenticación y roles (HU-01), formulario de reporte geolocalizado con precisión métrica (HU-02), confirmación y cuestionamiento con filtrado de proximidad y reglas de duplicados (HU-04), motor de confianza y penalizaciones (HU-05), matriz de destinatarios y control de entregas por organismo (HU-07), y administración de cuentas por organismo (HU-11). La persistencia transaccional en SQLite está implementada tanto para cuentas como para reportes y respuestas. La suite completa de 13 suites y 102 pruebas automatizadas pasa en verde en CI.
- **Limitaciones pendientes antes de producción**: Las notificaciones y despachos a organismos son simuladas internamente (sin conectores telemáticos con centrales 112/Policía reales) y la interfaz de usuario requiere un empaquetado Docker completo.

### 1.5 ¿Qué dificultades podría encontrar una persona externa que quisiera utilizarlo o contribuir?
1. **Pila técnica moderna**: Requiere Node.js `>= 24.7.0` (por soporte nativo de APIs modernas y TypeScript ESM).
2. **Desajuste documental inicial**: La documentación preliminar mencionaba la necesidad de un servidor PostgreSQL + PostGIS, mientras que la versión local corre autónomamente sobre SQLite (`.data/auth.sqlite` y `.data/reports.sqlite`). (Se resuelve clarificándolo en la guía de instalación y `.env.example`).
3. **Lógica de dominio específica**: Comprender el modelo de permisos multiorganismo (`organizationId` en CASL) y la fórmula de proximidad espacial requiere leer con atención la documentación de arquitectura.

---

## 2. Actividad 3: Integración y Plan de Lanzamiento

### 2.1 Detección y Corrección de Incoherencias entre Entregables

Al integrar los entregables de los cuatro sub-equipos, se detectaron las siguientes discrepancias, acordándose su resolución unificada:

| Elemento | Entregable A (`strategy`) | Entregable B (`technical`) | Entregable C (`community`) | Entregable D (`governance`) | **Acuerdo / Resolución común** |
|---|---|---|---|---|---|
| **Licencia del software** | Postergaba la elección al consenso del equipo. | Asumía compatibilidad con licencias permisivas. | Elegía y justificaba formalmente **Apache License 2.0**. | Delegaba en la licencia acordada para el proyecto. | **Unificación en Apache License 2.0**: Concede derechos explícitos de patentes, protege la marca COORDIA y permite adopción en administraciones públicas. |
| **Requisitos de base de datos** | Señalaba la contradicción entre PostgreSQL y SQLite. | Clarificaba que la v0.1.0 usa SQLite en cuentas y memoria en reportes. | Exponía comandos generales de desarrollo en monorepo. | Centrado en servicios y soporte. | **Armonización del README**: Se documenta que la demo local funciona con SQLite/memoria sin requerir instalar PostgreSQL para evaluar el proyecto. |
| **Gobernanza y aprobación de PRs** | Proponía reparto de revisiones entre varios miembros. | Exigía paso de CI automatizado con 51 tests. | Fijaba 1 revisor general y 2 para áreas sensibles. | Establecía comité y 2 aprobaciones para cambios críticos. | **Consenso pleno en la regla de dos aprobaciones**: Cambios en seguridad, roles (`ability.ts`) o despacho exigen 2 mantenedores independientes. |

---

### 2.2 Roadmap de Apertura

```
  [ FASE 1: Antes de Publicar ]        [ FASE 2: Primera Publicación ]         [ FASE 3: Después de Publicar ]
             (T0)                                   (T + 1 semana)                           (Continuo)
  ┌───────────────────────────────┐     ┌────────────────────────────────┐     ┌─────────────────────────────────┐
  │ • Resolver y aislar secretos  │     │ • Release v0.1.0-alpha pública │     │ • SLA respuesta issues < 48 h   │
  │ • Formalizar Apache 2.0       │────>│ • Publicar README armonizado   │────>│ • Triage semanal rotatorio      │
  │ • Añadir .env.example y mock  │     │ • Activar Issues y PR templates│     │ • Gestión de releases v0.2.x    │
  │ • Constituir comité inicial   │     │ • Lanzar 3 "Good First Issues" │     │ • Auditoría de salud comunitaria│
  └───────────────────────────────┘     └────────────────────────────────┘     └─────────────────────────────────┘
```

#### Momento 1: Antes de publicar (Preparación)
- **Resolver secretos**: Verificar que ningún commit contenga credenciales de producción. Publicar [`.env.example`](file:///home/ubuntu/projects/coordia/.env.example) con valores de desarrollo seguros.
- **Elegir licencia**: Añadir el fichero `LICENSE` con el texto íntegro de la **Apache License 2.0**.
- **Preparar documentación**: Actualizar el [`README.md`](file:///home/ubuntu/projects/coordia/README.md) con la guía de arranque real en SQLite/memoria, catálogo de datos semilla (*mock data*) y enlace a la arquitectura.
- **Revisar dependencias**: Auditar licencias de librerías y asegurar que [`package-lock.json`](file:///home/ubuntu/projects/coordia/package-lock.json) esté bloqueado y pase `npm audit`.
- **Establecer gobernanza inicial**: Designar a los mantenedores fundadores y publicar [`CODE_OF_CONDUCT.md`](file:///home/ubuntu/projects/coordia/CODE_OF_CONDUCT.md) y [`docs/governance-and-sustainability.md`](file:///home/ubuntu/projects/coordia/docs/governance-and-sustainability.md).

#### Momento 2: Primera publicación (Lanzamiento público v0.1.0-alpha)
- **Crear release pública**: Publicar la etiqueta `v0.1.0-alpha` en GitHub con notas de versión claras, listando capacidades operativas y limitaciones conocidas.
- **Canales de comunicación**: Habilitar **GitHub Discussions** para preguntas de la comunidad y un canal de anuncios oficial.
- **Activar plantillas comunitarias**: Desplegar plantillas de incidencias ([`bug_report.md`](file:///home/ubuntu/projects/coordia/.github/ISSUE_TEMPLATE/bug_report.md) y [`feature_request.md`](file:///home/ubuntu/projects/coordia/.github/ISSUE_TEMPLATE/feature_request.md)) y plantilla de PR ([`PULL_REQUEST_TEMPLATE.md`](file:///home/ubuntu/projects/coordia/.github/PULL_REQUEST_TEMPLATE.md)).
- **Publicar tareas iniciales (*Good First Issues*)**: Abrir y etiquetar públicamente los tres issues identificados (selector de coordenadas en mapa, validación de descripción en backend y endpoint `/api/health`).
- **Difusión orientada**: Presentar el proyecto en comunidades afines (OpenStreetMap España, foros de Civic Tech y grupos de desarrollo municipal).

#### Momento 3: Después de publicar (Mantenimiento y Crecimiento)
- **Triaje y respuesta**: Asignar turnos rotatorios entre los mantenedores para responder a issues en un máximo de **48 horas laborables**.
- **Revisión e integración de PRs**: Aplicar rigurosamente la Definition of Done; dar feedback formativo y constructivo a contribuciones externas.
- **Evolución del software (Ciclo de Releases)**: Implementar la persistencia en disco de reportes (hito v0.2.0) y el piloto de enrutamiento con un organismo real.
- **Monitorización de sostenibilidad**: Evaluar periódicamente los 4 indicadores de salud del proyecto y contactar con entidades locales interesadas en servicios de soporte o despliegue piloto.

---

### 2.3 Indicadores de Salud del Proyecto

Se seleccionan cuatro indicadores cuantitativos y cualitativos para monitorizar la vitalidad del proyecto y actuar de manera temprana ante desviaciones:

| Indicador | Qué permite detectar | Umbral de Alarma | Posible actuación si empeora |
|---|---|---|---|
| **1. Tiempo de primera respuesta a issues (First Response Time)** | Comunidad desatendida, pérdida de interés de nuevos colaboradores y acumulación de incidencias sin clasificar. | Mediana superior a **72 horas laborables** sin primera interacción humana. | Establecer un turno rotatorio semanal de triaje entre los mantenedores y configurar respuestas automáticas de orientación vía GitHub Actions. |
| **2. Concentración de contribuciones (*Bus Factor* / Distribución de Commits y Reviews)** | Dependencia crítica de 1 o 2 personas para el mantenimiento, riesgo de abandono del proyecto y cuellos de botella en revisiones. | Más del **75 %** de los merges o reviews realizados exclusivamente por la misma persona durante un mes. | Repartir activamente el conocimiento técnico mediante revisiones conjuntas (*pair reviews*) y delegar la aprobación de tareas `good first issue` en nuevos colaboradores. |
| **3. Tasa de nuevos colaboradores externos (New Contributors per Quarter)** | Dificultad para atraer comunidad externa, documentación técnica intimidante o barreras de entrada excesivas. | **0 colaboradores externos** nuevos en un trimestre completo. | Simplificar la guía de arranque en `README.md`, publicar nuevos *good first issues* de menor complejidad y mejorar la visibilidad del proyecto en canales cívicos. |
| **4. Cadencia de mantenimiento y releases (Release & Commit Cadence)** | Sensación de proyecto estancado, abandono de la base de código o falta de tracción tras la fase de lanzamiento. | Más de **6 semanas** sin actividad en `main` ni resolución de bugs pendientes. | Convocar una reunión de sincronización del comité de mantenedores para reevaluar la carga de trabajo, ajustar prioridades y recortar alcance en favor de pequeñas mejoras continuas. |

---

## 3. Actividad 4: Cierre y Preguntas Clave

### 3.1 ¿Está el proyecto preparado para publicarse hoy? Justificad la respuesta.
**Sí, pero EXCLUSIVAMENTE bajo la categoría de demostración técnica / prototipo alpha (`v0.1.0-alpha`), y NO como producto para entornos de producción.**

*Justificación*:
- El repositorio está higienizado (sin contraseñas ni datos privados), cuenta con un pipeline de CI sólido con 102 pruebas automatizadas pasando, estructura modular limpia, persistencia transaccional SQLite para cuentas y reportes, plantillas de colaboración y gobernanza clara bajo Apache 2.0.
- Sin embargo, las integraciones con servicios de emergencia son simuladas internamente y no existe aún un conector de producción telemático ni un empaquetado multicontenedor. Puede publicarse de inmediato para invitar a desarrolladores y colaboradores cívicos a evaluar la arquitectura, pero advirtiendo explícitamente que no debe emplearse como canal operativo de emergencias reales.

### 3.2 ¿Cuál es el principal riesgo de abrirlo en su estado actual?
**La expectativa errónea de fiabilidad operativa por parte de administraciones o colectivos ciudadanos.**

*Detalle*: Que un colectivo vecinal o ayuntamiento intente desplegar la aplicación en producción asumiendo que los avisos se despachan en tiempo real a las centrales del 112 o policía municipal, provocando la desatención de incidentes críticos o emergencias ciudadanas reales.

### 3.3 ¿Cuál sería la primera tarea que realizaríais mañana?
**Empaquetar el entorno completo en Docker / Docker Compose y crear un script de siembra (*seed data*) con datos geolocalizados realistas.**

*Detalle*: Proporcionar un `docker-compose.yml` que levante frontend y backend preconfigurados junto a un comando `npm run db:seed` que popule usuarios de ejemplo (ciudadano, policía local, bomberos, admin 112) y 10 incidencias geolocalizadas, de modo que cualquier colaborador externo pueda probar el sistema de inmediato con un solo clic.

### 3.4 ¿Qué podría provocar que el proyecto fracasara aunque el código estuviese disponible públicamente?
1. **Falta de adopción institucional e interés operativo**: Que ningún organismo público local o servicio de emergencias acceda a realizar una prueba piloto o aportar feedback de dominio, reduciendo el proyecto a un ejercicio puramente académico.
2. **Abandono post-académico por falta de incentivos**: Que al concluir la asignatura universitaria los desarrolladores principales dejen de atender los issues y PRs externas, transmitiendo una imagen de repositorio muerto.
3. **Complejidad de despliegue para usuarios no técnicos**: Si un técnico municipal no puede desplegar la herramienta en un servidor propio con un único comando o contenedor Docker, la barrera técnica impedirá cualquier adopción real.

---

## 4. Índice de Entregables Relacionados

El plan de apertura de COORDIA se articula a través de los siguientes documentos específicos elaborados por cada sub-equipo:

- 📄 [`open-source-strategy.md`](file:///home/ubuntu/projects/coordia/open-source-strategy.md) — **Equipo A**: Estrategia de publicación, público objetivo, alcance funcional y componentes reservados.
- 📄 [`docs/technical-readiness.md`](file:///home/ubuntu/projects/coordia/docs/technical-readiness.md) — **Equipo B**: Auditoría de dependencias, licencias de librerías, seguridad de secretos y arquitectura de ejecución.
- 📄 [`docs/community-readiness.md`](file:///home/ubuntu/projects/coordia/docs/community-readiness.md) — **Equipo C**: Licencia Apache 2.0, normas de README, plantillas de issues/PRs, Código de Conducta y *Good First Issues*.
- 📄 [`docs/governance-and-sustainability.md`](file:///home/ubuntu/projects/coordia/docs/governance-and-sustainability.md) — **Equipo D**: Comité de mantenedores, flujo de decisión de PRs, plan de continuidad y modelo de sostenibilidad por servicios.
- 📄 [`open-source-launch-plan.md`](file:///home/ubuntu/projects/coordia/open-source-launch-plan.md) (este documento) — **Todo el equipo**: Análisis inicial, integración de acuerdos, roadmap de lanzamiento, indicadores de salud comunitaria y cierre conjunto.
