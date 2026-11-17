import { distanceBetweenMeters, getLocationQualityError, validateLocationObservation } from './report-response.js';

export const REPORT_CATEGORIES = [
  'infrastructure',
  'safety',
  'accessibility',
  'environment',
  'other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface CreateReportInput {
  category: ReportCategory;
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  occurredAt?: string;
}

export type CreateReportValidation =
  | { valid: true; data: CreateReportInput; creatorProximityMeters?: number }
  | { valid: false; errors: Record<string, string> };

const allowedFields = new Set(['category', 'description', 'location', 'occurredAt', 'creatorObservation']);
const allowedLocationFields = new Set(['latitude', 'longitude']);
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateCreateReport(
  input: unknown,
  now = new Date(),
): CreateReportValidation {
  const errors: Record<string, string> = {};
  if (!isRecord(input)) {
    return { valid: false, errors: { _form: 'El cuerpo debe ser un objeto JSON' } };
  }

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) errors[field] = 'Campo no permitido';
  }

  let category: ReportCategory | undefined;
  if (typeof input.category !== 'string' || !REPORT_CATEGORIES.includes(input.category as ReportCategory)) {
    errors.category = 'Selecciona una categoría válida';
  } else {
    category = input.category as ReportCategory;
  }

  let description: string | undefined;
  if (typeof input.description !== 'string') {
    errors.description = 'La descripción es obligatoria';
  } else {
    const normalized = input.description.trim();
    if (normalized.length < 10 || normalized.length > 2_000) {
      errors.description = 'La descripción debe tener entre 10 y 2.000 caracteres';
    } else {
      description = normalized;
    }
  }

  let location: CreateReportInput['location'] | undefined;
  if (!isRecord(input.location)) {
    errors.location = 'La ubicación es obligatoria';
  } else {
    for (const field of Object.keys(input.location)) {
      if (!allowedLocationFields.has(field)) errors[`location.${field}`] = 'Campo no permitido';
    }

    const { latitude, longitude } = input.location;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors['location.latitude'] = 'La latitud debe ser un número entre -90 y 90';
    }
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors['location.longitude'] = 'La longitud debe ser un número entre -180 y 180';
    }
    if (typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
      location = { latitude, longitude };
    }
  }

  let occurredAt: string | undefined;
  if (input.occurredAt !== undefined) {
    if (typeof input.occurredAt !== 'string' || !isoDateTimePattern.test(input.occurredAt)
      || !Number.isFinite(Date.parse(input.occurredAt))) {
      errors.occurredAt = 'La fecha debe ser una fecha y hora ISO 8601 válida';
    } else if (Date.parse(input.occurredAt) > now.getTime()) {
      errors.occurredAt = 'La fecha del incidente no puede estar en el futuro';
    } else {
      occurredAt = new Date(input.occurredAt).toISOString();
    }
  }

  let creatorProximityMeters: number | undefined;
  if (input.creatorObservation !== undefined) {
    const observed = validateLocationObservation(input.creatorObservation);
    if (!observed.valid) errors.creatorObservation = 'La observación GPS no es válida';
    else if (location && !getLocationQualityError(observed.location, now)) {
      creatorProximityMeters = distanceBetweenMeters(location, observed.location);
    }
  }

  if (Object.keys(errors).length > 0 || !category || !description || !location) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    ...(creatorProximityMeters === undefined ? {} : { creatorProximityMeters }),
    data: {
      category,
      description,
      location,
      ...(occurredAt ? { occurredAt } : {}),
    },
  };
}
