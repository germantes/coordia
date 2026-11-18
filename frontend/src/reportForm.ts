export interface ReportCoordinates {
  latitude: number;
  longitude: number;
}

export interface ReportFormValues {
  category: string;
  description: string;
  location: ReportCoordinates | null;
  occurredAt: string;
}

export interface ReportFormView extends ReportFormValues {
  fields: Record<string, string>;
  formError: string;
  success: { id: string | number; status: string } | null;
}

export const REPORT_FORM_MESSAGES = {
  categoryRequired: 'Selecciona una categoría.',
  descriptionLength: 'Escribe entre 10 y 2.000 caracteres.',
  locationRequired: 'Selecciona la ubicación en el mapa.',
  occurredAtFuture: 'La fecha del incidente no puede estar en el futuro.',
  geolocationUnsupported: 'Este navegador no permite obtener la ubicación. Selecciona el punto directamente en el mapa.',
  geolocationFailed: 'No se pudo obtener tu ubicación. Comprueba los permisos o selecciona el punto en el mapa.',
  connectionFailed: 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.',
  submitFailed: 'No se pudo enviar el reporte. Inténtalo de nuevo.',
} as const;

export type ReportSubmitOutcome =
  | { type: 'client-invalid'; fields: Record<string, string> }
  | { type: 'network-error' }
  | { type: 'api-error'; error: string; fields?: Record<string, string> }
  | { type: 'success'; id: string | number; status: string };

export function validateClientReport(values: ReportFormValues, now = Date.now()): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!values.category) fields.category = REPORT_FORM_MESSAGES.categoryRequired;
  if (values.description.trim().length < 10 || values.description.trim().length > 2_000) {
    fields.description = REPORT_FORM_MESSAGES.descriptionLength;
  }
  if (!values.location) fields.location = REPORT_FORM_MESSAGES.locationRequired;
  if (values.occurredAt && new Date(values.occurredAt).getTime() > now) {
    fields.occurredAt = REPORT_FORM_MESSAGES.occurredAtFuture;
  }
  return fields;
}

export interface SubmitErrorFeedback {
  fields: Record<string, string>;
  formError: string;
  success: null;
}

export function submitErrorFeedback(
  outcome: Extract<ReportSubmitOutcome, { type: 'network-error' | 'api-error' }>,
): SubmitErrorFeedback {
  if (outcome.type === 'api-error') {
    return { fields: outcome.fields ?? {}, formError: outcome.error, success: null };
  }
  return { fields: {}, formError: REPORT_FORM_MESSAGES.connectionFailed, success: null };
}

export function nextReportFormState(values: ReportFormValues, outcome: ReportSubmitOutcome): ReportFormView {
  if (outcome.type === 'success') {
    return {
      category: '',
      description: '',
      occurredAt: '',
      location: null,
      fields: {},
      formError: '',
      success: { id: outcome.id, status: outcome.status },
    };
  }

  if (outcome.type === 'client-invalid') {
    return { ...copyValues(values), fields: outcome.fields, formError: '', success: null };
  }

  return { ...copyValues(values), ...submitErrorFeedback(outcome) };
}

function copyValues(values: ReportFormValues): ReportFormValues {
  return {
    category: values.category,
    description: values.description,
    occurredAt: values.occurredAt,
    location: values.location ? { ...values.location } : null,
  };
}
