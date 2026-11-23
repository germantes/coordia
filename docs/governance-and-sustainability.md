# Gobernanza y sostenibilidad de Coordia

Propuesta del equipo D para la apertura del proyecto.

## Gobernanza

Coordia tendrá un **comité de mantenedores** formado inicialmente por miembros del equipo que conozcan la aplicación y puedan dedicar tiempo a revisarla. El comité decide sobre el alcance, la arquitectura, las incorporaciones de mantenedores y las publicaciones. Compartir estas decisiones encaja con el reparto de revisiones que el equipo ya usa en GitHub y reduce la dependencia de una persona para continuar el proyecto.

Cualquier colaborador puede proponer cambios mediante un issue o una pull request (PR). Un mantenedor distinto de la persona autora revisa los cambios ordinarios. Los cambios de arquitectura, permisos, tratamiento de datos sensibles o envío de avisos a organismos requieren **dos aprobaciones de mantenedores distintos del autor**. Un mantenedor fusiona la PR cuando tiene las aprobaciones necesarias, se han resuelto las observaciones y pasan las comprobaciones de integración continua del repositorio.

Los desacuerdos se discuten en el issue o la PR, dejando por escrito las alternativas y sus consecuencias para Coordia. El comité busca consenso. Si persiste el desacuerdo, decide por mayoría simple y publica el motivo en el mismo hilo. En caso de empate se mantiene el comportamiento vigente y se puede volver a presentar la propuesta con más evidencia.

## Continuidad

Si un desarrollador principal abandona el proyecto, el comité hace inventario de sus PR abiertas, las tareas pendientes y los accesos bajo su control. Reparte ese trabajo entre los mantenedores disponibles y deja constancia del nuevo reparto en GitHub. Si hay margen para un traspaso, la persona que sale repasa con quien asume el trabajo los procedimientos de despliegue y recuperación de su área. El comité revoca sus accesos al concluir el traspaso. Si la capacidad restante es insuficiente, prioriza la corrección de fallos y el mantenimiento de las funciones existentes.

| Riesgo para Coordia | Mitigación |
| --- | --- |
| Se pierde el conocimiento de cómo se verifican y distribuyen los reportes. | Documentar las reglas y las decisiones relevantes junto al código. En los cambios críticos, la segunda revisión comprueba también que la documentación y las pruebas permiten retomar el trabajo. |
| Una salida deja al equipo sin acceso al repositorio o al despliegue. | Mantener al menos dos administradores del repositorio, registrar qué cuentas controlan cada servicio y documentar cómo se restaura el acceso y se recupera una copia. |
| Tras la asignatura quedan incidencias y PR sin atender. | Nombrar por turnos a una persona para revisar la cola de GitHub, priorizar fallos de permisos, pérdida de reportes y avisos, y ajustar el alcance al tiempo disponible. |

## Sostenibilidad

El código de Coordia se publicará según la licencia acordada para el proyecto. El modelo propuesto es **ofrecer servicios a los organismos** que quieran adoptarlo. La oferta incluye instalación, configuración de destinatarios y horarios, integración con sus herramientas y soporte. Así pueden contratar ayuda para operar su propia instancia y los ingresos contribuyen a cubrir el mantenimiento y el alojamiento de los servicios comunes del proyecto. Las mejoras generales financiadas por un organismo se propondrán al repositorio mediante el mismo proceso de revisión.

El primer paso será validar con un organismo local qué instalación y soporte necesitaría en un piloto y cuánto tiempo puede asumir el equipo. Hasta contar con capacidad y financiación confirmadas, los compromisos de soporte se limitarán a los acordados para ese piloto.