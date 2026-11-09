# Reglas clave para confirmar o cuestionar reportes

Este documento define las reglas que el equipo debe aplicar al revisar cualquier reporte generado por la aplicación COORDIA. Se basa en los principios de **Scrum**, **XP** y la guía P6 del proyecto.

---

## 1. Validación de datos
- **Formato**: Todos los campos deben respetar el tipo y formato especificado en el esquema OpenAPI.
- **Rangos**: Verificar que los valores numéricos se encuentren dentro de los rangos permitidos (ej. coordenadas lat/long entre -90/90 y -180/180).
- **Obligatoriedad**: Campos marcados como `required` no pueden estar vacíos.

## 2. Criterios de aceptación
- Cada reporte debe cumplir con al menos **uno** de los criterios de aceptación definidos en la historia de usuario correspondiente.
- Si el reporte no cumple, se debe **marcar como Rechazado** y explicar claramente el motivo.

## 3. Auditoría y trazabilidad
- Incluir siempre el **ID del usuario** que generó el reporte y la **marca de tiempo** ISO‑8601.
- Guardar el **hash SHA‑256** del contenido del reporte para detección de cambios.

## 4. Consistencia con la base de datos
- Verificar que el reporte pueda ser insertado en la tabla `reports` sin violar restricciones de clave foránea.
- Si hay referencias a entidades externas (p. ej., proyecto, zona), comprobar que esas entidades existan.

## 5. Reglas de negocio específicas
- **Regla de superposición**: No se pueden crear dos reportes que cubran exactamente la misma área geográfica dentro de un intervalo de 24 h.
- **Regla de prioridad**: Los reportes con prioridad `high` deben ser revisados dentro de las **2 h** posteriores a su creación.
- **Regla de duplicados**: Detectar y agrupar reportes idénticos usando el algoritmo de similitud de texto (Jaccard ≥ 0.85).

## 6. Preguntas frecuentes (FAQ)
| Pregunta | Respuesta |
|---|---|
| ¿Qué hago si falta un campo obligatorio? | Marcar el reporte como **Rechazado** y solicitar al usuario que lo complete. |
| ¿Cómo se manejan los errores de conexión a la base de datos? | Registrar el error, notificar al equipo de backend y **no** aceptar el reporte hasta que la conexión sea restablecida. |
| ¿Se pueden modificar reportes después de la aceptación? | No. Cualquier cambio requiere crear un **nuevo** reporte con referencia al original. |

---

## 7. Proceso de revisión
1. **Automático**: El CI ejecuta pruebas unitarias y de lint que verifican formato y tipos.
2. **Manual**: Un revisor asignado abre el PR, revisa este documento y decide **Accept** o **Reject**.
3. **Feedback**: Si se rechaza, el revisor debe comentar en el PR indicando la regla violada y posibles correcciones.

> **Nota**: Estas reglas pueden evolucionar. Cada cambio debe ser versionado mediante un Pull Request y aprobado por al menos un Lead de desarrollo.

