# HU-05 · Verificación comunitaria de reportes

Cada reporte incluye `verification.state` (`pending` o `verified`), `score`, `threshold` y `changedAt` en UTC. El estado operativo (`status`) lo gestiona el organismo. Una confirmación comunitaria puede cambiar la verificación mientras el reporte sigue pendiente de atención.

## Cálculo inicial

La regla de T1 suma la reputación del autor × 0,30, la proximidad del autor × 0,25 y la evidencia comunitaria × 0,35. Si tres confirmaciones activas de personas distintas caen en una misma ventana de menos de 30 segundos, se descuentan 0,40 puntos una vez. El sistema redondea a dos decimales, con mínimo cero, y verifica al alcanzar el umbral (0,70 por defecto). Por debajo del umbral conserva `pending`, incluido el intervalo inferior a 0,40 del prototipo.

- La reputación se obtiene de los reportes previos de la persona con decisión oficial en producción. Es la proporción de validados o aprobados sobre validados, aprobados y rechazados. Se toma una instantánea al crear el reporte o aportar una respuesta. Quien carece de decisiones previas empieza con 0,20.
- «Usar mi ubicación» permite enviar la observación GPS puntual del autor junto al punto del incidente. El servidor comprueba precisión y antigüedad como en HU-04. Asigna proximidad 1 hasta 200 m, desciende linealmente hasta 0 a los 1.000 m y usa 0 si falta una observación válida. Solo persiste el factor. Se puede enviar un reporte seleccionando el punto en el mapa.
- Cada persona tiene una aportación activa por reporte. La evidencia social suma las reputaciones de las confirmaciones y divide entre el total de confirmaciones y cuestionamientos. Cambiar de opinión sustituye la aportación. Repetir la misma respuesta conserva su fecha y su peso.
- La API carece de una señal autorizada de coincidencia de red o dispositivo. La penalización de 0,30 del prototipo que requiere esa señal queda pendiente. El servidor no recoge identificadores de red ni de dispositivo para esta regla.
- Con autor y validador nuevos, GPS cercano y una confirmación el resultado es 0,38. Con ambos historiales al 100 %, el mismo caso alcanza 0,90. Sin GPS del autor el máximo inicial es 0,65.

## API

Un administrador puede consultar o sustituir la regla de una categoría con `GET` o `PUT /api/reports/confidence-rules/:category`. El cuerpo de PUT admite los cuatro números siguientes. Los pesos deben sumar como máximo 1 y el umbral debe ser positivo y alcanzable con los pesos indicados.

```json
{ "creatorWeight": 0.30, "proximityWeight": 0.25, "socialWeight": 0.35, "threshold": 0.70 }
```

Cambiar la regla recalcula todos los reportes de esa categoría en la misma transacción. Quien tenga permiso de lectura sobre un reporte puede consultar `GET /api/reports/:id/verification`. El historial inicializa el estado al crear el reporte y registra cada transición con hora, puntuación, regla aplicada y causa. Conserva las transiciones anteriores cuando se retira una confirmación o cambia el umbral.

Los reportes, las respuestas activas, el historial y las reglas se guardan en SQLite. `REPORT_DB_PATH` selecciona el archivo compartido por los procesos del backend (por defecto `.data/reports.sqlite` en su directorio de ejecución). Una aportación y su efecto en el historial se guardan juntos.
