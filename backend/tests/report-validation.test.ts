import { describe, expect, it } from 'vitest';
import { REPORT_CATEGORIES, validateCreateReport } from '../src/validation/report.js';

const validInput = {
  category: 'infrastructure',
  description: 'Una farola está caída junto a la acera.',
  location: { latitude: 40.4168, longitude: -3.7038 },
};

describe('report creation validation', () => {
  it('accepts a valid report and trims its description', () => {
    const result = validateCreateReport({ ...validInput, description: `  ${validInput.description}  ` });

    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.description).toBe(validInput.description);
  });

  it('accepts only the initial report categories', () => {
    for (const category of REPORT_CATEGORIES) {
      expect(validateCreateReport({ ...validInput, category }).valid).toBe(true);
    }
    expect(validateCreateReport({ ...validInput, category: 'unknown' }).valid).toBe(false);
  });

  it('rejects missing descriptions and out-of-range coordinates', () => {
    const result = validateCreateReport({
      ...validInput,
      description: 'short',
      location: { latitude: 91, longitude: -181 },
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.description).toBeDefined();
      expect(result.errors['location.latitude']).toBeDefined();
      expect(result.errors['location.longitude']).toBeDefined();
    }
  });

  it('rejects client-supplied ownership and future incident dates', () => {
    const result = validateCreateReport({
      ...validInput,
      ownerId: 'forged-owner',
      occurredAt: '2030-01-01T00:00:00Z',
    }, new Date('2026-11-10T00:00:00Z'));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.ownerId).toBe('Campo no permitido');
      expect(result.errors.occurredAt).toContain('futuro');
    }
  });
});
