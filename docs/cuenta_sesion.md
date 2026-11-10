# Datos de cuenta, validación y sesión

Contrato de la historia **HU-01: Registrarse e iniciar sesión**. Define los datos y el comportamiento esperado para conectar más adelante la API con un repositorio persistente.

## Datos de cuenta

| Campo | Regla | Origen |
|---|---|---|
| `id` | UUID generado por el servidor | Servidor |
| `displayName` | Obligatorio; de 2 a 80 caracteres después de recortar espacios | Formulario de registro |
| `email` | Obligatorio; máximo 254 caracteres; se recorta y guarda en minúsculas; debe ser único | Formulario de registro |
| `passwordHash` | Hash Argon2id de la contraseña; nunca se guarda ni se devuelve la contraseña en claro | Servidor |
| `role` | `guest` por defecto al registrarse; no se acepta desde el formulario | Servidor o administrador |
| `organizationId` | Asignado por invitación o administración; no se acepta sin validar desde el formulario | Servidor |
| `createdAt` | Fecha UTC generada por el servidor | Servidor |

El cuerpo de registro acepta `displayName`, `email`, `password` y `confirmPassword`. La confirmación se valida y se descarta; no se persiste.

## Validaciones

- Nombre: tras eliminar espacios exteriores, entre 2 y 80 caracteres Unicode.
- Correo: formato de correo válido, máximo 254 caracteres, comparación sin distinguir mayúsculas y unicidad comprobada en almacenamiento.
- Contraseña nueva: de 12 a 128 caracteres; se rechaza si está formada solo por espacios, aunque alcance el mínimo de longitud. La contraseña se conserva exactamente como se escribió y no se recorta antes de validarla ni de verificarla. No se exige una combinación arbitraria de mayúsculas, cifras y símbolos.
- Confirmación: debe coincidir exactamente con la contraseña.
- Campos de autoridad como `role`, `id`, `passwordHash` y `organizationId` nunca se copian desde el registro público.
- Inicio de sesión: correo normalizado y contraseña de hasta 128 caracteres; se rechazan contraseñas vacías o formadas solo por espacios. La contraseña no se recorta ni transforma antes de verificarla.

La implementación pura de estas reglas está en `backend/src/validation/auth.ts`. La disponibilidad del correo y la asignación de organismo requieren repositorio persistente y validación del servidor.

## Flujo de sesión previsto

1. **Registro** (`POST /api/auth/register`): validar el cuerpo, normalizar el correo, comprobar unicidad, calcular el hash, crear la cuenta como `guest` y asociar el organismo únicamente desde una invitación válida o una asignación administrativa.
2. **Inicio de sesión** (`POST /api/auth/login`): normalizar el correo, buscar la cuenta, verificar el hash y devolver el mismo error genérico para correo inexistente o contraseña incorrecta.
3. **Acceso autenticado**: entregar un access token JWT de 15 minutos con `sub`, `role` y `organizationId`; las peticiones protegidas lo envían como `Authorization: Bearer <token>`. El middleware valida firma y expiración antes de construir `req.user`.
4. **Renovación** (`POST /api/auth/refresh`): rotar un refresh token aleatorio guardado como hash y enviado en cookie `HttpOnly`, `Secure` y `SameSite=Lax`. Cada refresh anterior queda revocado.
5. **Cierre de sesión** (`POST /api/auth/logout`): revocar el refresh token en el servidor y limpiar la cookie. El access token ya emitido expira en un máximo de 15 minutos.

El secreto JWT debe configurarse por entorno y no usar un valor de desarrollo en producción. Las respuestas de login deben evitar revelar si una cuenta existe; registro, login y refresh deben limitar intentos. Errores de validación devuelven `400`, credenciales incorrectas `401` y correo duplicado `409`.

## Límite actual

El backend aún no tiene repositorio de cuentas ni almacén de sesiones. Este contrato y sus validadores quedan definidos; las rutas de registro, login, refresh y logout deben implementarse junto con el almacenamiento, no simularse con sesiones volátiles en memoria.
