import { expect, it } from 'vitest';
import {
  nextReportFormState,
  REPORT_FORM_MESSAGES,
  submitErrorFeedback,
  validateClientReport,
} from '../src/reportForm.js';

const draft = {
  category: 'safety',
  description: 'Hay una señal de tráfico caída en la calzada.',
  location: { latitude: 36.7213, longitude: -4.4214 },
  occurredAt: '2026-11-10T08:30',
};

it('CA-2 blocks an incomplete report and returns Spanish field errors', () => {
  const fields = validateClientReport({
    category: '',
    description: '',
    location: null,
    occurredAt: '',
  });

  expect(fields).toEqual({
    category: REPORT_FORM_MESSAGES.categoryRequired,
    description: REPORT_FORM_MESSAGES.descriptionLength,
    location: REPORT_FORM_MESSAGES.locationRequired,
  });
});

it('CA-2 treats a missing GPS fix as a missing location', () => {
  const fields = validateClientReport({
    category: draft.category,
    description: draft.description,
    location: null,
    occurredAt: '',
  });

  expect(fields).toEqual({ location: REPORT_FORM_MESSAGES.locationRequired });
});

it('CA-2 explains GPS unavailability and permission errors in Spanish', () => {
  expect(REPORT_FORM_MESSAGES.geolocationUnsupported).toBe(
    'Este navegador no permite obtener la ubicación. Selecciona el punto directamente en el mapa.',
  );
  expect(REPORT_FORM_MESSAGES.geolocationFailed).toBe(
    'No se pudo obtener tu ubicación. Comprueba los permisos o selecciona el punto en el mapa.',
  );
});

it('CA-4 keeps the draft in session when the send is not confirmed', () => {
  const network = { ...draft, ...submitErrorFeedback({ type: 'network-error' }) };
  const api = {
    ...draft,
    ...submitErrorFeedback({
      type: 'api-error',
      error: 'Datos del reporte no válidos',
      fields: { description: 'La descripción debe tener entre 10 y 2.000 caracteres' },
    }),
  };

  expect(network.formError).toBe(REPORT_FORM_MESSAGES.connectionFailed);
  expect(network.success).toBeNull();
  expect(network).toMatchObject(draft);
  expect(api.formError).toBe('Datos del reporte no válidos');
  expect(api).toMatchObject(draft);
});

it('keeps edits made while a submit is pending if the request fails', () => {
  const submitted = draft;
  const editedDuringWait = {
    ...draft,
    description: 'Texto editado mientras se enviaba el reporte.',
  };
  const feedback = submitErrorFeedback({ type: 'network-error' });
  const next = { ...editedDuringWait, ...feedback };

  expect(Object.keys(feedback).sort()).toEqual(['fields', 'formError', 'success']);
  expect(next.description).toBe(editedDuringWait.description);
  expect(next.description).not.toBe(submitted.description);
  expect(next.category).toBe(editedDuringWait.category);
  expect(next.location).toEqual(editedDuringWait.location);
  expect(next.formError).toBe(REPORT_FORM_MESSAGES.connectionFailed);
  expect(next.success).toBeNull();
});

it('clears the form only after a confirmed send', () => {
  const next = nextReportFormState(draft, { type: 'success', id: 'report-1', status: 'pending' });

  expect(next).toEqual({
    category: '',
    description: '',
    occurredAt: '',
    location: null,
    fields: {},
    formError: '',
    success: { id: 'report-1', status: 'pending' },
  });
});
