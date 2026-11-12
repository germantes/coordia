# HU-02 — Diseño para comunicar un incidente geolocalizado

Este documento concreta la subtarea **“Diseñar formulario, categorías iniciales y contrato de creación del reporte”**. Define una primera propuesta funcional para revisar con producto antes de convertirla en una interfaz y conectarla a persistencia.

## Formulario

La interfaz inicial estará en español. Orden recomendado:

1. **Categoría** (obligatoria): selector con las categorías iniciales de abajo.
2. **Descripción** (obligatoria): qué ocurre y por qué se comunica.
3. **Ubicación** (obligatoria): seleccionar un punto en el mapa o usar la ubicación del dispositivo; mostrar el punto elegido y permitir corregirlo antes del envío.
4. **Fecha y hora del incidente** (opcional): si no se indica, no se debe presentar la hora de envío como si fuera la hora del incidente.

El botón de envío permanece desactivado mientras falte un campo obligatorio o haya errores. Los errores se muestran junto al campo afectado. Antes del envío se presenta un resumen breve de categoría y ubicación para que la persona pueda revisarlo.

## Categorías iniciales aceptadas

| Valor API | Etiqueta en español |
|---|---|
| `infrastructure` | Infraestructura |
| `safety` | Seguridad |
| `accessibility` | Accesibilidad |
| `environment` | Medio ambiente |
| `other` | Otro |

Estas categorías iniciales han sido aceptadas para la tarea. La API solo acepta los valores enumerados; las etiquetas visibles pueden cambiar sin alterar el contrato.

## Validaciones

- `category`: valor requerido de la lista anterior.
- `description`: texto requerido, recortado en los extremos; entre 10 y 2.000 caracteres después del recorte.
- `location.latitude`: número entre -90 y 90.
- `location.longitude`: número entre -180 y 180.
- `occurredAt`: opcional; fecha y hora ISO 8601 válida, no posterior a la hora de recepción del reporte.
- Se rechazan propiedades no reconocidas para evitar aceptar campos de autorización o estado enviados por el cliente.
- El backend vuelve a validar todos los campos; la validación del formulario solo mejora la experiencia y no sustituye la validación del servidor.

## Contrato de creación propuesto

`POST /api/reports` con `Content-Type: application/json`.

```json
{
  "category": "infrastructure",
  "description": "Hay una farola caída que bloquea parte de la acera.",
  "location": {
    "latitude": 40.4168,
    "longitude": -3.7038
  },
  "occurredAt": "2026-11-10T08:30:00Z"
}
```

`occurredAt` puede omitirse. El cliente no envía `id`, `ownerId`, `organizationId`, `status`, `createdAt` ni el entorno: son datos controlados o derivados por el servidor. La organización debe resolverse en el backend conforme a las reglas de ámbito existentes; no se debe permitir que el cliente la elija libremente.

### Respuesta de éxito

`201 Created`, devolviendo el identificador y los datos aceptados del reporte, el estado inicial `pending` y la fecha de creación asignada por el servidor. No devolver datos personales que no sean necesarios para confirmar el envío.

### Errores esperados

| HTTP | Uso |
|---|---|
| `400` | JSON mal formado o campos inválidos/desconocidos; incluir errores por campo sin eco de datos sensibles. |
| `401` | Credencial inválida cuando la solicitud incluya autenticación. |
| `403` | La identidad no puede crear reportes dentro del ámbito que le corresponde. |
| `500` | Error inesperado; respuesta genérica, con detalle técnico solo en logs protegidos. |

## Estado y límites de implementación

La interfaz web, el selector de ubicación sobre OpenStreetMap, la validación en cliente y servidor y `POST /api/reports` están implementados. Los reportes se guardan en SQLite; el contrato de confianza describe la observación GPS opcional de autor y la configuración de almacenamiento.

La autorización sigue las reglas existentes: la petición necesita un token Bearer válido y un ámbito de organismo asignado para poder crear el reporte. La interfaz puede leer el token de sesión desde `sessionStorage` con la clave `coordia.accessToken`; sin token se trata como invitado y, sin organismo asignado, la API responde `403`. La integración de inicio de sesión y la asignación/resolución de organismo aún deben conectarse para completar el flujo ciudadano.

La detección de duplicados y la confirmación/cuestionamiento corresponden a HU-04.
