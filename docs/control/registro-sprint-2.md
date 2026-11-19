# CTRL-1 · Registro de control — Sprint 2

> **Fuente canónica: el repositorio** (`docs/control/registro-sprint-2.json`). Versión `LB-S2-v1` · registro `2.0` · actualizado `2026-11-19T18:00:43Z` · tarea CTRL-1 `completados`.  
> Si eres un agente: lee el contrato (§0) y el JSON. El Doc de ClickUp `2kxv5w3j-132` está congelado desde `2026-11-10T13:22:14Z`; no lo escribas.

## 0\. Contrato para agentes y MCP

### 0.1 Identidad y acceso

| Campo | Valor |
| ---| --- |
| workspace\_id | 90122154098 |
| doc\_id | 2kxv5w3j-1172 |
| page\_id | 2kxv5w3j-132 |
| doc\_url | [https://app.clickup.com/90122154098/v/dc/2kxv5w3j-1172/2kxv5w3j-132](https://app.clickup.com/90122154098/v/dc/2kxv5w3j-1172/2kxv5w3j-132) |
| task\_id | 1ammuym2b2a |
| task\_url | [https://app.clickup.com/t/1ammuym2b2a](https://app.clickup.com/t/1ammuym2b2a) |
| list\_id | 1500450000000263 |
| list\_url | [https://app.clickup.com/90122154098/v/l/li/1500450000000263](https://app.clickup.com/90122154098/v/l/li/1500450000000263) |
| folder\_id | 901215373357 |
| space\_id | 901210725917 |
| owner | Alejandro Cerezo Contreras |
| reviewer | Damián Verde |
| status | en revisión |
| doc\_version | LB-S2-v1 |
| schema\_version | 1.1 |
| updated\_at\_utc | 2026-11-10T15:38:53Z |
| timezone | Europe/Madrid |
| canonical | repo:docs/control/registro-sprint-2.json |
| custom\_task\_ids | false (usar IDs internos) |
| snapshots | xlsx v1 (18 filas) y v2 (25 filas); históricos, no editar. Doc ClickUp congelado. |

### 0.2 Lectura

| Qué | Dónde |
| --- | --- |
| Snapshot máquina | `docs/control/registro-sprint-2.json` |
| Lectura humana, con el mismo JSON en §7 | `docs/control/registro-sprint-2.md` |
| Revisiones de tareas | `docs/control/revisiones/` |

El JSON y el bloque §7 de este markdown se escriben juntos y tienen que coincidir. Las tablas son el render humano del JSON.

### 0.3 Escritura

1. Editar `docs/control/registro-sprint-2.json`.
2. Regenerar las tablas de este markdown desde ese JSON, en el mismo cambio.
3. Actualizar `meta.updated_at_utc` y validar §6.4.
4. No hacer PUT del Doc de ClickUp. El identificador `2kxv5w3j-132` se conserva solo como histórico congelado el `2026-11-10T13:22:14Z`.

### 0.4 Tareas

El tablero sigue en ClickUp (lista `1500450000000263`): estado, comentarios y tiempo se leen por la API de tareas. Este registro no se mantiene por la API de Docs. El MCP de ClickUp que cubre tareas no sustituye a estos ficheros.

### 0.5 Esquema de datos

| Entidad | Clave | Campos | Tipos / reglas |
| ---| ---| ---| --- |
| daily | date + cut | date, cut, label, ideal\_h, real\_h, deviation\_h, deviation\_pct, hu\_accepted, hours\_accepted\_h, blocked\_tasks, block\_days, critical\_defects, logged\_hours, notes | Fechas ISO; horas y % con punto decimal; null = pendiente; 0 = cero medido |
| audit | task\_id | hu, type, task\_id, task, assignee\[\], reviewer\[\], reviewer\_source, estimate\_h, start, due, milestone, status, checks{}, checks\_ok, notes, url | assignee/reviewer son arrays; checks son booleanos; reviewer\_source = field | description | missing |
| indicators | code | code, name, audience, formula, unit, frequency, owner, green, amber, red, data | Códigos estables KPI-1..4 y M-5..7 |
| baseline | field | B0\_h, H0\_h, control\_h, N0, people, capacity\_per\_person\_h, total\_capacity\_h, meetings\_h, contingency\_h, uncommitted\_h, points, scope\[\], removed, corrected\_capacity\_h, deficit\_h | Valores congelados de LB-S2-v1 |
| risks | id | id, risk, impact, decision, owner, date | Riesgos abiertos; no son datos de indicador |

Unidades: `h` = horas; `%` = puntos porcentuales (10,0 = 10 %); `ratio` = 0–1; `días` = días laborables. `null` nunca significa 0.

## 1\. Línea base (LB-S2-v1)

| Dato | Valor | Unidad | Nota |
| ---| ---| ---| --- |
| Sprint | Sprint 2 | — | 09/11/2026–20/11/2026; 23/11 es Review/cierre, no día de burndown |
| Fecha de línea base | 2026-11-09 | fecha | Antes del primer corte (d0) |
| B0 · trabajo total | 158.0 | h | 144,5 HU + 13,5 control; 25 tareas hoja |
| H0 · horas de HU | 144.5 | h | 18 subtareas de HU-01, 02, 04, 05, 07 y 11 |
| Horas de control | 13.5 | h | CTRL-1 a CTRL-7 |
| N0 · HU comprometidas | 6 | HU | HU-01, HU-02, HU-04, HU-05, HU-07, HU-11 |
| Personas | 9 | personas | Responsables con carga en el Sprint |
| Capacidad de tareas por persona | 18.7 | h/persona | 168 h / 9 = 18,67 ≈ 18,7 (180 − 12 de reuniones) |
| Capacidad total de planificación | 180.0 | h | 9 personas × 10 h/semana × 2 semanas |
| Reuniones y coordinación | 12.0 | h | Del conjunto del equipo |
| Imprevistos | 9.0 | h | Reserva del Sprint |
| Sin comprometer | 1.0 | h | Margen no asignado |
| Puntos de sprint | 42 | puntos | Declarados en la lista; no verificados individualmente. No convertir a horas. |
| Alcance retirado | HU-16 · T1 (9,5 h) vuelve al Backlog | — | Del alcance inicial |
| Capacidad corregida | 108.0 | h | Tras eventos P6; usada para el déficit |
| Déficit | 50.0 | h | 158 − 108; eventos P6; decisión pendiente en CTRL-4 (10/11). |
| HU aceptada | Estado Completados + criterios vigentes con evidencia + DoD + 0 defectos críticos; «En revisión» no cuenta. | — | «En revisión» no cuenta |

## 2\. Registro diario

Cortes d1–d10 al cierre de cada día laborable (09–20/11). El 23/11 es frontera/cierre, no un día 11 de burndown. `—` = pendiente; no rellenar con 0.

| Fecha | Corte | Etiqueta | Restante ideal h | Restante real h | Desviación h | Desviación % | HU aceptadas | Horas aceptadas h | Tareas bloqueadas | Días-bloqueo | Críticos abiertos | Horas registradas h | Notas |
| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| --- |
| 2026-11-09 | d0 | antes de trabajar | 158.0 | 158.0 | 0.0 | 0.0 | 0 | 0.0 | 0 | 0 | 0 | 0.0 | Línea base congelada LB-S2-v1, antes de trabajar. Las 1,25 h de CTRL-1 se imputan en d1. |
| 2026-11-09 | d1 | cierre | 142.2 | 158.0 | 15.8 | 10.0 | 0 | 0.0 | 0 | 0 | 0 | 1.25 | Cierre reconstruido: 0 hojas completadas. KPI-2 = 10,0 % (verde). 1,25 h en CTRL-1. |
| 2026-11-10 | d2 | cierre | 126.4 | 153.0 | 26.6 | 16.8 | 0 | 0.0 | 0 | 0 | 0 | 2.25 | Cierre 10/11 19:02 Europe/Madrid. KPI-2 = 16,8 % (ámbar). HU-04 · T1 completada (5 h); 0 HU aceptadas. 0 bloqueos y 0 críticos. |
| 2026-11-11 | d3 | cierre | 110.6 | 148.0 | 37.4 | 23.7 | 0 | 0.0 | 0 | 0 | 0 | 2.25 | Cierre 11/11 19:01 Europe/Madrid. KPI-2 = 23,7 % (rojo). HU-11 · T1 completada. H1 no cumplido. 0 HU aceptadas, 0 bloqueos, 0 críticos. |
| 2026-11-12 | d4 | cierre | 94.8 | 133.0 | 38.2 | 24.2 | 0 | 0.0 | 1 | 1 | 0 | 3.42 | Cierre 12/11 19:03 Europe/Madrid. KPI-2 = 24,2 % (rojo). CTRL-1, HU-01 · T1 y HU-05 · T1 completadas. H1 sigue sin cumplirse (KPI-3 ámbar, 1 día). 1 bloqueo (HU-05 · T2), 0 críticos, 0 HU aceptadas. |
| 2026-11-13 | d5 | cierre | 79.0 | 115.0 | 36.0 | 22.8 | 0 | 0.0 | 1 | 2 | 0 | 3.42 | Cierre 13/11 19:02 Europe/Madrid. KPI-2 = 22,8 % (rojo). HU-02 · T1 y HU-01 · T2 completadas. H1 sigue sin cumplirse (KPI-3 rojo, 2 días). 1 bloqueo (HU-05 · T2), días-bloqueo 2, 0 críticos, 0 HU aceptadas. |
| 2026-11-16 | d6 | cierre | 63.2 | 105.0 | 41.8 | 26.5 | 0 | 0.0 | 0 | 2 | 0 | 7.74 | Cierre 16/11 19:00 Europe/Madrid. KPI-2 = 26,5 % (rojo). HU-07 · T1 y HU-04 · T3 completadas. H1 cubierto con retraso. HU-05 · T2 en revisión (0 bloqueos, días-bloqueo 2). CTRL-5 vence hoy y sigue abierta. 0 críticos, 0 HU aceptadas. |
| 2026-11-17 | d7 | cierre | 47.4 | 88.5 | 41.1 | 26.0 | 0 | 0.0 | 0 | 2 | 0 | 8.98 | Cierre 17/11 19:00 Europe/Madrid. KPI-2 = 26,0 % (rojo). HU-02 · T2 y HU-01 · T3 completadas. H2: 4 T2 en revisión. CTRL-5 sigue abierta. 0 bloqueos, 0 críticos, 0 HU aceptadas. |
| 2026-11-18 | d8 | cierre | 31.6 | 43.5 | 11.9 | 7.5 | 0 | 0.0 | 0 | 2 | 0 | 29.23 | Cierre 18/11 19:01 Europe/Madrid. KPI-2 = 7,5 % (verde). Restante 43,5 h. Completadas hoy HU-02 · T2, HU-04 · T2, HU-11 · T2, HU-07 · T2, HU-02 · T3 y CTRL-4. Siguen abiertas HU-05 · T2 (12 h, en revisión), las T3 de HU-05, HU-07 y HU-11 (7 h cada una, sin empezar y con vencimiento el 19/11) y CTRL-2, CTRL-3, CTRL-5, CTRL-6 y CTRL-7 (10,5 h; CTRL-5 devuelta a en curso por el revisor). 0 bloqueos, 0 críticos, 0 HU aceptadas. |
| 2026-11-19 | d9 | cierre | 15.8 | 36.5 | 20.7 | 13.1 | 0 | 0.0 | 0 | 2 | 0 | 29.61 | Cierre 19/11 19:00 Europe/Madrid. KPI-2 = 13,1 % (ámbar). Restante 36,5 h: HU-05 · T2 (12 h, en revisión), la T3 de HU-05 (7 h, Zehra) y la de HU-11 (7 h, Daniil), que vencían hoy y siguen en sprint backlog, más CTRL-2, CTRL-3, CTRL-5, CTRL-6 y CTRL-7 (10,5 h). Sin tareas completadas durante el día. H3 no se cumple: 4 de 6 T3. 0 bloqueos, 0 críticos, 0 HU aceptadas. |
| 2026-11-20 | d10 | cierre | 0.0 | — | — | — | — | — | — | — | — | — | Pendiente del cierre diario (CTRL-2); null ≠ 0. |

## 3\. Indicadores

### 3.1 Definición

| Código | Nombre | Audiencia | Fórmula | Unidad | Frecuencia | Responsable |
| ---| ---| ---| ---| ---| ---| --- |
| KPI-1 | Compromiso cumplido | Progreso · externo | HU aceptadas / 6 y Σ estimación HU aceptadas / 144,5 h | ratio / h | Review/cierre; cortes informativos H2 y H3 | Alejandro (CTRL-6/7); calidad: Fernando (CTRL-3) |
| KPI-2 | Desviación del trabajo restante | Entrega · interno, semáforo externo | R(d) = Σ estimación de tareas hoja abiertas; I(d) = 158 × max(0, 1 − d/10); (R − I) / 158 | h / % | Cada cierre laborable (CTRL-2) | Alejandro calcula; Laura revisa |
| KPI-3 | Retraso de hitos | Planificación · externo | Días laborables entre fecha real (o corte) y objetivo: H1 11/11, H2 17/11, H3 19/11 | días laborables | En cada hito y a diario mientras esté vencido | Alejandro (CTRL-2); validan responsables/revisores |
| KPI-4 | Defectos críticos abiertos | Calidad · externo e interno | Nº de subtareas DEF abiertas con prioridad Urgente; antigüedad del más antiguo en días laborables | conteo / días laborables | Desde la primera prueba/prototipo y cada laborable | Fernando registra/calcula (CTRL-3); Alejandro revisa |
| M-5 | Desviación del esfuerzo | Planificación · interno | Σ tiempo real (responsable + revisor) / Σ estimación − 1, en tareas completadas con registro | % | Al completar; agregados CTRL-5/7 | Cada participante registra; Alejandro calcula; Damián revisa |
| M-6 | Bloqueos | Flujo · interno | Nº de tareas en «Necesita ayuda» y Σ intervalos laborables bloqueados (días-bloqueo) | conteo / días | Transición inmediata y corte diario (CTRL-2) | Responsables notifican; Alejandro calcula; Laura revisa |
| M-7 | Carga frente a capacidad restante | Equipo · interno | carga(p) / capacidad(p); carga = trabajo restante + revisiones pendientes; capacidad = disponibilidad restante − reuniones − reserva | ratio | Planning; 10 y 16/11 (CTRL-4); ante ausencias o cambios | Laura calcula con cada persona; Alejandro revisa |

### 3.2 Umbrales y datos

| Código | Verde | Ámbar | Rojo | Datos |
| ---| ---| ---| ---| --- |
| KPI-1 | ≥ 5/6 y ≥ 80 % de horas | 4/6 o 60–<80 % | ≤ 3/6 o < 60 % | Estado Completados + criterios vigentes con evidencia + DoD + 0 críticos |
| KPI-2 | ≤ 10 % (≤ 15,8 h) | \> 10–20 % (15,8–31,6 h) | \> 20 % (> 31,6 h) | Estados y estimaciones congeladas de 18 subtareas HU + 7 CTRL |
| KPI-3 | 0 días | 1 día | ≥ 2 días | Fecha real de transición, no fecha de modificación |
| KPI-4 | 0 | 1 crítico con antigüedad < 1 día laborable | ≥ 2 críticos o 1 con antigüedad ≥ 1 día | ID, HU afectada, severidad, estado, detección, responsable y evidencia. Si falta o no es válida la fecha de detección, marcar «Revisar registro DEF» y corregir el dato, no clasificarlo como ámbar. |
| M-5 | |desviación| ≤ 20 % | \> 20–40 % | \> 40 % | Tiempo registrado confirmado; sin registro o estimación 0 → sin dato |
| M-6 | 0 tareas > 1 día | 1–2 tareas > 1 día | ≥ 3 simultáneas o > 5 días-bloqueo acumulados | Entrada/salida, causa y quién desbloquea; intervalos abiertos se cortan en la fecha de medición |
| M-7 | ≤ 1,0 | \> 1,0–1,1 (exige reasignar o confirmar) | \> 1,1 o tareas sin responsable | Disponibilidad diaria, reuniones, trabajo restante y reparto de revisiones; 18,7 h es referencia de línea base, no capacidad fija |

## 4\. Auditoría de tareas

Leída de ClickUp el 2026-11-17T18:00:21Z. 18 subtareas HU + 7 tareas CTRL. Las HU y CTRL padre son contenedores y no se incluyen en la comprobación de hoja.

### 4.1 Subtareas HU

| HU | Tipo | Task ID | Tarea | Responsable | Revisor | Fuente revisor | Estimación h | Inicio | Vencimiento | Hito | Estado | Checks OK | Notas |
| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| --- |
| HU-01 | T1 | 869fc68ek | T1 - Definir datos de cuenta, validaciones y flujo de sesión | Laura | Damián Verde, Germán Torres Tendero | field | 3.5 | 2026-11-09 | 2026-11-11 | H1 | completados | true |  |
| HU-01 | T2 | 869fc68h6 | T2 - Implementar registro, autenticación y cierre de sesión en API e interfaz | Damián Verde | María del Mar Madrid Delgado | field | 14.0 | 2026-11-12 | 2026-11-17 | H2 | completados | true |  |
| HU-01 | T3 | 869fc68p3 | T3 - Probar altas, duplicados, credenciales inválidas y acceso tras cerrar sesión | Germán Torres Tendero | Vicente Durán Morales | field | 4.5 | 2026-11-18 | 2026-11-19 | H3 | completados | true |  |
| HU-02 | T1 | 869fc6agd | T1 - Diseñar formulario, categorías iniciales y contrato de creación del reporte | Laura | María del Mar Madrid Delgado | field | 4.0 | 2026-11-09 | 2026-11-11 | H1 | completados | true |  |
| HU-02 | T2 | 869fc6ah1 | T2 - Implementar captura de ubicación, validación y persistencia del reporte | Fernando Bravo Torres | Damián Verde | field | 12.0 | 2026-11-12 | 2026-11-17 | H2 | completados | true |  |
| HU-02 | T3 | 869fc6aht | T3 - Probar envío correcto, datos incompletos, GPS no disponible y fallo de conexión | María del Mar Madrid Delgado | Germán Torres Tendero | field | 5.0 | 2026-11-18 | 2026-11-19 | H3 | sprint backlog | true |  |
| HU-04 | T1 | 869fc6ucj | T1 - Definir proximidad, duplicados y tratamiento de cambios de opinión | Laura | Vicente Durán Morales | field | 5.0 | 2026-11-09 | 2026-11-11 | H1 | completados | true |  |
| HU-04 | T2 | 869fc6udf | T2 - Implementar registro de confirmaciones y rechazos con control de acceso | Fernando Bravo Torres | Germán Torres Tendero | field | 9.0 | 2026-11-12 | 2026-11-17 | H2 | en revisión | true |  |
| HU-04 | T3 | 869fc6vwh | T3 - Probar proximidad, aportaciones duplicadas y usuarios sin autorización | Germán Torres Tendero | Damián Verde | field | 5.0 | 2026-11-18 | 2026-11-19 | H3 | completados | true |  |
| HU-05 | T1 | 869fc6zvu | T1 - Prototipar reglas de confianza y simular reportes falsos y confirmaciones coordinadas | Zehra Sayın | Laura | field | 9.5 | 2026-11-09 | 2026-11-11 | H1 | completados | true |  |
| HU-05 | T2 | 869fc6zwa | T2 - Implementar evaluación de confianza y transición de verificación con auditoría | Damián Verde | Fernando Bravo Torres | field | 12.0 | 2026-11-12 | 2026-11-17 | H2 | en revisión | true |  |
| HU-05 | T3 | 869fc6zwx | T3 - Probar casos de frontera del umbral y efectos de rechazos y duplicados | Zehra Sayın | Vicente Durán Morales | field | 7.0 | 2026-11-18 | 2026-11-19 | H3 | sprint backlog | true |  |
| HU-07 | T1 | 869fc71bc | T1 - Definir matriz de destinatarios y tratamiento de urgencias no verificadas | Daniil Nemchenko | María del Mar Madrid Delgado | field | 5.0 | 2026-11-09 | 2026-11-11 | H1 | completados | true |  |
| HU-07 | T2 | 869fc71by | T2 - Implementar distribución, notificaciones y registro de entrega con reintentos | Vicente Durán Morales | Damián Verde | field | 16.0 | 2026-11-12 | 2026-11-17 | H2 | en revisión | true |  |
| HU-07 | T3 | 869fc71cd | T3 - Probar destinatarios, horario no laboral, fallos y duplicados | María del Mar Madrid Delgado | Laura | field | 7.0 | 2026-11-18 | 2026-11-19 | H3 | sprint backlog | true |  |
| HU-11 | T1 | 869fc765z | T1 - Definir matriz mínima de roles, operaciones y ámbitos | Laura | Alejandro Cerezo Contreras | field | 5.0 | 2026-11-09 | 2026-11-11 | H1 | completados | true |  |
| HU-11 | T2 | 869fc767g | T2 - Implementar gestión administrativa y autorización en el backend | Vicente Durán Morales | Germán Torres Tendero | field | 14.0 | 2026-11-12 | 2026-11-17 | H2 | en revisión | true |  |
| HU-11 | T3 | 869fc76h6 | T3 - Probar escalada de privilegios, acceso entre organismos y revocación | Daniil Nemchenko | Fernando Bravo Torres | description | 7.0 | 2026-11-18 | 2026-11-19 | H3 | sprint backlog | true | Revisor documentado en descripción; campo Revisores no escribible con el plan actual. |

### 4.2 Tareas de control

| Grupo | Tipo | Task ID | Tarea | Responsable | Revisor | Fuente revisor | Estimación h | Inicio | Vencimiento | Hito | Estado | Checks OK | Notas |
| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| ---| --- |
| CTRL | CTRL-1 | 1ammuym2b2a | CTRL-1 - Preparar la línea base de datos y el registro de indicadores | Alejandro Cerezo Contreras | Damián Verde | field | 2.0 | 2026-11-09 | 2026-11-09 | CTRL | completados | true | Tarea de control con ventana propia. |
| CTRL | CTRL-2 | 1ammuym2b2b | CTRL-2 - Registrar a diario avance, bloqueos y trabajo restante | Alejandro Cerezo Contreras | Laura | field | 2.5 | 2026-11-09 | 2026-11-23 | CTRL | sprint backlog | true | Tarea de control con ventana propia. |
| CTRL | CTRL-3 | 1ammuym2b2c | CTRL-3 - Seguir defectos y resultados de pruebas de aceptación | Fernando Bravo Torres | Alejandro Cerezo Contreras | field | 2.0 | 2026-11-09 | 2026-11-23 | CTRL | en curso | true | Tarea de control con ventana propia. |
| CTRL | CTRL-4 | 1ammuym2b2d | CTRL-4 - Revisar la carga de trabajo y el reparto | Laura | Alejandro Cerezo Contreras | field | 1.0 | 2026-11-10 | 2026-11-17 | CTRL | en revisión | true | Tarea de control con ventana propia. |
| CTRL | CTRL-5 | 1ammuym2b2e | CTRL-5 - Revisión de control intermedia y decisiones correctivas | Alejandro Cerezo Contreras | Damián Verde | field | 1.5 | 2026-11-16 | 2026-11-16 | CTRL | sprint backlog | true | Tarea de control con ventana propia. |
| CTRL | CTRL-6 | 1ammuym2b2f | CTRL-6 - Elaborar los informes de estado para profesores y equipo MVMQF | Alejandro Cerezo Contreras | Damián Verde | field | 2.5 | 2026-11-11 | 2026-11-23 | CTRL | sprint backlog | true | Tarea de control con ventana propia. |
| CTRL | CTRL-7 | 1ammuym2b2g | CTRL-7 - Cerrar los KPIs del Sprint y ajustar la línea base | Alejandro Cerezo Contreras | Fernando Bravo Torres | field | 2.0 | 2026-11-23 | 2026-11-23 | CTRL | sprint backlog | true | Tarea de control con ventana propia. |

### 4.3 Resumen
*   18/18 subtareas HU con responsable, revisor distinto, estimación, inicio y vencimiento según H1/H2/H3 (17 con campo «Revisores»; HU-11 · T3 en descripción).
*   25/25 tareas hoja (18 HU + 7 CTRL) con responsable, estimación y vencimiento: `{'assignee': True, 'estimate': True, 'due': True}`.
*   HU-02 y sus 3 subtareas permanecen en «Sprint Backlog»: `False`.
*   Estados actuales: completados=11, en revisión=5, en curso=1, sprint backlog=8.
*   Carga de revisiones: Damián Verde=7, Germán Torres Tendero=4, Alejandro Cerezo Contreras=3, Fernando Bravo Torres=3, Laura=3, María del Mar Madrid Delgado=3, Vicente Durán Morales=3.

## 5\. Riesgos y decisiones abiertas

| ID | Riesgo | Impacto | Decisión / siguiente paso | Responsable | Fecha |
| ---| ---| ---| ---| ---| --- |
| R-01 | Déficit de planificación: 158 h de tareas frente a 108 h de capacidad corregida por eventos P6 (\~50 h). | Alto | Revisar en CTRL-4 (10/11); no cambiar la línea base sin acuerdo. Orden de retirada: HU-07 → HU-05 → HU-04. | Alejandro / Laura | 2026-11-10 |
| R-02 | Carga de revisión desequilibrada: Damián 7 revisiones; Zehra y Daniil 0. | Medio | Reequilibrar en CTRL-4 con datos de M-7; no asignar más revisiones a Damián sin revisar su capacidad. | Laura / Alejandro | 2026-11-10 |
| R-03 | El campo «Revisores» no es escribible con el plan actual. | Bajo | HU-11 · T3 documenta el revisor en la descripción (Fernando Bravo Torres, propuesta P4). Si cambia el plan, poblar el campo. | Alejandro | 2026-11-09 |
| R-04 | Solo 8,98 h registradas, repartidas entre CTRL-1, CTRL-4, HU-01 · T3, HU-04 · T1, HU-07 · T1, HU-07 · T2 y HU-11 · T2. M-5 sigue con poca muestra. | Medio | Cada persona registra con timer o entrada manual; no rellenar con la estimación. | Equipo | diario |
| R-05 | Dos snapshots xlsx con el mismo nombre (v1 18 filas, v2 25 filas). | Bajo | La fuente canónica es docs/control en el repositorio. El Doc de ClickUp y los xlsx quedan congelados. | Alejandro | 2026-11-09 |
| R-06 | Custom task IDs deshabilitados: «CTRL-1» no resuelve por API. | Bajo | Usar IDs internos (1ammuym2b2a, etc.) en API y agentes; el nombre visible no es clave. | Alejandro | 2026-11-09 |
| R-07 | Línea base pendiente de aprobación formal. | Medio | Damián revisa CTRL-1; no cambiar B0/N0/H0 hasta aprobación. Cambios de alcance exigen versión nueva. | Damián | 2026-11-09 |

## 6\. Procedimiento de actualización

1. Leer `docs/control/registro-sprint-2.json`.
2. Actualizar solo los datos que hayan cambiado; recalcular derivados (desviación, sumas, checks).
3. Regenerar este markdown desde el JSON y actualizar `meta.updated_at_utc`.
4. Validar las invariantes de §6.4. No escribir el Doc de ClickUp.
5. Si cambia la línea base (B0/N0/H0/alcance), crear `LB-S2-v2`, conservar la anterior en el changelog y no sobrescribir el histórico.
6. Corte diario: al cierre, rellenar dN; no tocar filas futuras; `null` no es 0.

### 6.4 Invariantes de validación

```json
{
  "daily_rows": 11,
  "daily_filled_rows": 10,
  "audit_rows": 25,
  "hu_subtasks": 18,
  "ctrl_tasks": 7,
  "sum_estimate_h": 158.0,
  "sum_hu_estimate_h": 144.5,
  "sum_ctrl_estimate_h": 13.5,
  "all_leaf_have_assignee": true,
  "all_leaf_have_estimate": true,
  "all_leaf_have_due": true,
  "all_hu_reviewers_defined": true,
  "all_hu_reviewers_differ": true,
  "hu02_all_sprint_backlog": false,
  "baseline_B0_h": 158.0,
  "N0": 6,
  "people": 9,
  "open_remaining_h": 36.5,
  "logged_hours": 29.61,
  "blocked_tasks": 0,
  "critical_defects": 0
}
```

## 7\. Snapshot JSON (fuente máquina)

```json
{
  "meta": {
    "doc_title": "CTRL-1 · Registro de control — Sprint 2 (LB-S2-v1)",
    "doc_id": "2kxv5w3j-1172",
    "page_id": "2kxv5w3j-132",
    "doc_url": "https://app.clickup.com/90122154098/v/dc/2kxv5w3j-1172/2kxv5w3j-132",
    "workspace_id": "90122154098",
    "task_id": "1ammuym2b2a",
    "task_url": "https://app.clickup.com/t/1ammuym2b2a",
    "list_id": "1500450000000263",
    "list_url": "https://app.clickup.com/90122154098/v/l/li/1500450000000263",
    "folder_id": "901215373357",
    "space_id": "901210725917",
    "owner": "Alejandro Cerezo Contreras",
    "reviewer": "Damián Verde",
    "status": "completados",
    "doc_version": "LB-S2-v1",
    "schema_version": "1.1",
    "updated_at_utc": "2026-11-19T18:00:43Z",
    "timezone": "Europe/Madrid",
    "canonical": "repo:docs/control/registro-sprint-2.json",
    "snapshots": [
      "CTRL-1_Registro_control_Sprint2.xlsx (v1, 18 filas)",
      "CTRL-1_Registro_control_Sprint2.xlsx (v2, 25 filas)"
    ],
    "custom_task_ids": false,
    "source": "ClickUp lista Sprint 2 (tablero) + repo docs/control + P5 COORDIA_P5_Metricas_KPIs.md",
    "mcp_note": "La fuente canónica es el repositorio (docs/control/registro-sprint-2.json). El Doc de ClickUp 2kxv5w3j-132 está congelado desde 2026-11-10T13:22:14Z: no hacer PUT. La API de tareas de ClickUp sigue usándose para estado, comentarios y tiempo.",
    "repo_markdown": "docs/control/registro-sprint-2.md",
    "repo_json": "docs/control/registro-sprint-2.json",
    "clickup_doc_status": "frozen",
    "clickup_doc_frozen_at": "2026-11-10T13:22:14Z"
  },
  "baseline": {
    "doc_version": "LB-S2-v1",
    "schema_version": "1.0",
    "baseline_date": "2026-11-09",
    "sprint_start": "2026-11-09",
    "sprint_end": "2026-11-20",
    "sprint_boundary": "2026-11-23",
    "B0_h": 158.0,
    "H0_h": 144.5,
    "control_h": 13.5,
    "N0": 6,
    "people": 9,
    "capacity_per_person_h": 18.7,
    "capacity_derivation": "168 h / 9 = 18,67 ≈ 18,7 (180 − 12 de reuniones)",
    "capacity_caveat": "Referencia de línea base; M-7 usa capacidad restante declarada, no 18,7 fijo.",
    "total_capacity_h": 180.0,
    "meetings_h": 12.0,
    "contingency_h": 9.0,
    "uncommitted_h": 1.0,
    "points": 42,
    "points_note": "Declarados en la lista; no verificados individualmente. No convertir a horas.",
    "scope": [
      "HU-01",
      "HU-02",
      "HU-04",
      "HU-05",
      "HU-07",
      "HU-11"
    ],
    "removed": "HU-16 · T1 (9,5 h) vuelve al Backlog",
    "accepted_definition": "Estado Completados + criterios vigentes con evidencia + DoD + 0 defectos críticos; «En revisión» no cuenta.",
    "corrected_capacity_h": 108.0,
    "deficit_h": 50.0,
    "deficit_note": "158 − 108; eventos P6; decisión pendiente en CTRL-4 (10/11)."
  },
  "daily": [
    {
      "date": "2026-11-09",
      "cut": "d0",
      "label": "antes de trabajar",
      "ideal_h": 158.0,
      "real_h": 158.0,
      "deviation_h": 0.0,
      "deviation_pct": 0.0,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 0,
      "critical_defects": 0,
      "logged_hours": 0.0,
      "notes": "Línea base congelada LB-S2-v1, antes de trabajar. 25 tareas hoja abiertas, 0 HU aceptadas. Las 1,25 h de CTRL-1 se registraron por la tarde y se imputan en d1."
    },
    {
      "date": "2026-11-09",
      "cut": "d1",
      "label": "cierre",
      "ideal_h": 142.2,
      "real_h": 158.0,
      "deviation_h": 15.8,
      "deviation_pct": 10.0,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 0,
      "critical_defects": 0,
      "logged_hours": 1.25,
      "notes": "Cierre reconstruido el 10/11: ninguna tarea hoja en completados, así que el restante real sigue en 158 h. Desviación 15,8 h = 10,0 % (KPI-2 verde, umbral ≤ 10 %). Tiempo registrado: 1,25 h en CTRL-1 (15:54–17:09 Europe/Madrid). 0 tareas en «necesita ayuda», 0 defectos DEF urgentes, 0 HU aceptadas."
    },
    {
      "date": "2026-11-10",
      "cut": "d2",
      "label": "cierre",
      "ideal_h": 126.4,
      "real_h": 153.0,
      "deviation_h": 26.6,
      "deviation_pct": 16.8,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 0,
      "critical_defects": 0,
      "logged_hours": 2.25,
      "notes": "Cierre del 10/11 a las 19:02 Europe/Madrid. Restante real 153,0 h frente a ideal 126,4 h: desviación 26,6 h = 16,8 % (KPI-2 ámbar). HU-04 · T1 (869fc6ucj, 5 h) está en completados; ninguna HU padre está aceptada. En revisión: CTRL-1 (2 h) y tres T1 (HU-01 3,5 h, HU-02 4 h, HU-11 5 h). En curso: HU-07 · T1 (5 h). 0 tareas en «necesita ayuda», 0 defectos DEF urgentes. Horas registradas acumuladas: 2,25 h."
    },
    {
      "date": "2026-11-11",
      "cut": "d3",
      "label": "cierre",
      "ideal_h": 110.6,
      "real_h": 148.0,
      "deviation_h": 37.4,
      "deviation_pct": 23.7,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 0,
      "critical_defects": 0,
      "logged_hours": 2.25,
      "notes": "Cierre del 11/11 a las 19:01 Europe/Madrid. Restante real 148,0 h frente a ideal 110,6 h: desviación 37,4 h = 23,7 % (KPI-2 rojo, por encima del 20 %). Completadas HU-04 · T1 y HU-11 · T1 (10 h). Ninguna HU padre aceptada. H1 no está cumplido: HU-01 · T1 y HU-02 · T1 siguen en revisión (7,5 h); HU-07 · T1 en curso (5 h) y HU-05 · T1 en sprint backlog (9,5 h). CTRL-1 sigue en revisión. 0 bloqueos, 0 defectos DEF urgentes. Horas registradas acumuladas: 2,25 h."
    },
    {
      "date": "2026-11-12",
      "cut": "d4",
      "label": "cierre",
      "ideal_h": 94.8,
      "real_h": 133.0,
      "deviation_h": 38.2,
      "deviation_pct": 24.2,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 1,
      "block_days": 1,
      "critical_defects": 0,
      "logged_hours": 3.42,
      "notes": "Cierre del 12/11 a las 19:03 Europe/Madrid. Restante real 133,0 h frente a ideal 94,8 h: desviación 38,2 h = 24,2 % (KPI-2 rojo, por encima del 20 %). Completadas desde d3: CTRL-1 (2 h), HU-01 · T1 (3,5 h) y HU-05 · T1 (9,5 h). Ninguna HU padre aceptada. H1 sigue sin cumplirse: HU-02 · T1 (4 h) y HU-07 · T1 (5 h) siguen en revisión; un día laborable de retraso (KPI-3 ámbar). En revisión también HU-01 · T2 (14 h). HU-05 · T2 (869fc6zwa, 12 h) está en «necesita ayuda»: 1 bloqueo, días-bloqueo 1. 0 defectos DEF urgentes. Horas registradas acumuladas: 3,42 h."
    },
    {
      "date": "2026-11-13",
      "cut": "d5",
      "label": "cierre",
      "ideal_h": 79.0,
      "real_h": 115.0,
      "deviation_h": 36.0,
      "deviation_pct": 22.8,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 1,
      "block_days": 2,
      "critical_defects": 0,
      "logged_hours": 3.42,
      "notes": "Cierre del 13/11 a las 19:02 Europe/Madrid. Restante real 115,0 h frente a ideal 79,0 h: desviación 36,0 h = 22,8 % (KPI-2 rojo, por encima del 20 %). Completadas desde d4: HU-02 · T1 (4 h) y HU-01 · T2 (14 h). Ninguna HU padre aceptada: siguen en sprint backlog y con los criterios de aceptación sin resolver. H1 sigue sin cumplirse: HU-07 · T1 (5 h, 869fc71bc) sigue en revisión; dos días laborables de retraso (KPI-3 rojo). HU-05 · T2 (869fc6zwa, 12 h) sigue en «necesita ayuda»: 1 bloqueo, días-bloqueo 2. 0 defectos DEF urgentes. Horas registradas acumuladas: 3,42 h."
    },
    {
      "date": "2026-11-16",
      "cut": "d6",
      "label": "cierre",
      "ideal_h": 63.2,
      "real_h": 105.0,
      "deviation_h": 41.8,
      "deviation_pct": 26.5,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 2,
      "critical_defects": 0,
      "logged_hours": 7.74,
      "notes": "Cierre del 16/11 a las 19:00 Europe/Madrid. Restante real 105,0 h frente a ideal 63,2 h: desviación 41,8 h = 26,5 % (KPI-2 rojo, por encima del 20 %). Completadas desde d5: HU-07 · T1 (5 h) y HU-04 · T3 (5 h). Ninguna HU padre aceptada: siguen en sprint backlog y con los criterios de aceptación sin resolver. H1 queda cubierto con retraso: HU-07 · T1 pasó a completados. HU-05 · T2 (869fc6zwa, 12 h) sale de «necesita ayuda» y está en revisión: 0 bloqueos, días-bloqueo 2. En revisión las T2 de HU-02, HU-04, HU-05, HU-07 y HU-11, y HU-01 · T3. CTRL-5 (1,5 h) vence hoy y sigue en sprint backlog. 0 defectos DEF urgentes. Horas registradas acumuladas: 7,74 h."
    },
    {
      "date": "2026-11-17",
      "cut": "d7",
      "label": "cierre",
      "ideal_h": 47.4,
      "real_h": 88.5,
      "deviation_h": 41.1,
      "deviation_pct": 26.0,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 2,
      "critical_defects": 0,
      "logged_hours": 8.98,
      "notes": "Cierre del 17/11 a las 19:00 Europe/Madrid. Restante real 88,5 h frente a ideal 47,4 h: desviación 41,1 h = 26,0 % (KPI-2 rojo, por encima del 20 %). Completadas desde d6: HU-02 · T2 (12 h) y HU-01 · T3 (4,5 h). Ninguna HU padre aceptada: siguen en sprint backlog y con los criterios de aceptación sin resolver. H2: las T2 de HU-04, HU-05, HU-07 y HU-11 siguen en revisión (51 h). CTRL-4 (1 h) pasa a revisión; CTRL-5 (1,5 h) sigue en sprint backlog un día después de su vencimiento. 0 bloqueos, días-bloqueo 2. 0 defectos DEF urgentes. Horas registradas acumuladas: 8,98 h."
    },
    {
      "date": "2026-11-18",
      "cut": "d8",
      "label": "cierre",
      "ideal_h": 31.6,
      "real_h": 43.5,
      "deviation_h": 11.9,
      "deviation_pct": 7.5,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 2,
      "critical_defects": 0,
      "logged_hours": 29.23,
      "notes": "Cierre 18/11 19:01 Europe/Madrid. KPI-2 = 7,5 % (verde). Restante 43,5 h. Completadas hoy HU-02 · T2, HU-04 · T2, HU-11 · T2, HU-07 · T2, HU-02 · T3 y CTRL-4. Siguen abiertas HU-05 · T2 (12 h, en revisión), las T3 de HU-05, HU-07 y HU-11 (7 h cada una, sin empezar y con vencimiento el 19/11) y CTRL-2, CTRL-3, CTRL-5, CTRL-6 y CTRL-7 (10,5 h; CTRL-5 devuelta a en curso por el revisor). 0 bloqueos, 0 críticos, 0 HU aceptadas."
    },
    {
      "date": "2026-11-19",
      "cut": "d9",
      "label": "cierre",
      "ideal_h": 15.8,
      "real_h": 36.5,
      "deviation_h": 20.7,
      "deviation_pct": 13.1,
      "hu_accepted": 0,
      "hours_accepted_h": 0.0,
      "blocked_tasks": 0,
      "block_days": 2,
      "critical_defects": 0,
      "logged_hours": 29.61,
      "notes": "Cierre 19/11 19:00 Europe/Madrid. KPI-2 = 13,1 % (ámbar). Restante 36,5 h: HU-05 · T2 (12 h, en revisión), la T3 de HU-05 (7 h, Zehra) y la de HU-11 (7 h, Daniil), que vencían hoy y siguen en sprint backlog, más CTRL-2, CTRL-3, CTRL-5, CTRL-6 y CTRL-7 (10,5 h). Sin tareas completadas durante el día. H3 no se cumple: 4 de 6 T3. 0 bloqueos, 0 críticos, 0 HU aceptadas."
    },
    {
      "date": "2026-11-20",
      "cut": "d10",
      "label": "cierre",
      "ideal_h": 0.0,
      "real_h": null,
      "deviation_h": null,
      "deviation_pct": null,
      "hu_accepted": null,
      "hours_accepted_h": null,
      "blocked_tasks": null,
      "block_days": null,
      "critical_defects": null,
      "logged_hours": null,
      "notes": "Pendiente del cierre diario (CTRL-2); null ≠ 0."
    }
  ],
  "indicators": [
    {
      "code": "KPI-1",
      "name": "Compromiso cumplido",
      "audience": "Progreso · externo",
      "formula": "HU aceptadas / 6 y Σ estimación HU aceptadas / 144,5 h",
      "unit": "ratio / h",
      "frequency": "Review/cierre; cortes informativos H2 y H3",
      "owner": "Alejandro (CTRL-6/7); calidad: Fernando (CTRL-3)",
      "green": "≥ 5/6 y ≥ 80 % de horas",
      "amber": "4/6 o 60–<80 %",
      "red": "≤ 3/6 o < 60 %",
      "data": "Estado Completados + criterios vigentes con evidencia + DoD + 0 críticos"
    },
    {
      "code": "KPI-2",
      "name": "Desviación del trabajo restante",
      "audience": "Entrega · interno, semáforo externo",
      "formula": "R(d) = Σ estimación de tareas hoja abiertas; I(d) = 158 × max(0, 1 − d/10); (R − I) / 158",
      "unit": "h / %",
      "frequency": "Cada cierre laborable (CTRL-2)",
      "owner": "Alejandro calcula; Laura revisa",
      "green": "≤ 10 % (≤ 15,8 h)",
      "amber": "> 10–20 % (15,8–31,6 h)",
      "red": "> 20 % (> 31,6 h)",
      "data": "Estados y estimaciones congeladas de 18 subtareas HU + 7 CTRL"
    },
    {
      "code": "KPI-3",
      "name": "Retraso de hitos",
      "audience": "Planificación · externo",
      "formula": "Días laborables entre fecha real (o corte) y objetivo: H1 11/11, H2 17/11, H3 19/11",
      "unit": "días laborables",
      "frequency": "En cada hito y a diario mientras esté vencido",
      "owner": "Alejandro (CTRL-2); validan responsables/revisores",
      "green": "0 días",
      "amber": "1 día",
      "red": "≥ 2 días",
      "data": "Fecha real de transición, no fecha de modificación"
    },
    {
      "code": "KPI-4",
      "name": "Defectos críticos abiertos",
      "audience": "Calidad · externo e interno",
      "formula": "Nº de subtareas DEF abiertas con prioridad Urgente; antigüedad del más antiguo en días laborables",
      "unit": "conteo / días laborables",
      "frequency": "Desde la primera prueba/prototipo y cada laborable",
      "owner": "Fernando registra/calcula (CTRL-3); Alejandro revisa",
      "green": "0",
      "amber": "1 crítico con antigüedad < 1 día laborable",
      "red": "≥ 2 críticos o 1 con antigüedad ≥ 1 día",
      "data": "ID, HU afectada, severidad, estado, detección, responsable y evidencia. Si falta o no es válida la fecha de detección, marcar «Revisar registro DEF» y corregir el dato, no clasificarlo como ámbar."
    },
    {
      "code": "M-5",
      "name": "Desviación del esfuerzo",
      "audience": "Planificación · interno",
      "formula": "Σ tiempo real (responsable + revisor) / Σ estimación − 1, en tareas completadas con registro",
      "unit": "%",
      "frequency": "Al completar; agregados CTRL-5/7",
      "owner": "Cada participante registra; Alejandro calcula; Damián revisa",
      "green": "|desviación| ≤ 20 %",
      "amber": "> 20–40 %",
      "red": "> 40 %",
      "data": "Tiempo registrado confirmado; sin registro o estimación 0 → sin dato"
    },
    {
      "code": "M-6",
      "name": "Bloqueos",
      "audience": "Flujo · interno",
      "formula": "Nº de tareas en «Necesita ayuda» y Σ intervalos laborables bloqueados (días-bloqueo)",
      "unit": "conteo / días",
      "frequency": "Transición inmediata y corte diario (CTRL-2)",
      "owner": "Responsables notifican; Alejandro calcula; Laura revisa",
      "green": "0 tareas > 1 día",
      "amber": "1–2 tareas > 1 día",
      "red": "≥ 3 simultáneas o > 5 días-bloqueo acumulados",
      "data": "Entrada/salida, causa y quién desbloquea; intervalos abiertos se cortan en la fecha de medición"
    },
    {
      "code": "M-7",
      "name": "Carga frente a capacidad restante",
      "audience": "Equipo · interno",
      "formula": "carga(p) / capacidad(p); carga = trabajo restante + revisiones pendientes; capacidad = disponibilidad restante − reuniones − reserva",
      "unit": "ratio",
      "frequency": "Planning; 10 y 16/11 (CTRL-4); ante ausencias o cambios",
      "owner": "Laura calcula con cada persona; Alejandro revisa",
      "green": "≤ 1,0",
      "amber": "> 1,0–1,1 (exige reasignar o confirmar)",
      "red": "> 1,1 o tareas sin responsable",
      "data": "Disponibilidad diaria, reuniones, trabajo restante y reparto de revisiones; 18,7 h es referencia de línea base, no capacidad fija"
    }
  ],
  "audit": [
    {
      "hu": "HU-01",
      "type": "T1",
      "task_id": "869fc68ek",
      "task": "T1 - Definir datos de cuenta, validaciones y flujo de sesión",
      "assignee": [
        "Laura"
      ],
      "reviewer": [
        "Damián Verde",
        "Germán Torres Tendero"
      ],
      "reviewer_source": "field",
      "estimate_h": 3.5,
      "start": "2026-11-09",
      "due": "2026-11-11",
      "milestone": "H1",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-12T18:03:32Z: completados.",
      "url": "https://app.clickup.com/t/869fc68ek"
    },
    {
      "hu": "HU-01",
      "type": "T2",
      "task_id": "869fc68h6",
      "task": "T2 - Implementar registro, autenticación y cierre de sesión en API e interfaz",
      "assignee": [
        "Damián Verde"
      ],
      "reviewer": [
        "María del Mar Madrid Delgado"
      ],
      "reviewer_source": "field",
      "estimate_h": 14.0,
      "start": "2026-11-12",
      "due": "2026-11-17",
      "milestone": "H2",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-13T18:02:05Z: completados.",
      "url": "https://app.clickup.com/t/869fc68h6"
    },
    {
      "hu": "HU-01",
      "type": "T3",
      "task_id": "869fc68p3",
      "task": "T3 - Probar altas, duplicados, credenciales inválidas y acceso tras cerrar sesión",
      "assignee": [
        "Germán Torres Tendero"
      ],
      "reviewer": [
        "Vicente Durán Morales"
      ],
      "reviewer_source": "field",
      "estimate_h": 4.5,
      "start": "2026-11-18",
      "due": "2026-11-19",
      "milestone": "H3",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-17T18:00:21Z: completados.",
      "url": "https://app.clickup.com/t/869fc68p3"
    },
    {
      "hu": "HU-02",
      "type": "T1",
      "task_id": "869fc6agd",
      "task": "T1 - Diseñar formulario, categorías iniciales y contrato de creación del reporte",
      "assignee": [
        "Laura"
      ],
      "reviewer": [
        "María del Mar Madrid Delgado"
      ],
      "reviewer_source": "field",
      "estimate_h": 4.0,
      "start": "2026-11-09",
      "due": "2026-11-11",
      "milestone": "H1",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-13T18:02:05Z: completados.",
      "url": "https://app.clickup.com/t/869fc6agd"
    },
    {
      "hu": "HU-02",
      "type": "T2",
      "task_id": "869fc6ah1",
      "task": "T2 - Implementar captura de ubicación, validación y persistencia del reporte",
      "assignee": [
        "Fernando Bravo Torres"
      ],
      "reviewer": [
        "Damián Verde"
      ],
      "reviewer_source": "field",
      "estimate_h": 12.0,
      "start": "2026-11-12",
      "due": "2026-11-17",
      "milestone": "H2",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-17T18:00:21Z: completados.",
      "url": "https://app.clickup.com/t/869fc6ah1"
    },
    {
      "hu": "HU-02",
      "type": "T3",
      "task_id": "869fc6aht",
      "task": "T3 - Probar envío correcto, datos incompletos, GPS no disponible y fallo de conexión",
      "assignee": [
        "María del Mar Madrid Delgado"
      ],
      "reviewer": [
        "Germán Torres Tendero"
      ],
      "reviewer_source": "field",
      "estimate_h": 5.0,
      "start": "2026-11-18",
      "due": "2026-11-19",
      "milestone": "H3",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "",
      "url": "https://app.clickup.com/t/869fc6aht"
    },
    {
      "hu": "HU-04",
      "type": "T1",
      "task_id": "869fc6ucj",
      "task": "T1 - Definir proximidad, duplicados y tratamiento de cambios de opinión",
      "assignee": [
        "Laura"
      ],
      "reviewer": [
        "Vicente Durán Morales"
      ],
      "reviewer_source": "field",
      "estimate_h": 5.0,
      "start": "2026-11-09",
      "due": "2026-11-11",
      "milestone": "H1",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-10T18:02:58Z: completados.",
      "url": "https://app.clickup.com/t/869fc6ucj"
    },
    {
      "hu": "HU-04",
      "type": "T2",
      "task_id": "869fc6udf",
      "task": "T2 - Implementar registro de confirmaciones y rechazos con control de acceso",
      "assignee": [
        "Fernando Bravo Torres"
      ],
      "reviewer": [
        "Germán Torres Tendero"
      ],
      "reviewer_source": "field",
      "estimate_h": 9.0,
      "start": "2026-11-12",
      "due": "2026-11-17",
      "milestone": "H2",
      "status": "en revisión",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-16T18:00:21Z: en revisión.",
      "url": "https://app.clickup.com/t/869fc6udf"
    },
    {
      "hu": "HU-04",
      "type": "T3",
      "task_id": "869fc6vwh",
      "task": "T3 - Probar proximidad, aportaciones duplicadas y usuarios sin autorización",
      "assignee": [
        "Germán Torres Tendero"
      ],
      "reviewer": [
        "Damián Verde"
      ],
      "reviewer_source": "field",
      "estimate_h": 5.0,
      "start": "2026-11-18",
      "due": "2026-11-19",
      "milestone": "H3",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-16T18:00:21Z: completados.",
      "url": "https://app.clickup.com/t/869fc6vwh"
    },
    {
      "hu": "HU-05",
      "type": "T1",
      "task_id": "869fc6zvu",
      "task": "T1 - Prototipar reglas de confianza y simular reportes falsos y confirmaciones coordinadas",
      "assignee": [
        "Zehra Sayın"
      ],
      "reviewer": [
        "Laura"
      ],
      "reviewer_source": "field",
      "estimate_h": 9.5,
      "start": "2026-11-09",
      "due": "2026-11-11",
      "milestone": "H1",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-12T18:03:32Z: completados.",
      "url": "https://app.clickup.com/t/869fc6zvu"
    },
    {
      "hu": "HU-05",
      "type": "T2",
      "task_id": "869fc6zwa",
      "task": "T2 - Implementar evaluación de confianza y transición de verificación con auditoría",
      "assignee": [
        "Damián Verde"
      ],
      "reviewer": [
        "Fernando Bravo Torres"
      ],
      "reviewer_source": "field",
      "estimate_h": 12.0,
      "start": "2026-11-12",
      "due": "2026-11-17",
      "milestone": "H2",
      "status": "en revisión",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-16T18:00:21Z: en revisión.",
      "url": "https://app.clickup.com/t/869fc6zwa"
    },
    {
      "hu": "HU-05",
      "type": "T3",
      "task_id": "869fc6zwx",
      "task": "T3 - Probar casos de frontera del umbral y efectos de rechazos y duplicados",
      "assignee": [
        "Zehra Sayın"
      ],
      "reviewer": [
        "Vicente Durán Morales"
      ],
      "reviewer_source": "field",
      "estimate_h": 7.0,
      "start": "2026-11-18",
      "due": "2026-11-19",
      "milestone": "H3",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "",
      "url": "https://app.clickup.com/t/869fc6zwx"
    },
    {
      "hu": "HU-07",
      "type": "T1",
      "task_id": "869fc71bc",
      "task": "T1 - Definir matriz de destinatarios y tratamiento de urgencias no verificadas",
      "assignee": [
        "Daniil Nemchenko"
      ],
      "reviewer": [
        "María del Mar Madrid Delgado"
      ],
      "reviewer_source": "field",
      "estimate_h": 5.0,
      "start": "2026-11-09",
      "due": "2026-11-11",
      "milestone": "H1",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-16T18:00:21Z: completados.",
      "url": "https://app.clickup.com/t/869fc71bc"
    },
    {
      "hu": "HU-07",
      "type": "T2",
      "task_id": "869fc71by",
      "task": "T2 - Implementar distribución, notificaciones y registro de entrega con reintentos",
      "assignee": [
        "Vicente Durán Morales"
      ],
      "reviewer": [
        "Damián Verde"
      ],
      "reviewer_source": "field",
      "estimate_h": 16.0,
      "start": "2026-11-12",
      "due": "2026-11-17",
      "milestone": "H2",
      "status": "en revisión",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-16T18:00:21Z: en revisión.",
      "url": "https://app.clickup.com/t/869fc71by"
    },
    {
      "hu": "HU-07",
      "type": "T3",
      "task_id": "869fc71cd",
      "task": "T3 - Probar destinatarios, horario no laboral, fallos y duplicados",
      "assignee": [
        "María del Mar Madrid Delgado"
      ],
      "reviewer": [
        "Laura"
      ],
      "reviewer_source": "field",
      "estimate_h": 7.0,
      "start": "2026-11-18",
      "due": "2026-11-19",
      "milestone": "H3",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "",
      "url": "https://app.clickup.com/t/869fc71cd"
    },
    {
      "hu": "HU-11",
      "type": "T1",
      "task_id": "869fc765z",
      "task": "T1 - Definir matriz mínima de roles, operaciones y ámbitos",
      "assignee": [
        "Laura"
      ],
      "reviewer": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer_source": "field",
      "estimate_h": 5.0,
      "start": "2026-11-09",
      "due": "2026-11-11",
      "milestone": "H1",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-11T18:01:25Z: completados.",
      "url": "https://app.clickup.com/t/869fc765z"
    },
    {
      "hu": "HU-11",
      "type": "T2",
      "task_id": "869fc767g",
      "task": "T2 - Implementar gestión administrativa y autorización en el backend",
      "assignee": [
        "Vicente Durán Morales"
      ],
      "reviewer": [
        "Germán Torres Tendero"
      ],
      "reviewer_source": "field",
      "estimate_h": 14.0,
      "start": "2026-11-12",
      "due": "2026-11-17",
      "milestone": "H2",
      "status": "en revisión",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-16T18:00:21Z: en revisión.",
      "url": "https://app.clickup.com/t/869fc767g"
    },
    {
      "hu": "HU-11",
      "type": "T3",
      "task_id": "869fc76h6",
      "task": "T3 - Probar escalada de privilegios, acceso entre organismos y revocación",
      "assignee": [
        "Daniil Nemchenko"
      ],
      "reviewer": [
        "Fernando Bravo Torres"
      ],
      "reviewer_source": "description",
      "estimate_h": 7.0,
      "start": "2026-11-18",
      "due": "2026-11-19",
      "milestone": "H3",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Revisor documentado en descripción; campo Revisores no escribible con el plan actual.",
      "url": "https://app.clickup.com/t/869fc76h6"
    },
    {
      "hu": "CTRL",
      "type": "CTRL-1",
      "task_id": "1ammuym2b2a",
      "task": "CTRL-1 - Preparar la línea base de datos y el registro de indicadores",
      "assignee": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer": [
        "Damián Verde"
      ],
      "reviewer_source": "field",
      "estimate_h": 2.0,
      "start": "2026-11-09",
      "due": "2026-11-09",
      "milestone": "CTRL",
      "status": "completados",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-12T18:03:32Z: completados. Tarea de control con ventana propia.",
      "url": "https://app.clickup.com/t/1ammuym2b2a"
    },
    {
      "hu": "CTRL",
      "type": "CTRL-2",
      "task_id": "1ammuym2b2b",
      "task": "CTRL-2 - Registrar a diario avance, bloqueos y trabajo restante",
      "assignee": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer": [
        "Laura"
      ],
      "reviewer_source": "field",
      "estimate_h": 2.5,
      "start": "2026-11-09",
      "due": "2026-11-23",
      "milestone": "CTRL",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Tarea de control con ventana propia.",
      "url": "https://app.clickup.com/t/1ammuym2b2b"
    },
    {
      "hu": "CTRL",
      "type": "CTRL-3",
      "task_id": "1ammuym2b2c",
      "task": "CTRL-3 - Seguir defectos y resultados de pruebas de aceptación",
      "assignee": [
        "Fernando Bravo Torres"
      ],
      "reviewer": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer_source": "field",
      "estimate_h": 2.0,
      "start": "2026-11-09",
      "due": "2026-11-23",
      "milestone": "CTRL",
      "status": "en curso",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-17T18:00:21Z: en curso. Tarea de control con ventana propia.",
      "url": "https://app.clickup.com/t/1ammuym2b2c"
    },
    {
      "hu": "CTRL",
      "type": "CTRL-4",
      "task_id": "1ammuym2b2d",
      "task": "CTRL-4 - Revisar la carga de trabajo y el reparto",
      "assignee": [
        "Laura"
      ],
      "reviewer": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer_source": "field",
      "estimate_h": 1.0,
      "start": "2026-11-10",
      "due": "2026-11-17",
      "milestone": "CTRL",
      "status": "en revisión",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Estado en tablero el 2026-11-17T18:00:21Z: en revisión. Tarea de control con ventana propia.",
      "url": "https://app.clickup.com/t/1ammuym2b2d"
    },
    {
      "hu": "CTRL",
      "type": "CTRL-5",
      "task_id": "1ammuym2b2e",
      "task": "CTRL-5 - Revisión de control intermedia y decisiones correctivas",
      "assignee": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer": [
        "Damián Verde"
      ],
      "reviewer_source": "field",
      "estimate_h": 1.5,
      "start": "2026-11-16",
      "due": "2026-11-16",
      "milestone": "CTRL",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Tarea de control con ventana propia.",
      "url": "https://app.clickup.com/t/1ammuym2b2e"
    },
    {
      "hu": "CTRL",
      "type": "CTRL-6",
      "task_id": "1ammuym2b2f",
      "task": "CTRL-6 - Elaborar los informes de estado para profesores y equipo MVMQF",
      "assignee": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer": [
        "Damián Verde"
      ],
      "reviewer_source": "field",
      "estimate_h": 2.5,
      "start": "2026-11-11",
      "due": "2026-11-23",
      "milestone": "CTRL",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Tarea de control con ventana propia.",
      "url": "https://app.clickup.com/t/1ammuym2b2f"
    },
    {
      "hu": "CTRL",
      "type": "CTRL-7",
      "task_id": "1ammuym2b2g",
      "task": "CTRL-7 - Cerrar los KPIs del Sprint y ajustar la línea base",
      "assignee": [
        "Alejandro Cerezo Contreras"
      ],
      "reviewer": [
        "Fernando Bravo Torres"
      ],
      "reviewer_source": "field",
      "estimate_h": 2.0,
      "start": "2026-11-23",
      "due": "2026-11-23",
      "milestone": "CTRL",
      "status": "sprint backlog",
      "checks": {
        "assignee": true,
        "reviewer": true,
        "reviewer_differs": true,
        "estimate": true,
        "start": true,
        "due": true
      },
      "checks_ok": true,
      "notes": "Tarea de control con ventana propia.",
      "url": "https://app.clickup.com/t/1ammuym2b2g"
    }
  ],
  "risks": [
    {
      "id": "R-01",
      "risk": "Déficit de planificación: 158 h de tareas frente a 108 h de capacidad corregida por eventos P6 (~50 h).",
      "impact": "Alto",
      "decision": "Revisar en CTRL-4 (10/11); no cambiar la línea base sin acuerdo. Orden de retirada: HU-07 → HU-05 → HU-04.",
      "owner": "Alejandro / Laura",
      "date": "2026-11-10"
    },
    {
      "id": "R-02",
      "risk": "Carga de revisión desequilibrada: Damián 7 revisiones; Zehra y Daniil 0.",
      "impact": "Medio",
      "decision": "Reequilibrar en CTRL-4 con datos de M-7; no asignar más revisiones a Damián sin revisar su capacidad.",
      "owner": "Laura / Alejandro",
      "date": "2026-11-10"
    },
    {
      "id": "R-03",
      "risk": "El campo «Revisores» no es escribible con el plan actual.",
      "impact": "Bajo",
      "decision": "HU-11 · T3 documenta el revisor en la descripción (Fernando Bravo Torres, propuesta P4). Si cambia el plan, poblar el campo.",
      "owner": "Alejandro",
      "date": "2026-11-09"
    },
    {
      "id": "R-04",
      "risk": "Solo 8,98 h registradas, repartidas entre CTRL-1, CTRL-4, HU-01 · T3, HU-04 · T1, HU-07 · T1, HU-07 · T2 y HU-11 · T2. M-5 sigue con poca muestra.",
      "impact": "Medio",
      "decision": "Cada persona registra con timer o entrada manual; no rellenar con la estimación.",
      "owner": "Equipo",
      "date": "diario"
    },
    {
      "id": "R-05",
      "risk": "Dos snapshots xlsx con el mismo nombre (v1 18 filas, v2 25 filas).",
      "impact": "Bajo",
      "decision": "La fuente canónica es docs/control en el repositorio. El Doc de ClickUp y los xlsx quedan congelados.",
      "owner": "Alejandro",
      "date": "2026-11-09"
    },
    {
      "id": "R-06",
      "risk": "Custom task IDs deshabilitados: «CTRL-1» no resuelve por API.",
      "impact": "Bajo",
      "decision": "Usar IDs internos (1ammuym2b2a, etc.) en API y agentes; el nombre visible no es clave.",
      "owner": "Alejandro",
      "date": "2026-11-09"
    },
    {
      "id": "R-07",
      "risk": "Línea base pendiente de aprobación formal.",
      "impact": "Medio",
      "decision": "Damián revisa CTRL-1; no cambiar B0/N0/H0 hasta aprobación. Cambios de alcance exigen versión nueva.",
      "owner": "Damián",
      "date": "2026-11-09"
    }
  ],
  "invariants": {
    "daily_rows": 11,
    "daily_filled_rows": 10,
    "audit_rows": 25,
    "hu_subtasks": 18,
    "ctrl_tasks": 7,
    "sum_estimate_h": 158.0,
    "sum_hu_estimate_h": 144.5,
    "sum_ctrl_estimate_h": 13.5,
    "all_leaf_have_assignee": true,
    "all_leaf_have_estimate": true,
    "all_leaf_have_due": true,
    "all_hu_reviewers_defined": true,
    "all_hu_reviewers_differ": true,
    "hu02_all_sprint_backlog": false,
    "baseline_B0_h": 158.0,
    "N0": 6,
    "people": 9,
    "open_remaining_h": 36.5,
    "logged_hours": 29.61,
    "blocked_tasks": 0,
    "critical_defects": 0
  },
  "changelog": [
    {
      "version": "2.0",
      "baseline": "LB-S2-v1",
      "date": "2026-11-19",
      "change": "Cierre d9: restante real 36,5 h, ideal 15,8 h, desviación 20,7 h (13,1 %, ámbar). Sin tareas completadas durante el día. HU-05 · T2 sigue en revisión; las T3 de HU-05 y HU-11 no se terminaron el día de su vencimiento y H3 no se cumple (4 de 6 T3). 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 29,61.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.9",
      "baseline": "LB-S2-v1",
      "date": "2026-11-18",
      "change": "Cierre d8: restante real 43,5 h, ideal 31,6 h, desviación 11,9 h (7,5 %, verde). HU-02 · T2, HU-04 · T2, HU-11 · T2, HU-07 · T2, HU-02 · T3 y CTRL-4 completadas. 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 29,23.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.8",
      "baseline": "LB-S2-v1",
      "date": "2026-11-17",
      "change": "Cierre d7: restante real 88,5 h, ideal 47,4 h, desviación 41,1 h (26,0 %, rojo). HU-02 · T2 y HU-01 · T3 completadas. H2 con 4 T2 en revisión. 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 8,98.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.7",
      "baseline": "LB-S2-v1",
      "date": "2026-11-16",
      "change": "Cierre d6: restante real 105,0 h, ideal 63,2 h, desviación 41,8 h (26,5 %, rojo). HU-07 · T1 y HU-04 · T3 completadas. H1 cubierto con retraso. 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 7,74.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.6",
      "baseline": "LB-S2-v1",
      "date": "2026-11-13",
      "change": "Cierre d5: restante real 115,0 h, ideal 79,0 h, desviación 36,0 h (22,8 %, rojo). HU-02 · T1 y HU-01 · T2 completadas. H1 sigue sin cumplirse (2 días, KPI-3 rojo). 0 HU aceptadas, 1 bloqueo, 0 críticos. Horas registradas 3,42.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.5",
      "baseline": "LB-S2-v1",
      "date": "2026-11-12",
      "change": "Cierre d4: restante real 133,0 h, ideal 94,8 h, desviación 38,2 h (24,2 %, rojo). CTRL-1, HU-01 · T1 y HU-05 · T1 completadas. H1 sigue sin cumplirse. 0 HU aceptadas, 1 bloqueo, 0 críticos. Horas registradas 3,42.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.4",
      "baseline": "LB-S2-v1",
      "date": "2026-11-11",
      "change": "Cierre d3: restante real 148,0 h, ideal 110,6 h, desviación 37,4 h (23,7 %, rojo). HU-11 · T1 completada. H1 no cumplido. 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 2,25.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.3",
      "baseline": "LB-S2-v1",
      "date": "2026-11-10",
      "change": "Cierre d2: restante real 153,0 h, ideal 126,4 h, desviación 26,6 h (16,8 %, ámbar). HU-04 · T1 completada (5 h). 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas acumuladas 2,25.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.2",
      "baseline": "LB-S2-v1",
      "date": "2026-11-10",
      "change": "La fuente canónica pasa al repositorio (docs/control). El Doc de ClickUp queda congelado. Corrección de d0: las 1,25 h de CTRL-1 se imputan en d1, no en la línea base. Corte d1 (cierre reconstruido) y d2 (intradiario): restante real 158 h, desviación 10,0 % y 20,0 %. Estados de la auditoría releídos del tablero.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.1",
      "baseline": "LB-S2-v1",
      "date": "2026-11-10",
      "change": "Alineación de KPI-4 (regla de fecha de detección no válida) y confirmación de 10 cortes laborables (D1–D10) con fórmula 158 × (1 − d/10) reservando el 23/11 para Review y cierre en CTRL-2.",
      "author": "Alejandro Cerezo Contreras"
    },
    {
      "version": "1.0",
      "baseline": "LB-S2-v1",
      "date": "2026-11-09",
      "change": "Creación del Doc canónico: línea base, d0, 7 indicadores, auditoría de 25 tareas (18 HU + 7 CTRL). Los xlsx quedan como snapshots.",
      "author": "Alejandro Cerezo Contreras (asistido por agente)"
    }
  ]
}
```

## 8\. Changelog

| Versión | Línea base | Fecha | Cambio | Autor |
| ---| ---| ---| ---| --- |
| 2.0 | LB-S2-v1 | 2026-11-19 | Cierre d9: restante real 36,5 h, ideal 15,8 h, desviación 20,7 h (13,1 %, ámbar). Sin tareas completadas durante el día. HU-05 · T2 sigue en revisión; las T3 de HU-05 y HU-11 no se terminaron el día de su vencimiento y H3 no se cumple (4 de 6 T3). 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 29,61. | Alejandro Cerezo Contreras |
| 1.9 | LB-S2-v1 | 2026-11-18 | Cierre d8: restante real 43,5 h, ideal 31,6 h, desviación 11,9 h (7,5 %, verde). HU-02 · T2, HU-04 · T2, HU-11 · T2, HU-07 · T2, HU-02 · T3 y CTRL-4 completadas. 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 29,23. | Alejandro Cerezo Contreras |
| 1.8 | LB-S2-v1 | 2026-11-17 | Cierre d7: restante real 88,5 h, ideal 47,4 h, desviación 41,1 h (26,0 %, rojo). HU-02 · T2 y HU-01 · T3 completadas. H2 con 4 T2 en revisión. 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 8,98. | Alejandro Cerezo Contreras |
| 1.7 | LB-S2-v1 | 2026-11-16 | Cierre d6: restante real 105,0 h, ideal 63,2 h, desviación 41,8 h (26,5 %, rojo). HU-07 · T1 y HU-04 · T3 completadas. H1 cubierto con retraso. 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 7,74. | Alejandro Cerezo Contreras |
| 1.6 | LB-S2-v1 | 2026-11-13 | Cierre d5: restante real 115,0 h, ideal 79,0 h, desviación 36,0 h (22,8 %, rojo). HU-02 · T1 y HU-01 · T2 completadas. H1 sigue sin cumplirse (2 días, KPI-3 rojo). 0 HU aceptadas, 1 bloqueo, 0 críticos. Horas registradas 3,42. | Alejandro Cerezo Contreras |
| 1.5 | LB-S2-v1 | 2026-11-12 | Cierre d4: restante real 133,0 h, ideal 94,8 h, desviación 38,2 h (24,2 %, rojo). CTRL-1, HU-01 · T1 y HU-05 · T1 completadas. H1 sigue sin cumplirse. 0 HU aceptadas, 1 bloqueo, 0 críticos. Horas registradas 3,42. | Alejandro Cerezo Contreras |
| 1.4 | LB-S2-v1 | 2026-11-11 | Cierre d3: restante real 148,0 h, desviación 23,7 % (rojo). HU-11 · T1 completada. H1 no cumplido. 0 HU aceptadas, 0 bloqueos, 0 críticos. | Alejandro Cerezo Contreras |
| 1.3 | LB-S2-v1 | 2026-11-10 | Cierre d2: restante real 153,0 h, desviación 16,8 % (ámbar). HU-04 · T1 completada (5 h). 0 HU aceptadas, 0 bloqueos, 0 críticos. Horas registradas 2,25. | Alejandro Cerezo Contreras |
| 1.2 | LB-S2-v1 | 2026-11-10 | Fuente canónica movida al repositorio. Doc de ClickUp congelado. d0 corregido (0 h); d1 cerrado con 158 h y 10,0 %; d2 intradiario con 158 h y 20,0 %. | Alejandro Cerezo Contreras |
| 1.1 | LB-S2-v1 | 2026-11-10 | Alineación de KPI-4 (regla de fecha de detección no válida) y confirmación de 10 cortes laborables (D1–D10) con fórmula 158 × (1 − d/10) reservando el 23/11 para Review y cierre en CTRL-2. | Alejandro Cerezo Contreras |
| 1.0 | LB-S2-v1 | 2026-11-09 | Creación del Doc canónico: línea base, d0, 7 indicadores, auditoría de 25 tareas (18 HU + 7 CTRL). Los xlsx quedan como snapshots. | Alejandro Cerezo Contreras (asistido por agente) |

## 9\. Fuentes

*   Lista Sprint 2: [https://app.clickup.com/90122154098/v/l/li/1500450000000263](https://app.clickup.com/90122154098/v/l/li/1500450000000263)
*   Tarea CTRL: [https://app.clickup.com/t/1ammuym2b29](https://app.clickup.com/t/1ammuym2b29)
*   Tarea CTRL-1: [https://app.clickup.com/t/1ammuym2b2a](https://app.clickup.com/t/1ammuym2b2a)
*   P4: /home/ubuntu/uni/soft/p4/COORDIA\_P4\_Asignaciones.csv (revisor propuesto de HU-11 · T3)
*   P5: /home/ubuntu/uni/soft/p5/COORDIA\_P5\_Metricas\_KPIs.md
*   Revisión del 10/11: `docs/control/revisiones/2026-11-10.md`
*   API Docs: [https://developer.clickup.com/reference/createpagepublic](https://developer.clickup.com/reference/createpagepublic) y [https://developer.clickup.com/reference/editpagepublic](https://developer.clickup.com/reference/editpagepublic)