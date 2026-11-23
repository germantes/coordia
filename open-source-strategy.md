# COORDIA · Estrategia de código abierto

**Equipo A · Estrategia y alcance**

## 1. Objetivo y beneficios esperados

Abrir el código de COORDIA para que ayuntamientos, asociaciones y equipos de tecnología cívica puedan probar y adaptar sus flujos de reporte ciudadano geolocalizado. La primera versión estará orientada al uso local con datos ficticios y permitirá evaluar cómo se crea, revisa, confirma o cuestiona un reporte.

- **Reutilización.** Otras comunidades podrán adaptar el formulario, el mapa y las reglas de revisión a su contexto.
- **Transparencia.** Usuarios y organismos podrán entender qué datos usa cada flujo, qué puede ver cada rol y cómo se valida un reporte.
- **Mejora compartida.** Las pruebas externas podrán detectar errores, problemas de accesibilidad y pasos de instalación poco claros.

## 2. Alcance de la primera publicación

| Componente | Decisión | Motivo |
| --- | --- | --- |
| `frontend/` | Publicar el código y las pruebas. | Permite probar y adaptar la interfaz de cuenta, el formulario y el mapa. |
| `backend/` | Publicar el código y las pruebas de la API, incluidos autenticación, permisos, administración y reportes. | Permite reproducir el flujo local y revisar cómo se aplica el acceso por rol y organismo. |
| Configuración y documentación técnica | Publicar los manifiestos, el archivo de dependencias bloqueadas, el flujo de CI, la guía de arranque y la documentación funcional revisada. Incluir una configuración de ejemplo y datos ficticios. | Facilita que una persona externa instale el proyecto y ejecute sus pruebas. |
| Datos y entornos reales | Mantener en privado las bases de datos, cuentas, sesiones, reportes, coordenadas reales, copias de seguridad, registros, credenciales y configuración de despliegue. | Protege a las personas que usan el sistema y los accesos a los entornos operativos. |
| Seguimiento interno y coordinación institucional | Mantener privados `docs/control/`, los tableros internos y la matriz operativa de destinatarios en su versión actual. Publicar una descripción genérica del enrutamiento cuando esté disponible. | La documentación pública puede explicar el funcionamiento sin divulgar el seguimiento del equipo ni detalles operativos de organismos. |

## 3. Usuarios y colaboradores potenciales

| Público | Uso o contribución potencial |
| --- | --- |
| Ciudadanía y asociaciones vecinales | Probar el envío y la confirmación de reportes ficticios y aportar comentarios sobre el formulario y el mapa. |
| Ayuntamientos y entidades locales | Evaluar si las categorías, los permisos y la revisión de reportes se ajustan a sus flujos de trabajo. |
| Desarrolladores de tecnología cívica y comunidad OpenStreetMap | Mejorar la integración del mapa, la experiencia con ubicaciones y la documentación de la API. |
| Estudiantes y perfiles de QA o accesibilidad | Reproducir fallos, ampliar pruebas y revisar la navegación con teclado y la claridad de los mensajes. |

## 4. Madurez y funcionalidades pendientes

**COORDIA es un prototipo funcional para demostraciones locales.** Hay flujos de registro e inicio de sesión, administración de cuentas y organismos por API, creación de reportes y confirmación o cuestionamiento de reportes cercanos. Las 51 pruebas automatizadas pasaron en la verificación local. El repositorio cuenta con un flujo de CI configurado para ejecutar comprobaciones, pruebas y compilación. [Flujo de CI](.github/workflows/ci.yml) · [Roles y permisos](docs/roles_acceso.md) · [Confirmación de reportes](docs/confirmacion_reportes.md)

| Funcionalidad | Situación y decisión |
| --- | --- |
| Persistencia de reportes y respuestas | Se almacenan en memoria y se pierden al reiniciar el servidor. Las cuentas, sesiones y organizaciones sí se guardan en SQLite. La persistencia de reportes y respuestas queda pendiente antes de operar con datos reales. [Modelos de reportes](backend/src/models/report.ts) · [Modelo de respuestas](backend/src/models/report-response.ts) · [Almacenamiento de cuentas](backend/src/auth/store.ts) |
| Detección automática de duplicados | La documentación define la regla y la identifica como pendiente. La demostración permite probar la confirmación comunitaria mientras se completa la detección automática. [Reglas de reportes](docs/reglas_reportes.md) · [Confirmación de reportes](docs/confirmacion_reportes.md) |
| Avisos a organismos | La distribución de avisos de la HU-07 (destinatarios, horario de cada organismo, reintentos y control de duplicados) ya está integrada en `main` y cubierta por pruebas de aceptación. En la primera publicación se incluirá solo con destinos simulados; las integraciones reales con los organismos quedan fuera. |
| Instalación por terceros | El README enumera PostgreSQL y PostGIS, mientras que el código actual usa SQLite para cuentas y memoria para reportes. La guía pública debe describir la configuración que realmente necesita la primera versión. [README](README.md) · [Arranque de la API](backend/src/index.ts) |

## 5. Tres prioridades para la apertura

1. **Preparar el contenido público.** Acordar la licencia y los derechos de publicación con el equipo. Revisar los archivos y el historial que se vaya a compartir para retirar datos personales, credenciales y documentación interna. **Criterio de cierre.** La versión candidata tiene licencia aprobada y el equipo ha revisado el contenido y el historial que se publicarán.
2. **Hacer reproducible la demostración.** Actualizar el README con los requisitos reales, los comandos de arranque y las limitaciones. Preparar cuentas y reportes ficticios para probar el flujo ciudadano. **Criterio de cierre.** Una persona ajena al equipo arranca el proyecto desde una copia limpia, ejecuta las pruebas, crea un reporte de ejemplo y lo confirma o cuestiona con otra cuenta del mismo organismo.
3. **Organizar las primeras contribuciones.** Designar a quienes atenderán las incidencias y revisarán propuestas. Añadir una guía breve para contribuir y abrir tareas iniciales de documentación, accesibilidad y pruebas. **Criterio de cierre.** Hay responsables identificados y una persona externa puede seguir la guía completa para enviar su primera propuesta.

## 6. Riesgos y acciones

| Riesgo | Acción |
| --- | --- |
| Que se publique algún dato personal, credencial o documento interno en los archivos o en el historial del repositorio. | Revisar el contenido y el historial antes de publicar (prioridad 1) y, si hace falta, publicar desde una copia limpia del repositorio. |
| Que alguien use la demostración pensando que guarda los reportes, cuando ahora se pierden al reiniciar el servidor. | Indicarlo claramente en el README y en lapropia demostración hasta completar la persistencia de reportes y respuestas. |
| Que la guía de instalación no coincida con lo que necesita el código (PostgreSQL y PostGIS frente a SQLite y memoria) y una persona externa no consiga arrancar el proyecto. | Actualizar el README con los requisitos reales antes de la primera publicación (prioridad 2). |
| Que el proyecto dependa de muy pocas personas para atender issues y revisar PRs, y las primeras contribuciones se queden sin respuesta. | Designar responsables y repartir la revisión entre varias personas del equipo (prioridad 3). |
