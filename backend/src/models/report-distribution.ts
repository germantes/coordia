import { randomUUID } from 'node:crypto';
import type { ReportCategory } from '../validation/report.js';
import {
  AgencyCatalog,
  resolveIncidentRouting,
  type AgencyId,
  type IncidentCriticality,
  type IncidentType,
} from './recipient-matrix.js';
import {
  evaluateUrgentAdmission,
  evaluateUrgentResolution,
  isUrgentCriticality,
  type OpenUrgentReportCandidate,
  type UrgentAdmissionResult,
  type UrgentLocationInput,
  type UrgentResolutionState,
} from '../validation/urgent-report.js';

export type DeliveryRole = 'primary' | 'secondary' | 'pre_alert' | 'cancellation';
export type DeliveryStatus = 'delivered' | 'queued' | 'retry_pending' | 'failed' | 'cancelled';

export interface DeliveryPayload {
  reportId: string;
  category: ReportCategory;
  incidentType: IncidentType;
  criticality: IncidentCriticality;
  location: { latitude: number; longitude: number };
  timestamp: string;
  urgent: boolean;
  pendingConfirmation: boolean;
}

export interface DeliveryRecord {
  id: string;
  reportId: string;
  agencyId: AgencyId;
  originalAgencyId: AgencyId;
  redirectedTo24x7: boolean;
  role: DeliveryRole;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  scheduledFor?: string;
  deliveredAt?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  lastError?: string;
  payload: DeliveryPayload;
}

export interface ReportDistributionSummary {
  reportId: string;
  category: ReportCategory;
  incidentType: IncidentType;
  criticality: IncidentCriticality;
  urgent: boolean;
  urgentState?: UrgentResolutionState;
  admission?: UrgentAdmissionResult;
  linkedToReportId?: string;
  fastTrackRadiusMeters?: number;
  secondaryDispatched: boolean;
  citizenConfirmations: number;
  citizenRejections: number;
  institutionalConfirmations: number;
  institutionalRejections: number;
  deliveries: DeliveryRecord[];
}

export const DEFAULT_MAX_DELIVERY_ATTEMPTS = 3;
export const DEFAULT_RETRY_BACKOFF_MS = 60 * 1_000;

/**
 * Motor de enrutamiento, despacho 24/7, cola horaria diferida, protocolo de urgencias no verificadas
 * y registro de entregas con reintentos (HU-07 · T2).
 */
export class ReportDistribution {
  private static readonly summaries = new Map<string, Omit<ReportDistributionSummary, 'deliveries'>>();
  private static readonly deliveries = new Map<string, DeliveryRecord>();
  private static readonly openUrgentCandidates = new Map<string, OpenUrgentReportCandidate>();
  private static readonly simulatedFailures = new Map<AgencyId, string>();

  static reset(): void {
    this.summaries.clear();
    this.deliveries.clear();
    this.openUrgentCandidates.clear();
    this.simulatedFailures.clear();
  }

  static setSimulatedFailure(agencyId: AgencyId, errorMessage = 'Error de conexión con organismo receptor'): void {
    this.simulatedFailures.set(agencyId, errorMessage);
  }

  static clearSimulatedFailure(agencyId?: AgencyId): void {
    if (agencyId) {
      this.simulatedFailures.delete(agencyId);
    } else {
      this.simulatedFailures.clear();
    }
  }

  private static attemptDispatch(
    record: DeliveryRecord,
    nowIso: string,
  ): DeliveryRecord {
    const failureReason = this.simulatedFailures.get(record.agencyId);
    const attempts = record.attempts + 1;
    record.attempts = attempts;
    record.lastAttemptAt = nowIso;

    if (failureReason) {
      record.lastError = failureReason;
      if (attempts >= record.maxAttempts) {
        record.status = 'failed';
        delete record.nextRetryAt;
      } else {
        record.status = 'retry_pending';
        record.nextRetryAt = new Date(Date.parse(nowIso) + DEFAULT_RETRY_BACKOFF_MS * attempts).toISOString();
      }
      this.deliveries.set(record.id, { ...record });
      return { ...record };
    }

    record.status = 'delivered';
    record.deliveredAt = nowIso;
    delete record.lastError;
    delete record.nextRetryAt;
    this.deliveries.set(record.id, { ...record });
    return { ...record };
  }

  private static createAndDispatchRecord(input: {
    reportId: string;
    agencyId: AgencyId;
    role: DeliveryRole;
    payload: DeliveryPayload;
    nowIso: string;
    maxAttempts?: number;
    forceImmediate24x7?: boolean;
  }): DeliveryRecord {
    const dispatch = input.forceImmediate24x7
      ? {
          targetAgencyId: input.agencyId,
          originalAgencyId: input.agencyId,
          redirectedTo24x7: false,
          immediate: true,
        }
      : AgencyCatalog.resolveDispatchTarget(input.agencyId, {
          timestamp: input.payload.timestamp,
          urgent: input.payload.urgent,
          category: input.payload.category,
        });

    const record: DeliveryRecord = {
      id: randomUUID(),
      reportId: input.reportId,
      agencyId: dispatch.targetAgencyId,
      originalAgencyId: dispatch.originalAgencyId,
      redirectedTo24x7: dispatch.redirectedTo24x7,
      role: input.role,
      status: dispatch.immediate ? 'delivered' : 'queued',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_DELIVERY_ATTEMPTS,
      createdAt: input.nowIso,
      ...(dispatch.scheduledFor ? { scheduledFor: dispatch.scheduledFor } : {}),
      payload: { ...input.payload },
    };

    if (!dispatch.immediate) {
      this.deliveries.set(record.id, { ...record });
      return { ...record };
    }

    return this.attemptDispatch(record, input.nowIso);
  }

  /**
   * Enruta un reporte recién creado según la matriz de destinatarios, su régimen horario
   * y las reglas de admisión/pre-alerta de urgencias no verificadas.
   */
  static distributeNewReport(input: {
    reportId: string;
    category: ReportCategory;
    description?: string;
    incidentType?: IncidentType;
    location: UrgentLocationInput;
    occurredAt?: string;
    createdAt?: string;
    status?: string;
    urgent?: boolean;
    maxAttempts?: number;
  }): ReportDistributionSummary {
    // La creación de un reporte puede reintentarse desde el cliente o el servidor.
    // Un mismo reportId debe conservar su registro de entregas, nunca generar otro.
    const existingSummary = this.getSummary(input.reportId);
    if (existingSummary) return existingSummary;

    const createdAt = input.createdAt ?? new Date().toISOString();
    const effectiveTimestamp = input.occurredAt ?? createdAt;
    const rule = resolveIncidentRouting(input.category, {
      incidentType: input.incidentType,
      description: input.description,
      urgent: input.urgent,
    });
    const urgent = isUrgentCriticality(rule.criticality, input.urgent);
    const status = input.status ?? 'pending';

    const basePayload: DeliveryPayload = {
      reportId: input.reportId,
      category: input.category,
      incidentType: rule.incidentType,
      criticality: rule.criticality,
      location: {
        latitude: input.location.latitude,
        longitude: input.location.longitude,
      },
      timestamp: effectiveTimestamp,
      urgent,
      pendingConfirmation: urgent && status === 'pending',
    };

    if (urgent && status === 'pending') {
      const admission = evaluateUrgentAdmission(
        {
          category: input.category,
          incidentType: rule.incidentType,
          location: input.location,
          timestamp: effectiveTimestamp,
        },
        [...this.openUrgentCandidates.values()],
      );

      if (!admission.admitted) {
        const rejectedSummary: Omit<ReportDistributionSummary, 'deliveries'> = {
          reportId: input.reportId,
          category: input.category,
          incidentType: rule.incidentType,
          criticality: rule.criticality,
          urgent: true,
          admission,
          secondaryDispatched: false,
          citizenConfirmations: 0,
          citizenRejections: 0,
          institutionalConfirmations: 0,
          institutionalRejections: 0,
        };
        this.summaries.set(input.reportId, rejectedSummary);
        return this.getSummary(input.reportId)!;
      }

      if (admission.duplicateOfReportId) {
        const duplicateSummary: Omit<ReportDistributionSummary, 'deliveries'> = {
          reportId: input.reportId,
          category: input.category,
          incidentType: rule.incidentType,
          criticality: rule.criticality,
          urgent: true,
          urgentState: 'pre_alert_active',
          admission,
          linkedToReportId: admission.duplicateOfReportId,
          fastTrackRadiusMeters: admission.fastTrackRadiusMeters,
          secondaryDispatched: false,
          citizenConfirmations: 0,
          citizenRejections: 0,
          institutionalConfirmations: 0,
          institutionalRejections: 0,
        };
        this.summaries.set(input.reportId, duplicateSummary);
        return this.getSummary(input.reportId)!;
      }

      this.openUrgentCandidates.set(input.reportId, {
        id: input.reportId,
        category: input.category,
        incidentType: rule.incidentType,
        location: {
          latitude: input.location.latitude,
          longitude: input.location.longitude,
        },
        occurredAt: input.occurredAt,
        createdAt,
        status,
        urgent: true,
      });

      const primaryDispatch = AgencyCatalog.resolveDispatchTarget(rule.primary, {
        timestamp: effectiveTimestamp,
        urgent: true,
        category: input.category,
      });
      const preAlertSet = new Set<AgencyId>([
        ...rule.urgentPreAlertTargets,
        primaryDispatch.targetAgencyId,
      ]);

      for (const agencyId of preAlertSet) {
        this.createAndDispatchRecord({
          reportId: input.reportId,
          agencyId,
          role: 'pre_alert',
          payload: basePayload,
          nowIso: createdAt,
          maxAttempts: input.maxAttempts,
          forceImmediate24x7: true,
        });
      }

      const summary: Omit<ReportDistributionSummary, 'deliveries'> = {
        reportId: input.reportId,
        category: input.category,
        incidentType: rule.incidentType,
        criticality: rule.criticality,
        urgent: true,
        urgentState: 'pre_alert_active',
        admission,
        fastTrackRadiusMeters: admission.fastTrackRadiusMeters,
        secondaryDispatched: false,
        citizenConfirmations: 0,
        citizenRejections: 0,
        institutionalConfirmations: 0,
        institutionalRejections: 0,
      };
      this.summaries.set(input.reportId, summary);
      return this.getSummary(input.reportId)!;
    }

    // Reporte ordinario (no urgente) o ya verificado: despacho primario y secundario según régimen horario.
    const notifiedTargets = new Set<AgencyId>();
    const primaryRecord = this.createAndDispatchRecord({
      reportId: input.reportId,
      agencyId: rule.primary,
      role: 'primary',
      payload: basePayload,
      nowIso: createdAt,
      maxAttempts: input.maxAttempts,
    });
    notifiedTargets.add(primaryRecord.agencyId);

    for (const secondaryAgency of rule.secondary) {
      const resolved = AgencyCatalog.resolveDispatchTarget(secondaryAgency, {
        timestamp: effectiveTimestamp,
        urgent,
        category: input.category,
      });
      if (resolved.immediate && notifiedTargets.has(resolved.targetAgencyId)) {
        continue;
      }
      const secRecord = this.createAndDispatchRecord({
        reportId: input.reportId,
        agencyId: secondaryAgency,
        role: 'secondary',
        payload: basePayload,
        nowIso: createdAt,
        maxAttempts: input.maxAttempts,
      });
      if (secRecord.status !== 'queued') {
        notifiedTargets.add(secRecord.agencyId);
      }
    }

    const summary: Omit<ReportDistributionSummary, 'deliveries'> = {
      reportId: input.reportId,
      category: input.category,
      incidentType: rule.incidentType,
      criticality: rule.criticality,
      urgent,
      secondaryDispatched: true,
      citizenConfirmations: 0,
      citizenRejections: 0,
      institutionalConfirmations: 0,
      institutionalRejections: 0,
    };
    this.summaries.set(input.reportId, summary);
    return this.getSummary(input.reportId)!;
  }

  /**
   * Registra confirmaciones o rechazos (ciudadanos o institucionales) y ejecuta la transición
   * correspondiente en urgencias no verificadas (despacho secundario completo o cancelación).
   */
  static recordVerificationSignal(input: {
    reportId: string;
    citizenConfirmations?: number;
    citizenRejections?: number;
    institutionalConfirmations?: number;
    institutionalRejections?: number;
    now?: string;
  }): ReportDistributionSummary | null {
    const summary = this.summaries.get(input.reportId);
    if (!summary) return null;

    if (input.citizenConfirmations !== undefined) {
      summary.citizenConfirmations = input.citizenConfirmations;
    }
    if (input.citizenRejections !== undefined) {
      summary.citizenRejections = input.citizenRejections;
    }
    if (input.institutionalConfirmations !== undefined) {
      summary.institutionalConfirmations = input.institutionalConfirmations;
    }
    if (input.institutionalRejections !== undefined) {
      summary.institutionalRejections = input.institutionalRejections;
    }

    if (!summary.urgent || !summary.urgentState) {
      return this.getSummary(input.reportId);
    }

    const nowIso = input.now ?? new Date().toISOString();
    const openCandidate = this.openUrgentCandidates.get(input.reportId);
    const createdAt = openCandidate?.createdAt ?? nowIso;

    const nextState = evaluateUrgentResolution({
      createdAt,
      now: nowIso,
      citizenConfirmations: summary.citizenConfirmations,
      citizenRejections: summary.citizenRejections,
      institutionalConfirmations: summary.institutionalConfirmations,
      institutionalRejections: summary.institutionalRejections,
    });

    if (nextState === 'confirmed' && summary.urgentState !== 'confirmed') {
      return this.confirmUrgentReport(input.reportId, nowIso);
    }
    if (nextState === 'refuted' && summary.urgentState !== 'refuted') {
      return this.refuteUrgentReport(input.reportId, nowIso);
    }
    if (nextState === 'pending_manual_review' && summary.urgentState === 'pre_alert_active') {
      summary.urgentState = 'pending_manual_review';
    }

    return this.getSummary(input.reportId);
  }

  /**
   * Completa el despacho a todos los organismos previstos en la matriz tras confirmarse la urgencia (4.4).
   */
  static confirmUrgentReport(reportId: string, nowIso = new Date().toISOString()): ReportDistributionSummary | null {
    const summary = this.summaries.get(reportId);
    if (!summary) return null;

    summary.urgentState = 'confirmed';
    if (summary.secondaryDispatched) {
      return this.getSummary(reportId);
    }

    const rule = resolveIncidentRouting(summary.category, {
      incidentType: summary.incidentType,
      urgent: summary.urgent,
    });
    const existingDeliveries = this.listDeliveriesForReport(reportId);
    const basePayload: DeliveryPayload = existingDeliveries[0]?.payload
      ? { ...existingDeliveries[0].payload, pendingConfirmation: false }
      : {
          reportId,
          category: summary.category,
          incidentType: summary.incidentType,
          criticality: summary.criticality,
          location: { latitude: 36.7213, longitude: -4.4214 },
          timestamp: nowIso,
          urgent: summary.urgent,
          pendingConfirmation: false,
        };

    const alreadyNotified = new Set<AgencyId>(
      existingDeliveries
        .filter((d) => d.status === 'delivered' || d.status === 'retry_pending')
        .map((d) => d.agencyId),
    );

    if (!alreadyNotified.has(rule.primary)) {
      const primaryRecord = this.createAndDispatchRecord({
        reportId,
        agencyId: rule.primary,
        role: 'primary',
        payload: basePayload,
        nowIso,
      });
      alreadyNotified.add(primaryRecord.agencyId);
    }

    for (const secondaryAgency of rule.secondary) {
      const resolved = AgencyCatalog.resolveDispatchTarget(secondaryAgency, {
        timestamp: basePayload.timestamp,
        urgent: summary.urgent,
        category: summary.category,
      });
      if (alreadyNotified.has(secondaryAgency) || (resolved.immediate && alreadyNotified.has(resolved.targetAgencyId))) {
        continue;
      }
      const secRecord = this.createAndDispatchRecord({
        reportId,
        agencyId: secondaryAgency,
        role: 'secondary',
        payload: basePayload,
        nowIso,
      });
      alreadyNotified.add(secRecord.agencyId);
    }

    summary.secondaryDispatched = true;
    const candidate = this.openUrgentCandidates.get(reportId);
    if (candidate) candidate.status = 'validated';

    return this.getSummary(reportId);
  }

  /**
   * Emite aviso inmediato de cancelación a los centros notificados cuando se refuta una urgencia (4.4).
   */
  static refuteUrgentReport(reportId: string, nowIso = new Date().toISOString()): ReportDistributionSummary | null {
    const summary = this.summaries.get(reportId);
    if (!summary) return null;

    summary.urgentState = 'refuted';
    const candidate = this.openUrgentCandidates.get(reportId);
    if (candidate) candidate.status = 'rejected';

    const existingDeliveries = this.listDeliveriesForReport(reportId);
    const notifiedAgencies = new Set<AgencyId>();

    for (const delivery of existingDeliveries) {
      if (delivery.role !== 'cancellation') {
        notifiedAgencies.add(delivery.agencyId);
        const updated = { ...delivery, status: 'cancelled' as const };
        this.deliveries.set(delivery.id, updated);
      }
    }

    const samplePayload = existingDeliveries[0]?.payload;
    if (samplePayload) {
      for (const agencyId of notifiedAgencies) {
        this.createAndDispatchRecord({
          reportId,
          agencyId,
          role: 'cancellation',
          payload: { ...samplePayload, pendingConfirmation: false },
          nowIso,
          forceImmediate24x7: true,
        });
      }
    }

    return this.getSummary(reportId);
  }

  /**
   * Evalúa el vencimiento de 10 minutos sin confirmación (sección 4.4):
   * Nunca bloquea ni anula automáticamente el aviso; lo pasa a 'pending_manual_review'.
   */
  static checkManualReviewTimeout(reportId: string, now: string | Date = new Date()): ReportDistributionSummary | null {
    const summary = this.summaries.get(reportId);
    if (!summary || !summary.urgent || summary.urgentState !== 'pre_alert_active') {
      return this.getSummary(reportId);
    }
    const nowIso = typeof now === 'string' ? now : now.toISOString();
    return this.recordVerificationSignal({ reportId, now: nowIso });
  }

  /** Procesa envíos horarios y reintentos cuyo momento programado ya se cumplió. */
  static processDueQueue(now: string | Date = new Date()): DeliveryRecord[] {
    const nowIso = typeof now === 'string' ? new Date(now).toISOString() : now.toISOString();
    const nowMs = Date.parse(nowIso);
    const processed: DeliveryRecord[] = [];

    for (const record of this.deliveries.values()) {
      const dueAt = record.status === 'queued' ? record.scheduledFor
        : record.status === 'retry_pending' ? record.nextRetryAt
          : undefined;
      if (!dueAt) continue;
      if (Date.parse(dueAt) <= nowMs) {
        processed.push(this.attemptDispatch({ ...record }, nowIso));
      }
    }

    return processed;
  }

  /** Reintenta una entrega específica pendiente de reintento o fallida. */
  static retryDelivery(deliveryId: string, now: string | Date = new Date()): DeliveryRecord | null {
    const existing = this.deliveries.get(deliveryId);
    if (!existing) return null;
    if (existing.status === 'delivered' || existing.status === 'cancelled') {
      return { ...existing };
    }
    if (existing.attempts >= existing.maxAttempts) {
      return { ...existing };
    }
    const nowIso = typeof now === 'string' ? new Date(now).toISOString() : now.toISOString();
    return this.attemptDispatch({ ...existing }, nowIso);
  }

  /** Reintenta todas las entregas con fallo recuperable ('retry_pending') para un reporte o globalmente. */
  static retryPendingDeliveries(options: { reportId?: string; now?: string | Date } = {}): DeliveryRecord[] {
    const nowIso = typeof options.now === 'string'
      ? new Date(options.now).toISOString()
      : (options.now ?? new Date()).toISOString();
    const retried: DeliveryRecord[] = [];

    for (const record of this.deliveries.values()) {
      if (options.reportId && record.reportId !== options.reportId) continue;
      if (record.status !== 'retry_pending') continue;
      if (record.attempts >= record.maxAttempts) continue;
      retried.push(this.attemptDispatch({ ...record }, nowIso));
    }

    return retried;
  }

  static listDeliveriesForReport(reportId: string): DeliveryRecord[] {
    return [...this.deliveries.values()]
      .filter((record) => record.reportId === reportId)
      .map((record) => ({ ...record, payload: { ...record.payload } }));
  }

  static getSummary(reportId: string): ReportDistributionSummary | null {
    const summary = this.summaries.get(reportId);
    if (!summary) return null;
    return {
      ...summary,
      deliveries: this.listDeliveriesForReport(reportId),
    };
  }
}
