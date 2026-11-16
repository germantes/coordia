import type { ReportCategory } from '../validation/report.js';

export type AgencySchedule = '24/7' | 'daytime';
export type IncidentCriticality = 'low' | 'medium' | 'high' | 'critical';

export type AgencyId =
  | '112-andalucia'
  | 'infoca-andalucia'
  | '061-andalucia'
  | 'bomberos-malaga'
  | 'policia-local-malaga'
  | 'policia-nacional-malaga'
  | 'guardia-civil-trafico-malaga'
  | 'proteccion-civil-malaga'
  | 'urbanismo-malaga'
  | 'emasa-malaga'
  | 'movilidad-malaga'
  | 'limasam-malaga'
  | 'parques-jardines-malaga';

export type IncidentType =
  | 'urban_fire'
  | 'forest_fire'
  | 'urban_traffic_accident'
  | 'highway_traffic_accident'
  | 'medical_emergency'
  | 'public_security_crime'
  | 'structural_collapse'
  | 'water_network_break'
  | 'flood_coastal_storm'
  | 'road_tree_obstacle'
  | 'unclassified';

export interface AgencyDefinition {
  id: AgencyId;
  name: string;
  description: string;
  schedule: AgencySchedule;
  territorialScope: string;
  fallback24x7?: AgencyId;
  institutionalVerifier: boolean;
}

/**
 * Fuente única de IDs de organismos receptores en Málaga (HU-07 · T1 y HU-11).
 * Usa sufijo territorial explícito (-malaga / -andalucia) y separa cada entidad operativa.
 */
export const MALAGA_AGENCIES: Record<AgencyId, AgencyDefinition> = {
  '112-andalucia': {
    id: '112-andalucia',
    name: '112 Andalucía',
    description: 'Centro de coordinación supramunicipal para emergencias con riesgo vital o concurrencia de múltiples cuerpos (24/7).',
    schedule: '24/7',
    territorialScope: 'Andalucía / Málaga',
    institutionalVerifier: true,
  },
  'infoca-andalucia': {
    id: 'infoca-andalucia',
    name: 'INFOCA Andalucía',
    description: 'Prevención y extinción de incendios forestales y periurbanos (24/7).',
    schedule: '24/7',
    territorialScope: 'Montes de Málaga, Gibralfaro y entorno forestal',
    institutionalVerifier: true,
  },
  '061-andalucia': {
    id: '061-andalucia',
    name: '061 Sanitarios (SAS)',
    description: 'Urgencias sanitarias y soporte vital (24/7).',
    schedule: '24/7',
    territorialScope: 'Vía pública en general',
    institutionalVerifier: true,
  },
  'bomberos-malaga': {
    id: 'bomberos-malaga',
    name: 'Real Cuerpo de Bomberos de Málaga',
    description: 'Extinción de incendios, rescate, salvamento, achiques, derrumbes y fugas de gas (24/7).',
    schedule: '24/7',
    territorialScope: 'Término municipal de Málaga',
    institutionalVerifier: true,
  },
  'policia-local-malaga': {
    id: 'policia-local-malaga',
    name: 'Policía Local de Málaga (092 / CECOP)',
    description: 'Tráfico urbano, cortes de vía, ordenanzas y seguridad ciudadana (24/7).',
    schedule: '24/7',
    territorialScope: 'Red viaria y casco urbano de Málaga',
    institutionalVerifier: true,
  },
  'policia-nacional-malaga': {
    id: 'policia-nacional-malaga',
    name: 'Policía Nacional (091)',
    description: 'Delitos graves y seguridad ciudadana (24/7).',
    schedule: '24/7',
    territorialScope: 'Término municipal de Málaga',
    institutionalVerifier: true,
  },
  'guardia-civil-trafico-malaga': {
    id: 'guardia-civil-trafico-malaga',
    name: 'Guardia Civil de Tráfico (062)',
    description: 'Autovías, rondas (A-7, MA-20), accesos y litoral (24/7).',
    schedule: '24/7',
    territorialScope: 'A-7, MA-20, accesos y litoral',
    institutionalVerifier: true,
  },
  'proteccion-civil-malaga': {
    id: 'proteccion-civil-malaga',
    name: 'Protección Civil Málaga',
    description: 'Apoyo logístico, balizamiento y situaciones de temporal (guardia activable).',
    schedule: '24/7',
    territorialScope: 'Término municipal de Málaga',
    institutionalVerifier: true,
  },
  'urbanismo-malaga': {
    id: 'urbanismo-malaga',
    name: 'Urbanismo Málaga',
    description: 'Evaluación técnica de daños estructurales y edificaciones en horario diurno.',
    schedule: 'daytime',
    territorialScope: 'Casco urbano de Málaga',
    fallback24x7: 'bomberos-malaga',
    institutionalVerifier: false,
  },
  'emasa-malaga': {
    id: 'emasa-malaga',
    name: 'EMASA (Aguas)',
    description: 'Servicio operativo municipal de abastecimiento, saneamiento y red de agua.',
    schedule: 'daytime',
    territorialScope: 'Red municipal de agua de Málaga',
    fallback24x7: 'bomberos-malaga',
    institutionalVerifier: false,
  },
  'movilidad-malaga': {
    id: 'movilidad-malaga',
    name: 'Movilidad (Tráfico y Semáforos)',
    description: 'Servicio operativo municipal de gestión de tráfico y señalización semafórica.',
    schedule: 'daytime',
    territorialScope: 'Red viaria municipal de Málaga',
    fallback24x7: 'policia-local-malaga',
    institutionalVerifier: false,
  },
  'limasam-malaga': {
    id: 'limasam-malaga',
    name: 'LIMASAM',
    description: 'Servicio operativo municipal de limpieza viaria y retirada de obstáculos en calzada.',
    schedule: 'daytime',
    territorialScope: 'Red viaria municipal de Málaga',
    fallback24x7: 'policia-local-malaga',
    institutionalVerifier: false,
  },
  'parques-jardines-malaga': {
    id: 'parques-jardines-malaga',
    name: 'Parques y Jardines Málaga',
    description: 'Servicio operativo municipal de arbolado urbano y zonas verdes.',
    schedule: 'daytime',
    territorialScope: 'Zonas verdes y viario arbolado de Málaga',
    fallback24x7: 'policia-local-malaga',
    institutionalVerifier: false,
  },
};

export interface EffectiveRecipientDispatch {
  targetAgencyId: AgencyId;
  originalAgencyId: AgencyId;
  redirectedTo24x7: boolean;
  immediate: boolean;
  scheduledFor?: string;
}

/**
 * Clase de implementación del catálogo identificado de organismos de respuesta en Málaga.
 * Centraliza la consulta de organismos, su disponibilidad horaria y su redirección 24/7.
 */
export class AgencyCatalog {
  private readonly agencies: ReadonlyMap<AgencyId, AgencyDefinition>;

  constructor(definitions: Record<AgencyId, AgencyDefinition> = MALAGA_AGENCIES) {
    this.agencies = new Map(
      (Object.keys(definitions) as AgencyId[]).map((id) => [id, { ...definitions[id] }]),
    );
  }

  static all(): AgencyDefinition[] {
    return Object.values(MALAGA_AGENCIES).map((agency) => ({ ...agency }));
  }

  static ids(): AgencyId[] {
    return Object.keys(MALAGA_AGENCIES) as AgencyId[];
  }

  static has(id: string): id is AgencyId {
    return Object.prototype.hasOwnProperty.call(MALAGA_AGENCIES, id);
  }

  static get(id: string): AgencyDefinition | null {
    if (!this.has(id)) return null;
    return { ...MALAGA_AGENCIES[id] };
  }

  static bySchedule(schedule: AgencySchedule): AgencyDefinition[] {
    return this.all().filter((agency) => agency.schedule === schedule);
  }

  static isInstitutionalVerifier(organizationId?: string): boolean {
    if (!organizationId || !this.has(organizationId)) return false;
    return MALAGA_AGENCIES[organizationId].institutionalVerifier;
  }

  /**
   * Resuelve cómo debe despacharse un aviso hacia un organismo según la franja horaria (CA-3):
   * - Servicios 24/7: despacho inmediato siempre.
   * - Servicios diurnos (08:00–15:00 L-V) en horario laboral: despacho inmediato.
   * - Servicios diurnos fuera de horario + urgente: redirige de inmediato al retén 24/7.
   * - Servicios diurnos fuera de horario + ordinario: se encola para el próximo día laborable a las 08:00.
   */
  static resolveDispatchTarget(
    agencyId: AgencyId,
    options: { timestamp: string | Date; urgent: boolean; category: ReportCategory },
  ): EffectiveRecipientDispatch {
    const agency = MALAGA_AGENCIES[agencyId];
    if (agency.schedule === '24/7' || isDaytimeWorkingHours(options.timestamp)) {
      return {
        targetAgencyId: agencyId,
        originalAgencyId: agencyId,
        redirectedTo24x7: false,
        immediate: true,
      };
    }

    const isDaytimeCategory =
      options.category === 'infrastructure'
      || options.category === 'environment'
      || options.category === 'accessibility';

    if (options.urgent && isDaytimeCategory && agency.fallback24x7) {
      return {
        targetAgencyId: agency.fallback24x7,
        originalAgencyId: agencyId,
        redirectedTo24x7: true,
        immediate: true,
      };
    }

    return {
      targetAgencyId: agencyId,
      originalAgencyId: agencyId,
      redirectedTo24x7: false,
      immediate: false,
      scheduledFor: nextWorkingWindowStart(options.timestamp),
    };
  }

  all(): AgencyDefinition[] {
    return [...this.agencies.values()].map((agency) => ({ ...agency }));
  }

  get(id: string): AgencyDefinition | null {
    const found = this.agencies.get(id as AgencyId);
    return found ? { ...found } : null;
  }

  has(id: string): id is AgencyId {
    return this.agencies.has(id as AgencyId);
  }
}

export interface IncidentRoutingRule {
  incidentType: IncidentType;
  label: string;
  category: ReportCategory;
  criticality: IncidentCriticality;
  primary: AgencyId;
  secondary: AgencyId[];
  urgentPreAlertTargets: AgencyId[];
  territorialScope: string;
}

/**
 * Reglas detalladas por tipo de incidente según la tabla de la sección 2 de docs/matriz_destinatarios.md.
 */
export const INCIDENT_ROUTING_RULES: Record<IncidentType, IncidentRoutingRule> = {
  urban_fire: {
    incidentType: 'urban_fire',
    label: 'Incendio Urbano / Estructura',
    category: 'safety',
    criticality: 'critical',
    primary: 'bomberos-malaga',
    secondary: ['112-andalucia', 'policia-local-malaga', '061-andalucia'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga', 'bomberos-malaga'],
    territorialScope: 'Casco urbano y barriadas',
  },
  forest_fire: {
    incidentType: 'forest_fire',
    label: 'Incendio Forestal / Periurbano',
    category: 'safety',
    criticality: 'critical',
    primary: '112-andalucia',
    secondary: [
      'infoca-andalucia',
      'bomberos-malaga',
      'policia-local-malaga',
      'guardia-civil-trafico-malaga',
    ],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga', 'infoca-andalucia'],
    territorialScope: 'Montes de Málaga, Gibralfaro',
  },
  urban_traffic_accident: {
    incidentType: 'urban_traffic_accident',
    label: 'Accidente de Tráfico Urbano',
    category: 'safety',
    criticality: 'high',
    primary: '112-andalucia',
    secondary: ['061-andalucia', 'policia-local-malaga', 'bomberos-malaga'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga', '061-andalucia'],
    territorialScope: 'Red viaria municipal',
  },
  highway_traffic_accident: {
    incidentType: 'highway_traffic_accident',
    label: 'Accidente en Rondas / Autovías',
    category: 'safety',
    criticality: 'critical',
    primary: '112-andalucia',
    secondary: ['guardia-civil-trafico-malaga', '061-andalucia', 'bomberos-malaga'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga', 'guardia-civil-trafico-malaga'],
    territorialScope: 'A-7, MA-20, accesos',
  },
  medical_emergency: {
    incidentType: 'medical_emergency',
    label: 'Emergencia Sanitaria en Vía',
    category: 'safety',
    criticality: 'critical',
    primary: '061-andalucia',
    secondary: ['policia-local-malaga'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga', '061-andalucia'],
    territorialScope: 'Vía pública en general',
  },
  public_security_crime: {
    incidentType: 'public_security_crime',
    label: 'Delito Grave / Seguridad Ciudadana',
    category: 'safety',
    criticality: 'high',
    primary: 'policia-nacional-malaga',
    secondary: ['policia-local-malaga', '112-andalucia'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga', 'policia-nacional-malaga'],
    territorialScope: 'Término municipal',
  },
  structural_collapse: {
    incidentType: 'structural_collapse',
    label: 'Derrumbe / Daño Estructural',
    category: 'infrastructure',
    criticality: 'high',
    primary: 'bomberos-malaga',
    secondary: ['policia-local-malaga', 'urbanismo-malaga', 'proteccion-civil-malaga'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga', 'bomberos-malaga'],
    territorialScope: 'Casco urbano',
  },
  water_network_break: {
    incidentType: 'water_network_break',
    label: 'Rotura Grave Red de Agua',
    category: 'infrastructure',
    criticality: 'medium',
    primary: 'emasa-malaga',
    secondary: ['policia-local-malaga'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga'],
    territorialScope: 'Red municipal de agua',
  },
  flood_coastal_storm: {
    incidentType: 'flood_coastal_storm',
    label: 'Inundación / Temporal Costero',
    category: 'environment',
    criticality: 'high',
    primary: '112-andalucia',
    secondary: [
      'bomberos-malaga',
      'proteccion-civil-malaga',
      'policia-local-malaga',
      'emasa-malaga',
    ],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga'],
    territorialScope: 'Litoral y cuencas fluviales',
  },
  road_tree_obstacle: {
    incidentType: 'road_tree_obstacle',
    label: 'Obstáculo en Calzada / Arbolado',
    category: 'accessibility',
    criticality: 'medium',
    primary: 'policia-local-malaga',
    secondary: ['limasam-malaga', 'parques-jardines-malaga', 'movilidad-malaga'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga'],
    territorialScope: 'Red viaria municipal',
  },
  unclassified: {
    incidentType: 'unclassified',
    label: 'Incidente no clasificado',
    category: 'other',
    criticality: 'medium',
    primary: '112-andalucia',
    secondary: ['policia-local-malaga'],
    urgentPreAlertTargets: ['112-andalucia', 'policia-local-malaga'],
    territorialScope: 'Término municipal',
  },
};

/** Regla por defecto por categoría cuando no se especifica subtipo ni palabras clave específicas. */
export const DEFAULT_INCIDENT_BY_CATEGORY: Record<ReportCategory, IncidentType> = {
  safety: 'urban_fire',
  infrastructure: 'water_network_break',
  environment: 'flood_coastal_storm',
  accessibility: 'road_tree_obstacle',
  other: 'unclassified',
};

/**
 * Resuelve la regla de la matriz a partir de la categoría, un subtipo explícito opcional
 * o el análisis del texto de descripción/urgencia.
 */
export function resolveIncidentRouting(
  category: ReportCategory,
  options: { incidentType?: IncidentType; description?: string; urgent?: boolean } = {},
): IncidentRoutingRule {
  if (options.incidentType && INCIDENT_ROUTING_RULES[options.incidentType]) {
    return INCIDENT_ROUTING_RULES[options.incidentType];
  }

  const text = (options.description ?? '').toLowerCase();

  if (category === 'safety') {
    if (/(forestal|monte|gibralfaro|infoca|matorral|periurbano)/.test(text)) {
      return INCIDENT_ROUTING_RULES.forest_fire;
    }
    if (/(a-7|ma-20|autov[ií]a|ronda)/.test(text)) {
      return INCIDENT_ROUTING_RULES.highway_traffic_accident;
    }
    if (/(accidente|colisi[oó]n|atropello|choque|tr[aá]fico|veh[ií]culo)/.test(text)) {
      return INCIDENT_ROUTING_RULES.urban_traffic_accident;
    }
    if (/(sanitari|herid|infarto|desmayo|inconsciente|ambulancia|061)/.test(text)) {
      return INCIDENT_ROUTING_RULES.medical_emergency;
    }
    if (/(delito|robo|agresi[oó]n|violencia|atraco|arma)/.test(text)) {
      return INCIDENT_ROUTING_RULES.public_security_crime;
    }
    return INCIDENT_ROUTING_RULES.urban_fire;
  }

  if (category === 'infrastructure') {
    if (options.urgent || /(derrumbe|estructur|grieta|balc[oó]n|fachada|hundimiento|gas)/.test(text)) {
      return INCIDENT_ROUTING_RULES.structural_collapse;
    }
    return INCIDENT_ROUTING_RULES.water_network_break;
  }

  return INCIDENT_ROUTING_RULES[DEFAULT_INCIDENT_BY_CATEGORY[category]];
}

const MALAGA_TIME_ZONE = 'Europe/Madrid';

function madridParts(timestamp: string | Date) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MALAGA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour') };
}

function madridWallTimeToIso(year: number, month: number, day: number, hour: number): string {
  const desiredUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let candidate = desiredUtc;

  // Convierte una hora de pared de Málaga a UTC, también cuando cambia el horario de verano.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = madridParts(new Date(candidate));
    const observedUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, 0, 0, 0);
    const adjustment = desiredUtc - observedUtc;
    if (adjustment === 0) break;
    candidate += adjustment;
  }
  return new Date(candidate).toISOString();
}

/** Comprueba si una marca temporal cae en horario laboral de Málaga (Lunes a Viernes, 08:00–15:00 local). */
export function isDaytimeWorkingHours(timestamp: string | Date): boolean {
  const parts = madridParts(timestamp);
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  if (day === 0 || day === 6) return false;
  return parts.hour >= 8 && parts.hour < 15;
}

/** Calcula el inicio del siguiente turno diurno laborable (08:00 Europe/Madrid del mismo día o siguiente L-V). */
export function nextWorkingWindowStart(timestamp: string | Date): string {
  const parts = madridParts(timestamp);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay();

  if (day >= 1 && day <= 5 && parts.hour < 8) {
    return madridWallTimeToIso(parts.year, parts.month, parts.day, 8);
  }

  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);

  return madridWallTimeToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 8);
}
