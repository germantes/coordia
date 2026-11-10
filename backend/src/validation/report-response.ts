export const REPORT_RESPONSE_VALUES = ['confirm', 'question'] as const;
export const MAX_RESPONSE_DISTANCE_METERS = 500;
export const MAX_LOCATION_ACCURACY_METERS = 100;
export const MAX_LOCATION_AGE_MS = 5 * 60 * 1_000;

export type ReportResponseValue = (typeof REPORT_RESPONSE_VALUES)[number];

export interface LocationObservation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
}

export interface SubmitReportResponseInput {
  response: ReportResponseValue;
  location: LocationObservation;
}

export type ResponseValidation =
  | { valid: true; data: SubmitReportResponseInput }
  | { valid: false; errors: Record<string, string> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateLocationObservation(input: unknown):
  | { valid: true; location: LocationObservation }
  | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!isRecord(input)) return { valid: false, errors: { location: 'La ubicación es obligatoria' } };

  const allowedFields = new Set(['latitude', 'longitude', 'accuracyMeters', 'capturedAt']);
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) errors[`location.${field}`] = 'Campo no permitido';
  }

  const { latitude, longitude, accuracyMeters, capturedAt } = input;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors['location.latitude'] = 'La latitud debe ser un número entre -90 y 90';
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors['location.longitude'] = 'La longitud debe ser un número entre -180 y 180';
  }
  if (typeof accuracyMeters !== 'number' || !Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
    errors['location.accuracyMeters'] = 'La precisión debe ser un número positivo';
  }
  if (typeof capturedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(capturedAt)
    || !Number.isFinite(Date.parse(capturedAt))) {
    errors['location.capturedAt'] = 'La fecha debe ser ISO 8601 válida';
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    location: {
      latitude: latitude as number,
      longitude: longitude as number,
      accuracyMeters: accuracyMeters as number,
      capturedAt: new Date(capturedAt as string).toISOString(),
    },
  };
}

export function validateSubmitReportResponse(input: unknown): ResponseValidation {
  if (!isRecord(input)) return { valid: false, errors: { _form: 'El cuerpo debe ser un objeto JSON' } };

  const errors: Record<string, string> = {};
  for (const field of Object.keys(input)) {
    if (field !== 'response' && field !== 'location') errors[field] = 'Campo no permitido';
  }

  const response = input.response;
  if (typeof response !== 'string' || !REPORT_RESPONSE_VALUES.includes(response as ReportResponseValue)) {
    errors.response = 'La respuesta debe ser confirm o question';
  }

  const locationValidation = validateLocationObservation(input.location);
  if (!locationValidation.valid) Object.assign(errors, locationValidation.errors);

  if (Object.keys(errors).length > 0 || !locationValidation.valid) return { valid: false, errors };
  return {
    valid: true,
    data: { response: response as ReportResponseValue, location: locationValidation.location },
  };
}

export function getLocationQualityError(
  location: LocationObservation,
  now = new Date(),
): string | null {
  if (location.accuracyMeters > MAX_LOCATION_ACCURACY_METERS) {
    return `La ubicación debe tener una precisión de ${MAX_LOCATION_ACCURACY_METERS} metros o mejor`;
  }
  const ageMs = now.getTime() - Date.parse(location.capturedAt);
  if (ageMs < -30_000) return 'La fecha de la ubicación no puede estar en el futuro';
  if (ageMs > MAX_LOCATION_AGE_MS) return 'La ubicación ha caducado; obtén una nueva';
  return null;
}

/** Great-circle distance between two coordinates, calculated using Haversine. */
export function distanceBetweenMeters(
  first: Pick<LocationObservation, 'latitude' | 'longitude'>,
  second: Pick<LocationObservation, 'latitude' | 'longitude'>,
): number {
  const earthRadiusMeters = 6_371_000;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
