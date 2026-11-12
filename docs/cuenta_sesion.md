# Datos de cuenta, validación y sesión

Contrato de la historia **HU-01: Registrarse e iniciar sesión**. La API implementa registro, login, renovación y cierre con cuentas y sesiones persistentes.

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

La implementación pura de estas reglas está en `backend/src/validation/auth.ts`. El registro comprueba la unicidad del correo en SQLite. La integración de la asignación de organismo con invitaciones o administración queda pendiente.

## Flujo de sesión implementado

1. **Registro** (`POST /api/auth/register`): validar el cuerpo, normalizar el correo, comprobar unicidad, calcular el hash, crear la cuenta como `guest` y asociar el organismo únicamente desde una invitación válida o una asignación administrativa.
2. **Inicio de sesión** (`POST /api/auth/login`): normalizar el correo, buscar la cuenta, verificar el hash y devolver el mismo error genérico para correo inexistente o contraseña incorrecta.
3. **Acceso autenticado**: entregar un access token JWT de 15 minutos con `sub`, `sid`, `role` y `organizationId`. `sid` identifica una sesión persistente creada al iniciar sesión. Las peticiones protegidas lo envían como `Authorization: Bearer <token>`. En cada petición, el middleware valida firma, expiración y que la sesión de `sid` existe, pertenece a `sub` y sigue activa antes de construir `req.user`. Una sesión inexistente o revocada devuelve `401` aunque el JWT no haya expirado.
4. **Renovación** (`POST /api/auth/refresh`): rotar un refresh token aleatorio guardado como hash y enviado en cookie `HttpOnly` y `SameSite=Lax`, con `Secure` en producción. En desarrollo local se admite HTTP. Cada refresh anterior queda revocado. La comprobación de sesión activa y la rotación se realizan de forma atómica para impedir renovaciones de sesiones cerradas y reutilización del mismo refresh token. La sesión caduca 7 días después del login y conserva esa fecha al renovar.
5. **Cierre de sesión** (`POST /api/auth/logout`): revocar de forma persistente la sesión identificada por `sid` y sus refresh tokens, limpiar la cookie y responder `204` solo después de confirmar la revocación. Todos los access tokens asociados a ese `sid` dejan de autorizar nuevas peticiones protegidas desde ese momento. La expiración de 15 minutos se conserva como límite adicional. El cierre afecta a la sesión actual, y las sesiones de otros dispositivos siguen activas. Repetir el cierre de una sesión ya revocada devuelve `204`, sin reactivarla.

El secreto JWT debe configurarse por entorno y no usar un valor de desarrollo en producción. Las respuestas de login deben evitar revelar si una cuenta existe. Errores de validación devuelven `400`, credenciales incorrectas o sesiones revocadas `401` y correo duplicado `409`.

## Revocación de sesión y CA-4

La decisión de este contrato es comprobar una sesión persistente en cada acceso protegido. El almacén compartido registra al menos `sid`, `userId`, `createdAt`, `expiresAt` y `revokedAt`, además de los hashes de refresh tokens asociados. El middleware comprueba también la caducidad de la sesión. Las instancias de la API consultan el mismo estado de revocación, sin cachés que admitan acceso después del logout.

Logout y refresh deben serializar sus cambios sobre la misma sesión. Si una renovación termina antes del logout, los tokens emitidos conservan ese `sid` y quedan invalidados al revocarlo. Si el logout termina primero, la renovación devuelve `401`.

Si el almacén de sesiones falla, las operaciones protegidas y la renovación devuelven `503` sin ejecutar la operación solicitada. Un fallo al persistir la revocación también devuelve `503`, permitiendo reintentar el cierre. El cliente debe borrar el access token local al cerrar sesión y mostrar el error si el servidor no confirma la revocación. La interfaz muestra los formularios de registro e inicio de sesión y permite cerrar la sesión desde la misma página.

Las pruebas de `backend/tests/auth-route.test.ts` inician sesión, acceden a una función protegida, cierran sesión y repiten la llamada con el mismo access token todavía vigente. La última petición devuelve `401`. También cubren el rechazo del refresh tras logout, el cierre repetido, la carrera entre refresh y logout y la revocación después de reabrir el almacén persistente.

## Límites iniciales de intentos

Se aplican estos valores iniciales. Las ventanas son móviles y los contadores se comparten entre procesos que acceden al mismo archivo SQLite. El límite por IP y el de correo cuentan las solicitudes admitidas por el limitador, incluidas las que fallan su validación. El límite adicional de refresh por sesión cuenta las solicitudes con su refresh token actual válido.

| Operación | Límite por IP | Límite adicional |
|---|---|---|
| Registro | 5 intentos en 15 minutos | — |
| Login | 30 intentos en 15 minutos | 5 intentos por correo normalizado en 15 minutos, exista o no la cuenta |
| Refresh | 60 intentos en 15 minutos | 30 intentos por sesión en 15 minutos |

Al superar cualquiera de los límites, la API devuelve `429` con `Retry-After` en segundos. Para IP y correo se informa del tiempo de espera calculado. Para el límite de refresh por sesión se usa una espera conservadora de 900 segundos. El mensaje es genérico y no revela la existencia de una cuenta. Los contadores expiran al salir de la ventana y se conservan tras un login correcto. La IP se obtiene de la conexión. Si se despliega detrás de un proxy, deberá configurarse el proxy de confianza.

## Ejecución y alcance

El backend requiere Node >= 24.7 por las APIs integradas de Argon2id y SQLite. `AUTH_DB_PATH` configura la ruta del archivo de cuentas, sesiones y contadores. Su valor predeterminado es `.data/auth.sqlite`, relativo al directorio de ejecución. El despliegue debe conservar ese archivo en un volumen persistente. Los procesos de una misma instalación deben acceder al mismo archivo local. Para desplegar en varios servidores será necesario un repositorio compartido apropiado.

`JWT_SECRET` es obligatorio en producción. `FRONTEND_ORIGIN` configura el origen permitido para peticiones con cookies, con valor de desarrollo `http://localhost:5173`. Login y refresh devuelven `{ accessToken, tokenType: "Bearer", expiresIn: 900 }` y la cookie de renovación. El navegador debe usar `credentials: 'include'` al llamar a esas rutas. Logout recibe el access token de la sesión en la cabecera Bearer.

Los JWT anteriores que carecen de `sid` requieren un nuevo login. El registro crea cuentas ciudadanas sin organismo asignado. La asignación de organismos mediante invitación o administración sigue pendiente. La interfaz conserva el access token en la pestaña, renueva la sesión ante un 401 y reintenta la operación una vez. Al cerrar sesión retira los datos de reportes y borra el token local.
