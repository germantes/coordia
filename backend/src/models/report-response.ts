import type { ReportResponseValue } from '../validation/report-response.js';

export interface ReportResponseHistoryEntry {
  previous: ReportResponseValue | null;
  next: ReportResponseValue;
  changedAt: string;
}

export interface ReportResponseRecord {
  reportId: string;
  userId: string;
  response: ReportResponseValue;
  updatedAt: string;
  proximityVerifiedAt: string;
  history: ReportResponseHistoryEntry[];
}

export interface ReportResponseCounts {
  confirm: number;
  question: number;
}

/** Temporary in-memory response store. Replace with a persistent repository when the DB is available. */
export class ReportResponse {
  private static readonly records = new Map<string, ReportResponseRecord>();

  private static key(reportId: string | number, userId: string): string {
    return `${reportId}:${userId}`;
  }

  static async find(reportId: string | number, userId: string): Promise<ReportResponseRecord | null> {
    const record = this.records.get(this.key(reportId, userId));
    return record ? { ...record, history: record.history.map((entry) => ({ ...entry })) } : null;
  }

  static async counts(reportId: string | number): Promise<ReportResponseCounts> {
    const counts: ReportResponseCounts = { confirm: 0, question: 0 };
    for (const record of this.records.values()) {
      if (String(record.reportId) === String(reportId)) counts[record.response] += 1;
    }
    return counts;
  }

  static async upsert(
    reportId: string | number,
    userId: string,
    response: ReportResponseValue,
    proximityVerifiedAt: string,
  ): Promise<{ record: ReportResponseRecord; changed: boolean }> {
    const key = this.key(reportId, userId);
    const previous = this.records.get(key);
    if (previous?.response === response) {
      return {
        record: { ...previous, history: previous.history.map((entry) => ({ ...entry })) },
        changed: false,
      };
    }

    const changedAt = new Date().toISOString();
    const history = previous?.history.map((entry) => ({ ...entry })) ?? [];
    history.push({ previous: previous?.response ?? null, next: response, changedAt });
    const record: ReportResponseRecord = {
      reportId: String(reportId),
      userId,
      response,
      updatedAt: changedAt,
      proximityVerifiedAt,
      history,
    };
    this.records.set(key, record);
    return { record: { ...record, history: history.map((entry) => ({ ...entry })) }, changed: true };
  }
}
