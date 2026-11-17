# HU-04 — Reglas para confirmar o cuestionar reportes

Este documento concreta e implementa la subtarea de HU-04 sobre proximidad, duplicados y cambios de respuesta. Los umbrales iniciales aceptados son 500 m, precisión de 100 m y antigüedad máxima de ubicación de 5 minutos.

## 1. Quién puede responder

- La persona debe tener una identidad autenticada y estable para evitar contar varias veces su respuesta.
- No puede confirmar ni cuestionar su propio reporte.
- Solo se admiten respuestas sobre reportes pendientes del mismo organismo. El endpoint de cercanía devuelve únicamente categoría, descripción, fecha, distancia aproximada, respuesta propia y contadores; no expone el autor ni las coordenadas exactas del reporte.
- La consulta muestra solo los datos necesarios del reporte; nunca expone datos personales de quien lo creó.
- Solo se aceptan respuestas mientras el reporte esté `pending`. Al pasar a `validated`, `approved` o `rejected`, ya no se puede responder ni cambiar la respuesta.

## 2. Regla de proximidad propuesta

- La persona debe estar a **500 metros o menos** del punto del incidente.
- La distancia se calcula en el servidor con la fórmula de Haversine, usando las coordenadas del reporte y la ubicación puntual obtenida al enviar la respuesta.
- La ubicación debe tener precisión horizontal declarada de **100 metros o mejor** y haberse obtenido en los últimos **5 minutos**. Si no cumple, se pide volver a obtenerla.
- Si la persona no concede acceso a ubicación o está fuera del radio, no se registra la respuesta y se explica el motivo.
- Las coordenadas usadas para comprobar proximidad no se conservan ni se muestran a otras personas. Se guarda el resultado de la comprobación y su fecha para auditoría.

Los valores implementados de 500 m, 100 m y 5 minutos son los umbrales iniciales aceptados para esta tarea. La ubicación aportada por un navegador no prueba por sí sola que no haya sido falsificada; la regla sirve como control funcional, no como prueba antifraude.

## 3. Duplicados y conteo

- Cada persona tiene como máximo **una respuesta activa por reporte**, identificada por la combinación `reportId + userId`.
- La respuesta puede ser **confirmar** o **cuestionar**. Repetir la misma respuesta (por doble clic o reintento de red) no crea otra aportación ni incrementa el contador.
- Los contadores reflejan respuestas activas distintas, no el número de envíos ni el historial de cambios.
- La detección de reportes que describen el mismo incidente sigue la regla única de `reglas_reportes.md`: misma área geográfica, creación dentro de 24 h y Jaccard textual ≥ 0,85, cumpliéndose las tres condiciones. La cercanía de 500 m usada para encontrar reportes que una persona puede confirmar o cuestionar no es el criterio de duplicidad. El plazo de revisión de 2 h para prioridad `high` es independiente. Esta tarea implementa las respuestas de ciudadanos, no la detección/agrupación automática de reportes duplicados.

## 4. Cambiar una respuesta

- Mientras el reporte siga `pending`, la persona puede cambiar su respuesta de **confirmar** a **cuestionar**, o al revés.
- El cambio actualiza su única respuesta activa: resta una unidad del contador anterior y suma una al nuevo, de forma atómica.
- La misma operación repetida no altera el resultado.
- Se conserva un historial de auditoría con usuario, respuesta anterior, respuesta nueva y fecha/hora ISO 8601. El historial no contiene las coordenadas exactas usadas para proximidad.
- Al cerrarse el reporte, no se permiten cambios. La interfaz explica que ya no se puede cambiar la respuesta.

No se define una opción para retirar la respuesta sin sustituirla; la HU habla de confirmar o cuestionar. Si producto quiere permitir retirarla, deberá acordarse como regla aparte.

## 5. Contrato sugerido

La implementación expone `POST /api/reports/nearby` para buscar reportes pendientes cercanos y `PUT /api/reports/{reportId}/response` para responder o cambiar la respuesta.

El primer endpoint recibe la observación de ubicación y devuelve una lista sanitizada dentro del radio. El segundo recibe:

```json
{
  "response": "confirm",
  "location": {
    "latitude": 40.4168,
    "longitude": -3.7038,
    "accuracyMeters": 24,
    "capturedAt": "2026-11-10T08:30:00Z"
  }
}
```

`response` admite `confirm` (confirmar) o `question` (cuestionar). El servidor obtiene `userId` del token y decide si crea, conserva o cambia la respuesta; el cliente no puede enviar identidad, contadores ni historial. La respuesta incluye `changed` y los contadores activos actualizados. Los reintentos con la misma respuesta no incrementan los contadores.

Respuestas HTTP: `200` con la respuesta actual y los contadores; `400` por datos inválidos; `401` si no hay identidad autenticada; `403` por autoría propia o falta de acceso al organismo; `404` si el reporte no existe; `409` si ya no acepta respuestas; `422` si la ubicación no cumple proximidad o precisión.

## 6. Casos de aceptación derivados

1. Dentro del radio, con ubicación reciente y precisa, una persona autorizada puede confirmar o cuestionar un reporte ajeno pendiente.
2. Fuera del radio, con ubicación imprecisa o caducada, la respuesta se rechaza sin modificar contadores.
3. Un segundo envío idéntico de la misma persona no duplica su respuesta.
4. Cambiar la respuesta sustituye la anterior, ajusta ambos contadores una sola vez y deja trazabilidad.
5. El autor del reporte, una persona sin acceso al organismo o cualquier persona que intente responder después del cierre recibe el error correspondiente, sin cambiar el reporte.

## 7. Dependencias y límites

- El flujo se limita al rol ciudadano autenticado (`guest`) con organismo asignado. La matriz general sigue restringiendo la lectura de reportes ajenos; el nuevo endpoint de cercanía es una excepción acotada y devuelve campos no sensibles.
- SQLite conserva las respuestas, su historial y la verificación asociada. La combinación reporte/usuario identifica una única aportación activa.
- El flujo requiere una identidad autenticada con `userId` estable y un `organizationId` en el token. La detección automática de duplicados sigue pendiente de implementación según `reglas_reportes.md`.
