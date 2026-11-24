# CTRL-7 · Cierre de indicadores y línea base para el Sprint 3

Fecha: 2026-11-23. Línea base histórica: `LB-S2-v1` (no se sobrescribe).

## 1. Valores finales

| Indicador | Valor final | Semáforo | ¿Llevó a alguna decisión? |
| --- | --- | --- | --- |
| KPI-1 | 6/6 HU aceptadas en Review; 0/6 durante d0–d10 | Verde al cierre; rojo todo el Sprint | Sí: no se recortó alcance |
| KPI-2 | d10 = 23,1 % (36,5 h); Review = 0 h abiertas | Rojo en d10 | Sí: CTRL-5 decidió no recortar por el indicador |
| KPI-3 | H1 +2 d; H2 con T2 tardía; H3 fallido el 19/11 | Rojo | Sí: se priorizó cerrar T2 antes que T3 |
| KPI-4 | 0 DEF urgentes | Verde | Parcial: se vigiló el bloqueo de tests SQLite sin abrir DEF |
| M-5 | 37,61 h / 158 h − 1 = −76 % | Sin dato utilizable | Sí: se dejó de usar como semáforo |
| M-6 | 0 bloqueos al cierre; 2 días-bloqueo (HU-05 · T2, 12–13/11) | Verde al cierre | Sí: se trató como bloqueo técnico, no de alcance |
| M-7 | Sin disponibilidad declarada al cierre; en d8 Damián > 1,1 | Rojo puntual | No se reasignó (faltaba confirmación) |

## 2. Trabajo aceptado

| Tipo | Tareas hoja | Estimación h | Registrado h (ClickUp) | Factor registrado/estimado |
| --- | --- | --- | --- | --- |
| T1 | 6 | 32,0 | 2,17 | 0,07 |
| T2 | 6 | 77,0 | 20,35 | 0,26 |
| T3 | 6 | 35,5 | 10,88 | 0,31 |
| CTRL | 7 | 13,5 | 4,21 | 0,31 |
| Total hoja | 25 | 158,0 | 37,61 | 0,24 |

El factor no se usa para planificar el Sprint 3: el registro de tiempo está incompleto (R-04). Planificar con estimación de análisis, no con este ratio.

HU aceptadas: 6 / 6. Horas HU aceptadas: 144,5 h.

## 3. Umbrales que se mantienen o se ajustan

- Se mantienen KPI-1, KPI-2, KPI-3, KPI-4 y M-6: todos produjeron al menos una decisión o una alerta.
- M-5 se retira del semáforo externo hasta que el equipo registre el tiempo de forma continua.
- M-7 se mantiene interno, pero exige disponibilidad declarada; si no hay dato, se informa «no consta» y no se reasigna.

## 4. Propuesta de línea base para el Sprint 3

No se crea `LB-S2-v2`. `LB-S2-v1` queda como histórico del Sprint 2.

Propuesta para planificar el Sprint 3 (pendiente de Planning):

- Partir de las 6 HU ya aceptadas; no reestimar T1–T3 cerradas.
- Incluir como trabajo nuevo, si el equipo lo acepta:
  1. Identificador de dispositivo o umbral alto para la penalización de origen compartido (HU-05).
  2. Decidir si el producto necesita un estado REJECTED (< 0,40) además de pendiente/verificado.
- Capacidad: volver a medir disponibilidad real; no reutilizar 18,7 h ni el déficit de 50 h de P6 sin un recuento nuevo.
- Conservar el registro en `docs/control/` y el tablero en ClickUp.

Mediana de bloqueo: un intervalo (HU-05 · T2, 12/11–13/11), 2 días laborables. No hay más bloqueos.
