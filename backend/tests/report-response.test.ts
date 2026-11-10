import { describe, expect, it } from 'vitest';
import {
  distanceBetweenMeters,
  getLocationQualityError,
  MAX_RESPONSE_DISTANCE_METERS,
  validateLocationObservation,
  validateSubmitReportResponse,
} from '../src/validation/report-response.js';

const freshLocation = {
  latitude: 40.4168,
  longitude: -3.7038,
  accuracyMeters: 25,
  capturedAt: '2026-11-10T10:00:00.000Z',
};

describe('report response validation and proximity rules', () => {
  it('accepts a valid confirm/question response and fresh location', () => {
    const result = validateSubmitReportResponse({ response: 'confirm', location: freshLocation });
    expect(result.valid).toBe(true);
  });

  it('rejects unknown response fields and invalid coordinates', () => {
    const result = validateSubmitReportResponse({
      response: 'approve',
      ownerId: 'forged-user',
      location: { ...freshLocation, latitude: 91 },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.response).toBeDefined();
      expect(result.errors.ownerId).toBe('Campo no permitido');
      expect(result.errors['location.latitude']).toBeDefined();
    }
  });

  it('requires fresh and sufficiently accurate location', () => {
    const now = new Date('2026-11-10T10:00:00.000Z');
    expect(getLocationQualityError({ ...freshLocation, accuracyMeters: 101 }, now)).toContain('precisión');
    expect(getLocationQualityError({ ...freshLocation, capturedAt: '2026-11-10T09:54:59.000Z' }, now)).toContain('caducado');
    expect(getLocationQualityError(freshLocation, now)).toBeNull();
  });

  it('calculates the proximity radius using great-circle distance', () => {
    const origin = { latitude: 0, longitude: 0 };
    const withinRadius = { latitude: 0, longitude: 0.004 };
    const outsideRadius = { latitude: 0, longitude: 0.006 };

    expect(distanceBetweenMeters(origin, withinRadius)).toBeLessThan(MAX_RESPONSE_DISTANCE_METERS);
    expect(distanceBetweenMeters(origin, outsideRadius)).toBeGreaterThan(MAX_RESPONSE_DISTANCE_METERS);
  });
});
