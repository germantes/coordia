# Matriz de Destinatarios y Tratamiento de Urgencias No Verificadas (Málaga)

Especificación del enrutamiento de incidentes a organismos de emergencia del término municipal de Málaga y protocolo de actuación ante avisos de alta prioridad sin verificación previa.

---

## 1. Organismos de Respuesta en Málaga

* **112 Andalucía:** Centro de coordinación supramunicipal para emergencias de riesgo vital o concurrencia de múltiples cuerpos.
* **Real Cuerpo de Bomberos de Málaga:** Extinción, rescate, salvamento, achiques, derrumbes y fugas de gas.
* **Policía Local de Málaga (092 / CECOP):** Tráfico urbano, cortes de vía, seguridad ciudadana y ordenanzas locales.
* **Policía Nacional (091) / Guardia Civil (062):** Delitos graves; Guardia Civil (Tráfico) en autovías/rondas (A-7, MA-20) y zonas costeras/rurales.
* **061 Sanitarios (SAS):** Urgencias sanitarias y soporte vital.
* **Protección Civil Málaga:** Apoyo logístico, balizamiento y situaciones de temporal.
* **Servicios Municipales:** EMASA (red de aguas y saneamiento), Movilidad (semáforos y tráfico) y LIMASAM / Parques y Jardines (obstáculos y caída de árboles).

---

## 2. Matriz de Destinatarios

| Tipo de Incidente | Criticidad | Organismo Principal | Organismos Secundarios | Ámbito Territorial |
| :--- | :--- | :--- | :--- | :--- |
| **Incendio Urbano / Estructura** | Alta / Crítica | Bomberos de Málaga | 112, Policía Local, 061 | Casco urbano y barriadas |
| **Incendio Forestal / Periurbano** | Crítica | 112 Andalucía / INFOCA | Bomberos, Policía Local, Guardia Civil | Montes de Málaga, Gibralfaro |
| **Inundación / Temporal** | Media / Alta | 112 Andalucía (CECOPAL) | Bomberos, Protección Civil, Policía Local, EMASA | Litoral y cuencas fluviales |
| **Accidente de Tráfico Urbano** | Alta (con heridos) | 112 Andalucía / 061 | Policía Local, Bomberos (si hay atrapados) | Red viaria municipal |
| **Accidente en Rondas / Autovías** | Alta / Crítica | 112 Andalucía | Guardia Civil de Tráfico, 061, Bomberos | A-7, MA-20, accesos |
| **Derrumbe / Daño Estructural** | Media / Alta | Bomberos de Málaga | Policía Local, Urbanismo / Protección Civil | Casco urbano |
| **Obstáculo en Vía / Caída de Árbol** | Baja / Media | Policía Local | LIMASAM, Parques y Jardines, Movilidad | Red viaria municipal |
| **Rotura Grave de Red de Agua** | Media | EMASA | Policía Local (si afecta al tráfico) | Casco municipal |
| **Emergencia Sanitaria en Vía Pública** | Crítica | 061 (Sanitarios) | Policía Local (primera intervención) | Vía pública en general |

---

## 3. Tratamiento de Urgencias No Verificadas

Aplica a reportes clasificados con criticidad **Alta o Crítica** que aún no han alcanzado el umbral de confianza comunitaria.

### 3.1. Estado `Pre-alerta Urgente`
* El aviso se marca como `Pre-alerta Urgente (Sin verificar)` y se notifica inmediatamente al centro de control correspondiente (112 Andalucía / CECOP de Policía Local).
* Se transmite la telemetría disponible (coordenadas GPS, categoría, hora y fotografías si existen) advirtiendo explícitamente que está pendiente de confirmación en el terreno.

### 3.2. Filtros de Admisión Previa
Para evitar falsas alarmas, el reporte debe superar antes del preaviso:
1. **Precisión geográfica:** Coordenadas dentro de Málaga con margen de precisión GPS informado $< 50\text{ m}$.
2. **Control de duplicados:** Si existe un aviso abierto del mismo tipo a $< 150\text{ m}$ en los últimos 20 minutos, se vincula como testimonio adicional y no genera nueva pre-alerta.
3. **Estado de cuenta:** Emisor sin bloqueos ni sanciones previas por falsos reportes.

### 3.3. Verificación Acelerada (*Fast-Track*)
* El sistema solicita confirmación prioritaria a usuarios activos en un radio $\le 300\text{ m}$ ($\le 1000\text{ m}$ en áreas periurbanas o forestales).
* **Criterios de validación exprés:**
  * **1 confirmación** de usuario acreditado (fuerzas de seguridad, personal municipal o Protección Civil) eleva el reporte a `Verificado Urgente`.
  * **2 confirmaciones independientes** de ciudadanos sin historial negativo elevan el reporte a `Verificado Urgente`.

### 3.4. Resolución del Aviso
* **Confirmación:** Pasa a `Verificado Urgente` y se activa el despacho a todos los organismos secundarios fijados en la matriz.
* **Refutación / Falsedad:** Si recibe 2 rechazos fundados o descarte de patrulla oficial, pasa a `Descartado (Falso Aviso)`. Se envía orden inmediata de anulación a los centros preavisados y se sanciona la cuenta del emisor.
* **Expiración (Timeout):** Tras 10 minutos sin confirmación ni refutación, la pre-alerta pasa a `Pendiente de Revisión Manual` o caduca para evitar mantener incidentes no contrastados en la cola activa.
