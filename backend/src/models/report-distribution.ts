import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../database.js';
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
  URGENT_DUPLICATE_WINDOW_MS,
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

// Aviso recibido en la bandeja de un organismo destinatario (CA-2).
export interface AgencyInboxEntry {
  deliveryId: string;
  agencyId: AgencyId;
  reportId: string;
  role: DeliveryRole;
  payload: DeliveryPayload;
  receivedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

interface StoredSummary {
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
  location: { latitude: number; longitude: number };
  createdAt: string;
  timestamp: string;
}

export interface ReportDistributionSummary extends StoredSummary {
  deliveries: DeliveryRecord[];
}

export interface DistributeReportInput {
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
}

export const DEFAULT_MAX_DELIVERY_ATTEMPTS = 3;
export const DEFAULT_RETRY_BACKOFF_MS = 60 * 1_000;
export const DEFAULT_DISTRIBUTION_INTERVAL_MS = 30_000;

const toIso = (value: string | Date = new Date()) => new Date(value).toISOString();

// Motor persistente en SQLite de enrutamiento, cola diferida, bandeja de organismos y reintentos (HU-07 · T2).
export class ReportDistribution {
  private static activeInstance: ReportDistribution | null = null;

  private readonly db: Database;
  private readonly ownsDb: boolean;
  private readonly simulatedFailures = new Map<AgencyId, string>();
  private transactionDepth = 0;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(pathOrDb: string | Database = ':memory:') {
    if (typeof pathOrDb === 'string') {
      this.db = openDatabase(pathOrDb);
      this.ownsDb = true;
    } else {
      this.db = pathOrDb;
      this.ownsDb = false;
    }
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS distribution_summaries (
        reportId TEXT PRIMARY KEY, timestamp TEXT NOT NULL, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS summaries_by_time ON distribution_summaries(timestamp);
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, reportId TEXT NOT NULL, agencyId TEXT NOT NULL, role TEXT NOT NULL,
        status TEXT NOT NULL, dueAt TEXT, data TEXT NOT NULL,
        UNIQUE(reportId, agencyId, role)
      );
      CREATE INDEX IF NOT EXISTS deliveries_by_report ON deliveries(reportId);
      CREATE INDEX IF NOT EXISTS deliveries_due ON deliveries(status, dueAt);
      CREATE TABLE IF NOT EXISTS agency_inbox (
        deliveryId TEXT PRIMARY KEY REFERENCES deliveries(id) ON DELETE CASCADE,
        agencyId TEXT NOT NULL, reportId TEXT NOT NULL, role TEXT NOT NULL, payload TEXT NOT NULL,
        receivedAt TEXT NOT NULL, acknowledgedAt TEXT, acknowledgedBy TEXT
      );
      CREATE INDEX IF NOT EXISTS inbox_by_agency ON agency_inbox(agencyId, receivedAt);
      CREATE TABLE IF NOT EXISTS distribution_orders (
        reportId TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL
      );
    `);
    ReportDistribution.activeInstance = this;
  }

  private static current(): ReportDistribution {
    if (!this.activeInstance) this.activeInstance = new ReportDistribution(':memory:');
    return this.activeInstance;
  }

  // Inicia el proceso programado que recupera órdenes pendientes y despacha la cola vencida.
  startScheduler(options: { intervalMs?: number; now?: () => Date } = {}): { tick: () => void; stop: () => void } {
    this.stopScheduler();
    const tick = () => {
      if (this.closed) return;
      try {
        this.recoverPendingOrders();
        this.processDueQueue(options.now?.() ?? new Date());
      } catch (error) {
        console.error('Fallo en el proceso programado de distribución', error);
      }
    };
    tick();
    this.schedulerTimer = setInterval(tick, options.intervalMs ?? DEFAULT_DISTRIBUTION_INTERVAL_MS);
    this.schedulerTimer.unref();
    return { tick, stop: () => this.stopScheduler() };
  }

  stopScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  close(): void {
    this.closed = true;
    this.stopScheduler();
    if (this.ownsDb) this.db.close();
    if (ReportDistribution.activeInstance === this) ReportDistribution.activeInstance = null;
  }

  reset(): void {
    this.db.exec(`
      DELETE FROM distribution_orders;
      DELETE FROM agency_inbox;
      DELETE FROM deliveries;
      DELETE FROM distribution_summaries;
    `);
    this.simulatedFailures.clear();
  }

  setSimulatedFailure(agencyId: AgencyId, errorMessage = 'Error de conexión con organismo receptor'): void {
    this.simulatedFailures.set(agencyId, errorMessage);
  }

  clearSimulatedFailure(agencyId?: AgencyId): void {
    if (agencyId) this.simulatedFailures.delete(agencyId);
    else this.simulatedFailures.clear();
  }

  private transaction<T>(work: () => T): T {
    if (this.transactionDepth > 0) {
      this.transactionDepth += 1;
      try { return work(); } finally { this.transactionDepth -= 1; }
    }
    this.db.exec('BEGIN IMMEDIATE');
    this.transactionDepth = 1;
    try {
      const value = work();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.transactionDepth = 0;
    }
  }

  private readSummary(reportId: string): StoredSummary | null {
    const row = this.db.prepare('SELECT data FROM distribution_summaries WHERE reportId = ?').get(reportId);
    return row ? JSON.parse(String(row.data)) as StoredSummary : null;
  }

  private saveSummary(summary: StoredSummary): void {
    this.db.prepare(`INSERT INTO distribution_summaries (reportId, timestamp, data) VALUES (?, ?, ?)
      ON CONFLICT(reportId) DO UPDATE SET timestamp = excluded.timestamp, data = excluded.data`)
      .run(summary.reportId, summary.timestamp, JSON.stringify(summary));
  }

  private readDelivery(id: string): DeliveryRecord | null {
    const row = this.db.prepare('SELECT data FROM deliveries WHERE id = ?').get(id);
    return row ? JSON.parse(String(row.data)) as DeliveryRecord : null;
  }

  private findDelivery(reportId: string, agencyId: AgencyId, role: DeliveryRole): DeliveryRecord | null {
    const row = this.db.prepare('SELECT data FROM deliveries WHERE reportId = ? AND agencyId = ? AND role = ?')
      .get(reportId, agencyId, role);
    return row ? JSON.parse(String(row.data)) as DeliveryRecord : null;
  }

  private saveDelivery(record: DeliveryRecord): void {
    const dueAt = record.status === 'queued'
      ? record.scheduledFor ?? null
      : record.status === 'retry_pending' ? record.nextRetryAt ?? null : null;
    this.db.prepare(`INSERT INTO deliveries (id, reportId, agencyId, role, status, dueAt, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, dueAt = excluded.dueAt, data = excluded.data`)
      .run(record.id, record.reportId, record.agencyId, record.role, record.status, dueAt, JSON.stringify(record));
  }

  private openUrgentCandidates(timestamp: string): OpenUrgentReportCandidate[] {
    const center = Date.parse(timestamp);
    const rows = this.db.prepare('SELECT data FROM distribution_summaries WHERE timestamp BETWEEN ? AND ?')
      .all(toIso(new Date(center - URGENT_DUPLICATE_WINDOW_MS)), toIso(new Date(center + URGENT_DUPLICATE_WINDOW_MS)));
    return rows
      .map((row) => JSON.parse(String(row.data)) as StoredSummary)
      .filter((s) => s.urgent && s.admission?.admitted && !s.linkedToReportId && s.urgentState !== 'refuted')
      .map((s) => ({
        id: s.reportId, category: s.category, incidentType: s.incidentType, location: s.location,
        occurredAt: s.timestamp, createdAt: s.createdAt, status: 'pending', urgent: true,
      }));
  }

  private payloadFor(summary: StoredSummary): DeliveryPayload {
    return {
      reportId: summary.reportId, category: summary.category, incidentType: summary.incidentType,
      criticality: summary.criticality, location: { ...summary.location }, timestamp: summary.timestamp,
      urgent: summary.urgent, pendingConfirmation: summary.urgent && summary.urgentState !== undefined && summary.urgentState !== 'confirmed',
    };
  }

  // Deposita el aviso en agency_inbox antes de marcar delivered (CA-2); operación idempotente (CA-4).
  private attemptDispatch(deliveryId: string, nowIso: string): DeliveryRecord | null {
    return this.transaction(() => {
      const record = this.readDelivery(deliveryId);
      if (!record || record.status === 'delivered' || record.status === 'cancelled' || record.attempts >= record.maxAttempts) {
        return record;
      }
      record.attempts += 1;
      record.lastAttemptAt = nowIso;
      const failureReason = this.simulatedFailures.get(record.agencyId);

      if (failureReason) {
        record.lastError = failureReason;
        delete record.scheduledFor;
        if (record.attempts >= record.maxAttempts) {
          record.status = 'failed';
          delete record.nextRetryAt;
        } else {
          record.status = 'retry_pending';
          record.nextRetryAt = toIso(new Date(Date.parse(nowIso) + DEFAULT_RETRY_BACKOFF_MS * record.attempts));
        }
        this.saveDelivery(record);
        return record;
      }

      this.db.prepare(`INSERT OR IGNORE INTO agency_inbox (deliveryId, agencyId, reportId, role, payload, receivedAt)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .run(record.id, record.agencyId, record.reportId, record.role, JSON.stringify(record.payload), nowIso);
      record.status = 'delivered';
      record.deliveredAt = nowIso;
      delete record.lastError;
      delete record.nextRetryAt;
      this.saveDelivery(record);
      return record;
    });
  }

  private createAndDispatchRecord(input: {
    reportId: string; agencyId: AgencyId; role: DeliveryRole; payload: DeliveryPayload;
    nowIso: string; maxAttempts?: number; forceImmediate24x7?: boolean;
  }): DeliveryRecord {
    return this.transaction(() => {
      const dispatch = input.forceImmediate24x7
        ? { targetAgencyId: input.agencyId, originalAgencyId: input.agencyId, redirectedTo24x7: false, immediate: true }
        : AgencyCatalog.resolveDispatchTarget(input.agencyId, {
            timestamp: input.payload.timestamp, urgent: input.payload.urgent, category: input.payload.category,
          });

      const existing = this.findDelivery(input.reportId, dispatch.targetAgencyId, input.role);
      if (existing) return existing;

      const record: DeliveryRecord = {
        id: randomUUID(), reportId: input.reportId, agencyId: dispatch.targetAgencyId,
        originalAgencyId: dispatch.originalAgencyId, redirectedTo24x7: dispatch.redirectedTo24x7,
        role: input.role, status: 'queued', attempts: 0,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_DELIVERY_ATTEMPTS, createdAt: input.nowIso,
        ...(dispatch.scheduledFor ? { scheduledFor: dispatch.scheduledFor } : {}),
        payload: { ...input.payload },
      };
      this.saveDelivery(record);
      return dispatch.immediate ? this.attemptDispatch(record.id, input.nowIso)! : record;
    });
  }

  distributeNewReport(input: DistributeReportInput): ReportDistributionSummary {
    return this.transaction(() => {
      const existing = this.readSummary(input.reportId);
      if (existing && (!existing.admission || !existing.admission.admitted || existing.linkedToReportId
        || this.listDeliveriesForReport(input.reportId).length > 0)) {
        return this.getSummary(input.reportId)!;
      }

      const createdAt = toIso(input.createdAt ?? new Date());
      const timestamp = toIso(input.occurredAt ?? createdAt);
      const rule = resolveIncidentRouting(input.category, {
        incidentType: input.incidentType, description: input.description, urgent: input.urgent,
      });
      const urgent = isUrgentCriticality(rule.criticality, input.urgent);
      const status = input.status ?? 'pending';

      const summary: StoredSummary = existing ?? {
        reportId: input.reportId, category: input.category, incidentType: rule.incidentType,
        criticality: rule.criticality, urgent, secondaryDispatched: false,
        citizenConfirmations: 0, citizenRejections: 0, institutionalConfirmations: 0, institutionalRejections: 0,
        location: { latitude: input.location.latitude, longitude: input.location.longitude }, createdAt, timestamp,
      };

      if (urgent && status === 'pending') {
        const admission = summary.admission ?? evaluateUrgentAdmission(
          { category: input.category, incidentType: rule.incidentType, location: input.location, timestamp },
          this.openUrgentCandidates(timestamp).filter((c) => c.id !== input.reportId),
        );
        summary.admission = admission;
        if (!admission.admitted) {
          this.saveSummary(summary);
          return this.getSummary(input.reportId)!;
        }

        summary.urgentState = summary.urgentState ?? 'pre_alert_active';
        summary.fastTrackRadiusMeters = admission.fastTrackRadiusMeters;
        if (admission.duplicateOfReportId) {
          summary.linkedToReportId = admission.duplicateOfReportId;
          this.saveSummary(summary);
          return this.getSummary(input.reportId)!;
        }

        const payload = this.payloadFor(summary);
        const primaryDispatch = AgencyCatalog.resolveDispatchTarget(rule.primary, {
          timestamp, urgent: true, category: input.category,
        });
        for (const agencyId of new Set<AgencyId>([...rule.urgentPreAlertTargets, primaryDispatch.targetAgencyId])) {
          this.createAndDispatchRecord({
            reportId: input.reportId, agencyId, role: 'pre_alert', payload, nowIso: createdAt,
            maxAttempts: input.maxAttempts, forceImmediate24x7: true,
          });
        }
        this.saveSummary(summary);
        return this.getSummary(input.reportId)!;
      }

      summary.secondaryDispatched = true;
      this.dispatchMatrix(summary, createdAt, new Set(), input.maxAttempts);
      this.saveSummary(summary);
      return this.getSummary(input.reportId)!;
    });
  }

  private dispatchMatrix(summary: StoredSummary, nowIso: string, alreadyNotified: Set<AgencyId>, maxAttempts?: number) {
    const rule = resolveIncidentRouting(summary.category, { incidentType: summary.incidentType, urgent: summary.urgent });
    const payload = this.payloadFor(summary);
    const targets: Array<{ agencyId: AgencyId; role: DeliveryRole }> = [
      { agencyId: rule.primary, role: 'primary' },
      ...rule.secondary.map((agencyId) => ({ agencyId, role: 'secondary' as const })),
    ];
    for (const target of targets) {
      const resolved = AgencyCatalog.resolveDispatchTarget(target.agencyId, {
        timestamp: summary.timestamp, urgent: summary.urgent, category: summary.category,
      });
      if (alreadyNotified.has(resolved.targetAgencyId)) continue;
      const record = this.createAndDispatchRecord({
        reportId: summary.reportId, agencyId: target.agencyId, role: target.role, payload, nowIso, maxAttempts,
      });
      alreadyNotified.add(record.agencyId);
    }
  }

  recordVerificationSignal(input: {
    reportId: string; citizenConfirmations?: number; citizenRejections?: number;
    institutionalConfirmations?: number; institutionalRejections?: number; now?: string;
  }): ReportDistributionSummary | null {
    return this.transaction(() => {
      const summary = this.readSummary(input.reportId);
      if (!summary) return null;

      if (input.citizenConfirmations !== undefined) summary.citizenConfirmations = input.citizenConfirmations;
      if (input.citizenRejections !== undefined) summary.citizenRejections = input.citizenRejections;
      if (input.institutionalConfirmations !== undefined) {
        summary.institutionalConfirmations = Math.max(summary.institutionalConfirmations, input.institutionalConfirmations);
      }
      if (input.institutionalRejections !== undefined) {
        summary.institutionalRejections = Math.max(summary.institutionalRejections, input.institutionalRejections);
      }
      this.saveSummary(summary);

      if (!summary.urgent || !summary.urgentState || summary.urgentState === 'confirmed' || summary.urgentState === 'refuted') {
        return this.getSummary(input.reportId);
      }

      const nowIso = toIso(input.now ?? new Date());
      const nextState = evaluateUrgentResolution({
        createdAt: summary.createdAt, now: nowIso,
        citizenConfirmations: summary.citizenConfirmations, citizenRejections: summary.citizenRejections,
        institutionalConfirmations: summary.institutionalConfirmations, institutionalRejections: summary.institutionalRejections,
      });

      if (nextState === 'confirmed') return this.confirmUrgentReport(input.reportId, nowIso);
      if (nextState === 'refuted') return this.refuteUrgentReport(input.reportId, nowIso);
      if (nextState === 'pending_manual_review' && summary.urgentState === 'pre_alert_active') {
        summary.urgentState = 'pending_manual_review';
        this.saveSummary(summary);
      }
      return this.getSummary(input.reportId);
    });
  }

  confirmUrgentReport(reportId: string, nowIso = toIso()): ReportDistributionSummary | null {
    return this.transaction(() => {
      const summary = this.readSummary(reportId);
      if (!summary) return null;
      if (summary.urgentState === 'refuted') return this.getSummary(reportId);
      if (summary.urgentState) summary.urgentState = 'confirmed';
      if (summary.secondaryDispatched) {
        this.saveSummary(summary);
        return this.getSummary(reportId);
      }
      summary.secondaryDispatched = true;
      this.saveSummary(summary);
      const alreadyNotified = new Set<AgencyId>(
        this.listDeliveriesForReport(reportId)
          .filter((d) => d.role !== 'cancellation' && d.status !== 'cancelled')
          .map((d) => d.agencyId),
      );
      this.dispatchMatrix(summary, nowIso, alreadyNotified);
      return this.getSummary(reportId);
    });
  }

  refuteUrgentReport(reportId: string, nowIso = toIso()): ReportDistributionSummary | null {
    return this.transaction(() => {
      const summary = this.readSummary(reportId);
      if (!summary) return null;
      if (!summary.urgent || !summary.urgentState || summary.urgentState === 'refuted') return this.getSummary(reportId);
      summary.urgentState = 'refuted';
      this.saveSummary(summary);

      const notified = new Set<AgencyId>();
      for (const delivery of this.listDeliveriesForReport(reportId)) {
        if (delivery.role === 'cancellation') continue;
        if (delivery.status === 'delivered') notified.add(delivery.agencyId);
        if (delivery.status === 'delivered' || delivery.status === 'queued' || delivery.status === 'retry_pending') {
          this.saveDelivery({ ...delivery, status: 'cancelled' });
        }
      }

      const payload = { ...this.payloadFor(summary), pendingConfirmation: false };
      for (const agencyId of notified) {
        this.createAndDispatchRecord({ reportId, agencyId, role: 'cancellation', payload, nowIso, forceImmediate24x7: true });
      }
      return this.getSummary(reportId);
    });
  }

  checkManualReviewTimeout(reportId: string, now: string | Date = new Date()): ReportDistributionSummary | null {
    const summary = this.readSummary(reportId);
    if (!summary || !summary.urgent || summary.urgentState !== 'pre_alert_active') return this.getSummary(reportId);
    return this.recordVerificationSignal({ reportId, now: toIso(now) });
  }

  processDueQueue(now: string | Date = new Date()): DeliveryRecord[] {
    const nowIso = toIso(now);
    const due = this.db.prepare(`SELECT id FROM deliveries
      WHERE status IN ('queued', 'retry_pending') AND dueAt IS NOT NULL AND dueAt <= ? ORDER BY dueAt`).all(nowIso);
    return due.map((row) => this.attemptDispatch(String(row.id), nowIso)).filter((r): r is DeliveryRecord => r !== null);
  }

  retryDelivery(deliveryId: string, now: string | Date = new Date()): DeliveryRecord | null {
    return this.attemptDispatch(deliveryId, toIso(now));
  }

  retryPendingDeliveries(options: { reportId?: string; now?: string | Date } = {}): DeliveryRecord[] {
    const nowIso = toIso(options.now ?? new Date());
    const rows = options.reportId
      ? this.db.prepare("SELECT id FROM deliveries WHERE status = 'retry_pending' AND reportId = ?").all(options.reportId)
      : this.db.prepare("SELECT id FROM deliveries WHERE status = 'retry_pending'").all();
    return rows.map((row) => this.attemptDispatch(String(row.id), nowIso)).filter((r): r is DeliveryRecord => r !== null);
  }

  // Registra una orden de distribución durable dentro de la misma transacción SQLite que guarda el reporte.
  enqueueOrder(input: DistributeReportInput, options: { confirm?: boolean } = {}): void {
    this.db.prepare('INSERT OR REPLACE INTO distribution_orders (reportId, data, createdAt) VALUES (?, ?, ?)')
      .run(input.reportId, JSON.stringify({ input, confirm: options.confirm === true }), toIso());
  }

  pendingOrderCount(): number {
    return Number(this.db.prepare('SELECT COUNT(*) AS total FROM distribution_orders').get()?.total ?? 0);
  }

  // Ejecuta de forma idempotente las órdenes de distribución pendientes.
  recoverPendingOrders(): number {
    const rows = this.db.prepare('SELECT reportId, data FROM distribution_orders ORDER BY rowid').all();
    let recovered = 0;
    for (const row of rows) {
      try {
        const order = JSON.parse(String(row.data)) as { input: DistributeReportInput; confirm: boolean };
        this.transaction(() => {
          this.distributeNewReport(order.input);
          if (order.confirm) this.confirmUrgentReport(order.input.reportId);
          this.db.prepare('DELETE FROM distribution_orders WHERE reportId = ?').run(String(row.reportId));
        });
        recovered += 1;
      } catch (error) {
        console.error(`No se pudo completar la distribución pendiente de ${String(row.reportId)}`, error);
      }
    }
    return recovered;
  }

  hasInboxEntry(agencyId: string, reportId: string): boolean {
    return this.db.prepare('SELECT 1 AS found FROM agency_inbox WHERE agencyId = ? AND reportId = ? LIMIT 1')
      .get(agencyId, reportId) !== undefined;
  }

  listDeliveriesForReport(reportId: string): DeliveryRecord[] {
    return this.db.prepare('SELECT data FROM deliveries WHERE reportId = ? ORDER BY rowid').all(reportId)
      .map((row) => JSON.parse(String(row.data)) as DeliveryRecord);
  }

  getSummary(reportId: string): ReportDistributionSummary | null {
    const summary = this.readSummary(reportId);
    return summary ? { ...summary, deliveries: this.listDeliveriesForReport(reportId) } : null;
  }

  inbox(agencyId: string, options: { reportId?: string; unacknowledgedOnly?: boolean } = {}): AgencyInboxEntry[] {
    const rows = this.db.prepare(`SELECT * FROM agency_inbox WHERE agencyId = ?
      AND (? IS NULL OR reportId = ?) AND (? = 0 OR acknowledgedAt IS NULL) ORDER BY receivedAt, rowid`)
      .all(agencyId, options.reportId ?? null, options.reportId ?? null, options.unacknowledgedOnly ? 1 : 0);
    return rows.map((row) => ({
      deliveryId: String(row.deliveryId),
      agencyId: String(row.agencyId) as AgencyId,
      reportId: String(row.reportId),
      role: String(row.role) as DeliveryRole,
      payload: JSON.parse(String(row.payload)) as DeliveryPayload,
      receivedAt: String(row.receivedAt),
      ...(row.acknowledgedAt != null ? { acknowledgedAt: String(row.acknowledgedAt) } : {}),
      ...(row.acknowledgedBy != null ? { acknowledgedBy: String(row.acknowledgedBy) } : {}),
    }));
  }

  acknowledge(deliveryId: string, agencyId: string, userId: string, now: string | Date = new Date()): AgencyInboxEntry | null {
    const changes = this.db.prepare(`UPDATE agency_inbox
      SET acknowledgedAt = COALESCE(acknowledgedAt, ?), acknowledgedBy = COALESCE(acknowledgedBy, ?)
      WHERE deliveryId = ? AND agencyId = ?`).run(toIso(now), userId, deliveryId, agencyId).changes;
    return changes ? (this.inbox(agencyId).find((entry) => entry.deliveryId === deliveryId) ?? null) : null;
  }

  static reset(): void { this.current().reset(); }
  static setSimulatedFailure(agencyId: AgencyId, errorMessage?: string): void { this.current().setSimulatedFailure(agencyId, errorMessage); }
  static clearSimulatedFailure(agencyId?: AgencyId): void { this.current().clearSimulatedFailure(agencyId); }
  static distributeNewReport(input: DistributeReportInput): ReportDistributionSummary { return this.current().distributeNewReport(input); }
  static recordVerificationSignal(input: Parameters<ReportDistribution['recordVerificationSignal']>[0]): ReportDistributionSummary | null {
    return this.current().recordVerificationSignal(input);
  }
  static confirmUrgentReport(reportId: string, nowIso?: string): ReportDistributionSummary | null {
    return this.current().confirmUrgentReport(reportId, nowIso);
  }
  static refuteUrgentReport(reportId: string, nowIso?: string): ReportDistributionSummary | null {
    return this.current().refuteUrgentReport(reportId, nowIso);
  }
  static checkManualReviewTimeout(reportId: string, now?: string | Date): ReportDistributionSummary | null {
    return this.current().checkManualReviewTimeout(reportId, now);
  }
  static processDueQueue(now?: string | Date): DeliveryRecord[] { return this.current().processDueQueue(now); }
  static retryDelivery(deliveryId: string, now?: string | Date): DeliveryRecord | null { return this.current().retryDelivery(deliveryId, now); }
  static retryPendingDeliveries(options?: { reportId?: string; now?: string | Date }): DeliveryRecord[] {
    return this.current().retryPendingDeliveries(options);
  }
  static listDeliveriesForReport(reportId: string): DeliveryRecord[] { return this.current().listDeliveriesForReport(reportId); }
  static getSummary(reportId: string): ReportDistributionSummary | null { return this.current().getSummary(reportId); }
  static inbox(agencyId: string, options?: { reportId?: string; unacknowledgedOnly?: boolean }): AgencyInboxEntry[] {
    return this.current().inbox(agencyId, options);
  }
  static acknowledge(deliveryId: string, agencyId: string, userId: string, now?: string | Date): AgencyInboxEntry | null {
    return this.current().acknowledge(deliveryId, agencyId, userId, now);
  }
}
