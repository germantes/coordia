import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../database.js';
import type { ReportCategory } from '../validation/report.js';
import type { ReportResponseValue } from '../validation/report-response.js';
import { defaultRule, evaluateConfidence, type ConfidenceRule, type Contribution } from './confidence.js';
import { ReportDistribution } from './report-distribution.js';

export interface ReportData {
  id?: string | number;
  ownerId?: string;
  organizationId?: string;
  projectId?: string;
  environment?: 'development' | 'production';
  status?: string;
  category?: ReportCategory;
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    source?: 'gps' | 'manual';
  };
  urgent?: boolean;
  occurredAt?: string;
  createdAt?: string;
}

type Evaluation = ReturnType<typeof evaluateConfidence>;
type Verification = Evaluation & { changedAt: string; threshold: number };
export type StoredReport = ReportData & { id: string; verification: Verification };
type Evidence = Contribution & { userId: string };

export class ReportStore {
  private readonly db: Database;
  readonly distribution: ReportDistribution;

  constructor(path: string) {
    this.db = openDatabase(path);
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY, data TEXT NOT NULL, creatorRep REAL NOT NULL, proximity REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS confidence_rules (category TEXT PRIMARY KEY, rule TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS responses (
        reportId TEXT REFERENCES reports(id) ON DELETE CASCADE, userId TEXT NOT NULL,
        response TEXT NOT NULL, updatedAt TEXT NOT NULL, reputation REAL NOT NULL,
        PRIMARY KEY(reportId,userId)
      );
      CREATE TABLE IF NOT EXISTS response_history (
        reportId TEXT REFERENCES reports(id) ON DELETE CASCADE, userId TEXT NOT NULL,
        previous TEXT, next TEXT NOT NULL, changedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS verification_events (
        reportId TEXT REFERENCES reports(id) ON DELETE CASCADE, event TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS verification_by_report ON verification_events(reportId);
    `);
    this.distribution = new ReportDistribution(this.db);
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  rule(category: ReportCategory): ConfidenceRule {
    const row = this.db.prepare('SELECT rule FROM confidence_rules WHERE category = ?').get(category);
    return row ? JSON.parse(String(row.rule)) : { ...defaultRule };
  }

  setRule(category: ReportCategory, rule: ConfidenceRule) {
    const newlyVerified: string[] = [];
    this.transaction(() => {
      this.db.prepare('INSERT OR REPLACE INTO confidence_rules VALUES (?,?)').run(category, JSON.stringify(rule));
      for (const report of this.findAll({ category })) {
        const evaluated = this.evaluate(report, 'rule');
        if (evaluated.verification.state === 'verified') {
          newlyVerified.push(evaluated.id);
        }
      }
    });
    // La distribución comparte esta conexión SQLite: se inicia después del
    // commit para no intentar abrir una transacción dentro de otra.
    for (const id of newlyVerified) {
      this.distribution.confirmUrgentReport(id);
    }
  }

  private reputation(ownerId: string | undefined) {
    if (!ownerId) return 0.20;
    const row = this.db.prepare(`SELECT COUNT(*) AS decided,
      SUM(json_extract(data,'$.status') IN ('validated','approved')) AS accepted
      FROM reports WHERE json_extract(data,'$.ownerId') = ?
      AND COALESCE(json_extract(data,'$.environment'),'production') = 'production'
      AND json_extract(data,'$.status') IN ('validated','approved','rejected')`).get(ownerId);
    return row && Number(row.decided) > 0 ? Number(row.accepted) / Number(row.decided) : 0.20;
  }

  create(data: ReportData, proximity = 0) {
    const evaluated = this.transaction(() => {
      const report = { ...data, id: randomUUID() };
      this.db.prepare('INSERT INTO reports VALUES (?,?,?,?)')
        .run(report.id, JSON.stringify(report), this.reputation(report.ownerId), proximity);
      return this.evaluate(report, 'created');
    });

    if (evaluated.category && evaluated.location) {
      this.distribution.distributeNewReport({
        reportId: evaluated.id,
        category: evaluated.category,
        description: evaluated.description,
        location: evaluated.location,
        occurredAt: evaluated.occurredAt,
        createdAt: evaluated.createdAt,
        status: evaluated.status,
        urgent: evaluated.urgent,
      });
      if (evaluated.verification.state === 'verified' || evaluated.status === 'validated' || evaluated.status === 'approved') {
        this.distribution.confirmUrgentReport(evaluated.id);
      }
    }

    return evaluated;
  }

  findByPk(id: string): StoredReport | null {
    const row = this.db.prepare('SELECT data FROM reports WHERE id = ?').get(id);
    return row ? JSON.parse(String(row.data)) : null;
  }

  findAll(where: Partial<ReportData> = {}): StoredReport[] {
    const records: StoredReport[] = this.db.prepare('SELECT data FROM reports').all()
      .map(row => JSON.parse(String(row.data)));
    return records.filter(record => Object.entries(where).every(([key, value]) => Reflect.get(record, key) === value));
  }

  update(expected: StoredReport, data: ReportData) {
    const id = expected.id;
    const updated = this.transaction(() => {
      const current = this.findByPk(id);
      if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return null;
      const moved = data.location && (data.location.latitude !== current.location?.latitude
        || data.location.longitude !== current.location?.longitude);
      const transferred = (data.ownerId !== undefined && data.ownerId !== current.ownerId)
        || (data.organizationId !== undefined && data.organizationId !== current.organizationId);
      if (moved || transferred) {
        this.db.prepare('DELETE FROM responses WHERE reportId = ?').run(id);
        this.db.prepare('UPDATE reports SET proximity = 0, creatorRep = ? WHERE id = ?')
          .run(this.reputation(data.ownerId ?? current.ownerId), id);
      }
      return this.evaluate({ ...current, ...data, id }, 'updated');
    });

    if (updated) {
      if (data.status === 'validated' || data.status === 'approved') {
        this.distribution.confirmUrgentReport(id);
      } else if (data.status === 'rejected') {
        this.distribution.refuteUrgentReport(id);
      }
    }

    return updated;
  }

  destroy(id: string) {
    return this.db.prepare('DELETE FROM reports WHERE id = ?').run(id).changes;
  }

  private evidence(id: string): Evidence[] {
    return this.db.prepare('SELECT userId,response,reputation,updatedAt FROM responses WHERE reportId = ?')
      .all(id).map(row => ({
        userId: String(row.userId), response: row.response === 'confirm' ? 'confirm' : 'question',
        reputation: Number(row.reputation), updatedAt: String(row.updatedAt),
      }));
  }

  responses(id: string, userId: string) {
    const entries = this.evidence(id);
    const confirm = entries.filter(entry => entry.response === 'confirm').length;
    return { counts: { confirm, question: entries.length - confirm }, entry: entries.find(row => row.userId === userId) };
  }

  respond(expected: StoredReport, userId: string, response: ReportResponseValue) {
    const id = expected.id;
    const outcome = this.transaction(() => {
      const report = this.findByPk(id);
      if (!report || report.status !== 'pending' || report.ownerId !== expected.ownerId
        || report.organizationId !== expected.organizationId || report.location?.latitude !== expected.location?.latitude
        || report.location?.longitude !== expected.location?.longitude) return null;
      const previous = this.responses(id, userId);
      if (previous.entry?.response === response) {
        return { changed: false, updatedAt: previous.entry.updatedAt, counts: previous.counts, verification: report.verification };
      }
      const updatedAt = new Date().toISOString();
      this.db.prepare('INSERT OR REPLACE INTO responses VALUES (?,?,?,?,?)')
        .run(id, userId, response, updatedAt, this.reputation(userId));
      this.db.prepare('INSERT INTO response_history VALUES (?,?,?,?,?)')
        .run(id, userId, previous.entry?.response ?? null, response, updatedAt);
      const { verification } = this.evaluate(report, 'response');
      return { changed: true, updatedAt, counts: this.responses(id, userId).counts, verification };
    });

    if (outcome?.changed) {
      this.distribution.recordVerificationSignal({
        reportId: id,
        citizenConfirmations: outcome.counts.confirm,
        citizenRejections: outcome.counts.question,
      });
      if (outcome.verification.state === 'verified') {
        this.distribution.confirmUrgentReport(id);
      }
    }

    return outcome;
  }

  private evaluate(report: ReportData & { id: string; verification?: Verification }, reason: string): StoredReport {
    const snapshot = this.db.prepare('SELECT creatorRep,proximity FROM reports WHERE id = ?').get(report.id)!;
    const rule = report.category ? this.rule(report.category) : defaultRule;
    const result = evaluateConfidence(rule, Number(snapshot.creatorRep), Number(snapshot.proximity), this.evidence(report.id));
    const previous = report.verification;
    const transition = !previous || previous.state !== result.state;
    const changedAt = transition ? new Date().toISOString() : previous.changedAt;
    const verification = { ...result, threshold: rule.threshold, changedAt };
    if (transition) {
      const event = { ...verification, previous: previous?.state ?? null, reason, rule };
      this.db.prepare('INSERT INTO verification_events VALUES (?,?)').run(report.id, JSON.stringify(event));
    }
    const updated = { ...report, verification };
    this.db.prepare('UPDATE reports SET data = ? WHERE id = ?').run(JSON.stringify(updated), report.id);
    return updated;
  }

  history(id: string) {
    return this.db.prepare('SELECT event FROM verification_events WHERE reportId = ? ORDER BY rowid').all(id)
      .map(row => JSON.parse(String(row.event)));
  }

  close() {
    this.distribution.close();
    this.db.close();
  }
}
