import type { ReportCategory } from './report.js';
import { distanceBetweenMeters } from './report-response.js';
import type { IncidentCriticality, IncidentType } from '../models/recipient-matrix.js';

export const URGENT_MAX_GPS_ACCURACY_METERS = 50;
export const URGENT_DUPLICATE_RADIUS_METERS = 150;
export const URGENT_DUPLICATE_WINDOW_MS = 20 * 60 * 1_000;
export const URGENT_MANUAL_REVIEW_TIMEOUT_MS = 10 * 60 * 1_000;
export const FAST_TRACK_URBAN_RADIUS_METERS = 300;
export const FAST_TRACK_FOREST_RADIUS_METERS = 1_000;

/** Límites geográficos del término municipal de Málaga y su entorno periurbano/montes. */
export const MALAGA_BOUNDS = {
  minLatitude: 36.60,
  maxLatitude: 36.90,
  minLongitude: -4.65,
  maxLongitude: -4.25,
} as const;

export type LocationCaptureSource = 'gps' | 'manual';

export interface UrgentLocationInput {
  latitude: number;
  longitude: number;
  source?: LocationCaptureSource;
  accuracyMeters?: number;
}

export interface OpenUrgentReportCandidate {
  id: string;
  category: ReportCategory;
  incidentType?: IncidentType;
  location: { latitude: number; longitude: number };
  occurredAt?: string;
  createdAt: string;
  status?: string;
  urgent?: boolean;
}

export type UrgentAdmissionResult =
  | {
      admitted: true;
      duplicateOfReportId?: string;
      fastTrackRadiusMeters: number;
    }
  | {
      admitted: false;
      reason: 'invalid_gps_accuracy' | 'outside_malaga_bounds';
      message: string;
    };

/** Comprueba si las coordenadas caen dentro del término municipal de Málaga. */
export function isWithinMalagaBounds(location: { latitude: number; longitude: number }): boolean {
  return (
    location.latitude >= MALAGA_BOUNDS.minLatitude
    && location.latitude <= MALAGA_BOUNDS.maxLatitude
    && location.longitude >= MALAGA_BOUNDS.minLongitude
    && location.longitude <= MALAGA_BOUNDS.maxLongitude
  );
}

/** Determina si una criticidad exige tratamiento de urgencia (Alta o Crítica). */
export function isUrgentCriticality(criticality: IncidentCriticality, explicitUrgent?: boolean): boolean {
  if (explicitUrgent !== undefined) return explicitUrgent;
  return criticality === 'high' || criticality === 'critical';
}

/**
 * Evalúa los filtros de admisión previa (sección 4.2 de docs/matriz_destinatarios.md)
 * y detecta duplicados abiertos a < 150 m en los últimos 20 minutos.
 */
export function evaluateUrgentAdmission(
  input: {
    category: ReportCategory;
    incidentType?: IncidentType;
    location: UrgentLocationInput;
    timestamp: string;
  },
  openReports: OpenUrgentReportCandidate[] = [],
): UrgentAdmissionResult {
  const source: LocationCaptureSource = input.location.source
    ?? (input.location.accuracyMeters !== undefined ? 'gps' : 'manual');

  if (!isWithinMalagaBounds(input.location)) {
    return {
      admitted: false,
      reason: 'outside_malaga_bounds',
      message: 'Las coordenadas deben pertenecer al término municipal de Málaga',
    };
  }

  if (source === 'gps') {
    if (
      typeof input.location.accuracyMeters !== 'number'
      || !Number.isFinite(input.location.accuracyMeters)
      || input.location.accuracyMeters <= 0
      || input.location.accuracyMeters >= URGENT_MAX_GPS_ACCURACY_METERS
    ) {
      return {
        admitted: false,
        reason: 'invalid_gps_accuracy',
        message: 'La captura por GPS automático requiere una precisión estrictamente menor a 50 metros',
      };
    }
  }

  const currentMs = Date.parse(input.timestamp);
  const duplicate = openReports.find((candidate) => {
    if (candidate.status === 'rejected') return false;
    const sameType = input.incidentType && candidate.incidentType
      ? candidate.incidentType === input.incidentType
      : candidate.category === input.category;
    if (!sameType) return false;

    const candidateMs = Date.parse(candidate.occurredAt ?? candidate.createdAt);
    const elapsedMs = Math.abs(currentMs - candidateMs);
    if (!Number.isFinite(elapsedMs) || elapsedMs > URGENT_DUPLICATE_WINDOW_MS) return false;

    const distance = distanceBetweenMeters(input.location, candidate.location);
    return distance < URGENT_DUPLICATE_RADIUS_METERS;
  });

  const fastTrackRadiusMeters = input.incidentType === 'forest_fire'
    ? FAST_TRACK_FOREST_RADIUS_METERS
    : FAST_TRACK_URBAN_RADIUS_METERS;

  return {
    admitted: true,
    ...(duplicate ? { duplicateOfReportId: duplicate.id } : {}),
    fastTrackRadiusMeters,
  };
}

export type UrgentResolutionState =
  | 'pre_alert_active'
  | 'confirmed'
  | 'refuted'
  | 'pending_manual_review';

/**
 * Evalúa la resolución de una urgencia no verificada (secciones 4.3 y 4.4 de docs/matriz_destinatarios.md).
 * Nunca bloquea ni anula automáticamente tras 10 minutos: pasa a 'pending_manual_review'.
 */
export function evaluateUrgentResolution(input: {
  createdAt: string;
  now?: string | Date;
  citizenConfirmations: number;
  citizenRejections: number;
  institutionalConfirmations?: number;
  institutionalRejections?: number;
}): UrgentResolutionState {
  if ((input.institutionalRejections ?? 0) >= 1 || input.citizenRejections >= 2) {
    return 'refuted';
  }
  if ((input.institutionalConfirmations ?? 0) >= 1 || input.citizenConfirmations >= 2) {
    return 'confirmed';
  }

  const createdMs = Date.parse(input.createdAt);
  const nowMs = typeof input.now === 'string'
    ? Date.parse(input.now)
    : (input.now ?? new Date()).getTime();

  if (Number.isFinite(createdMs) && nowMs - createdMs >= URGENT_MANUAL_REVIEW_TIMEOUT_MS) {
    return 'pending_manual_review';
  }

  return 'pre_alert_active';
}
