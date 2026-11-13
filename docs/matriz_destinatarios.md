# HU-07 — Matriz de destinatarios y tratamiento de urgencias no verificadas (Málaga)

Especificación del enrutamiento de incidentes a organismos de emergencia del término municipal de Málaga, régimen horario de avisos y protocolo para urgencias no verificadas.

---

## 1. Organismos de Respuesta en Málaga

* **112 Andalucía:** Centro de coordinación supramunicipal para emergencias con riesgo vital o concurrencia de múltiples cuerpos (24/7).
* **Real Cuerpo de Bomberos de Málaga:** Extinción de incendios, rescate, salvamento, achiques, derrumbes y fugas de gas (24/7).
* **Policía Local de Málaga (092 / CECOP):** Tráfico urbano, cortes de vía, ordenanzas y seguridad ciudadana (24/7).
* **Policía Nacional (091) / Guardia Civil (062):** Delitos graves; Guardia Civil en autovías/rondas (A-7, MA-20) y litoral (24/7).
* **061 Sanitarios (SAS):** Urgencias sanitarias y soporte vital (24/7).
* **Protección Civil Málaga:** Apoyo logístico, balizamiento y situaciones de temporal (guardia activable).
* **Servicios Operativos Municipales:** EMASA (aguas), Movilidad (tráfico y semáforos) y LIMASAM / Parques y Jardines (obstáculos y arbolado).

---

## 2. Matriz de Destinatarios y Mapeo de Categorías

Mapeo entre las categorías de la app (`safety`, `infrastructure`, `environment`, `accessibility`, `other`) y los organismos receptores en Málaga:

| Categoría API | Tipo de Incidente | Criticidad | Organismo Principal | Organismos Secundarios | Ámbito Territorial |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `safety` | **Incendio Urbano / Estructura** | Alta / Crítica | Bomberos de Málaga | 112, Policía Local, 061 | Casco urbano y barriadas |
| `safety` | **Incendio Forestal / Periurbano** | Crítica | 112 Andalucía / INFOCA | Bomberos, Policía Local, Guardia Civil | Montes de Málaga, Gibralfaro |
| `safety` | **Accidente de Tráfico Urbano** | Alta (con heridos) | 112 Andalucía / 061 | Policía Local, Bomberos (si hay atrapados) | Red viaria municipal |
| `safety` | **Accidente en Rondas / Autovías** | Alta / Crítica | 112 Andalucía | Guardia Civil de Tráfico, 061, Bomberos | A-7, MA-20, accesos |
| `safety` | **Emergencia Sanitaria en Vía** | Crítica | 061 (Sanitarios) | Policía Local (primera intervención) | Vía pública en general |
| `infrastructure` | **Derrumbe / Daño Estructural** | Media / Alta | Bomberos de Málaga | Policía Local, Urbanismo / Protección Civil | Casco urbano |
| `infrastructure` | **Rotura Grave Red de Agua** | Media | EMASA | Policía Local (si afecta al tráfico) | Red municipal de agua |
| `environment` | **Inundación / Temporal Costero** | Media / Alta | 112 Andalucía (CECOPAL) | Bomberos, Protección Civil, Policía Local, EMASA | Litoral y cuencas fluviales |
| `accessibility` | **Obstáculo en Calzada / Arbolado** | Baja / Media | Policía Local | LIMASAM, Parques y Jardines, Movilidad | Red viaria municipal |
| `other` | **Incidente no clasificado** | Variable | 112 / Policía Local | Según triaje del operador de guardia | Término municipal |

---

## 3. Régimen Horario y Disponibilidad (CA-3 de HU-07)

* **Servicios de Emergencia 24/7:** 112, Bomberos, Policía Local (CECOP), Guardia Civil y 061 reciben despachos de forma inmediata y continua las 24 horas.
* **Servicios Operativos Diurnos (08:00–15:00):** EMASA (oficinas), Movilidad y LIMASAM reciben avisos no urgentes en horario laboral. Fuera de esta franja los avisos ordinarios se encolan para el siguiente día laborable a las 08:00.
* **Urgencias fuera de horario:** Si un reporte en categoría diurna (`infrastructure`, `environment`, `accessibility`) es calificado como Urgente/Crítico fuera de horario, se redirige inmediatamente al retén de guardia 24/7 (CECOP Policía Local o Bomberos) para evitar demoras.
* **Criterio de prueba (T3):** Simular reportes con marca temporal (`occurredAt` / `createdAt`) nocturna o en fin de semana, verificando que los servicios 24/7 reciben despacho instantáneo y los servicios ordinarios no críticos se encolan sin pérdidas.

---

## 4. Tratamiento de Urgencias No Verificadas

Aplica a reportes clasificados con criticidad **Alta o Crítica** pendientes de confirmación comunitaria.

### 4.1. Pre-alerta Urgente
* El reporte se marca con prioridad urgente y se despacha un preaviso inmediato a los centros de control (112 / CECOP de Policía Local) con coordenadas, categoría y marca temporal, indicando que está pendiente de confirmación presencial.

### 4.2. Filtros de Admisión Previa
* **Ubicación:** 
  * Captura por **GPS automático**: margen de precisión informado $< 50\text{ m}$.
  * Selección **manual en el mapa**: se admite sin radio de precisión, validando únicamente que las coordenadas pertenezcan al término de Málaga.
* **Control de duplicados:** Reportes del mismo tipo a $< 150\text{ m}$ en los últimos 20 minutos se vinculan al aviso abierto sin generar prealertas duplicadas.

### 4.3. Verificación Acelerada (*Fast-Track*)
* Notificación prioritaria a usuarios activos en un radio $\le 300\text{ m}$ ($\le 1000\text{ m}$ en áreas forestales).
* **Validación rápida:** 1 confirmación institucional (fuerzas de seguridad o protección civil) o 2 confirmaciones ciudadanas validan la urgencia para despacho secundario completo.

### 4.4. Resolución del Aviso
* **Confirmado:** Pasa a verificado y se completa el despacho a todos los organismos secundarios previstos en la matriz.
* **Refutado / Falsedad:** Ante 2 rechazos fundados o descarte de patrulla oficial, se emite aviso inmediato de cancelación a los centros notificados.
* **Sin confirmación (10 minutos):** El aviso **nunca se bloquea ni se anula automáticamente**. Permanece activo y pasa a `Pendiente de Revisión Manual` por los operadores de guardia, manteniendo vigente la prealerta ya enviada.

---

## 5. Delimitación de Alcance Técnico (T2 vs. Futuro)

Para la implementación de la tarea técnica posterior (HU-07 · T2):
* **Incluido en T2:** Lógica de enrutamiento a organismos según la matriz, flag de urgencia sobre el reporte (`pending`), despacho inmediato a servicios 24/7, cola horaria diferida y registro de entrega con reintentos.
* **Fuera de alcance (fases posteriores):** Adjuntos fotográficos (el formulario actual de HU-02 sólo contempla texto y coordenadas), sanciones automáticas de usuarios y estados de base de datos adicionales ajenos al ciclo `pending` / `validated` / `rejected` actual.
