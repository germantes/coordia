// In-memory placeholder model. Replace with the persistent repository when the DB schema is available.
import { randomUUID } from 'node:crypto';
import type { ReportCategory } from '../validation/report.js';

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

export class Report {
  id?: string | number;
  organizationId?: string;
  projectId?: string;
  environment?: 'development' | 'production';
  status?: string;
  ownerId?: string;
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
  private static readonly records = new Map<string, ReportData>();

  static async create(data: ReportData): Promise<ReportData> {
    const report = { ...data, id: randomUUID() };
    this.records.set(String(report.id), report);
    return { ...report };
  }

  static async findAll(options: Record<string, unknown> = {}): Promise<ReportData[]> {
    const where = (options.where ?? {}) as Record<string, unknown>;
    return [...this.records.values()]
      .filter((report) => Object.entries(where).every(([key, value]) =>
        (report as Record<string, unknown>)[key] === value))
      .map((report) => ({ ...report }));
  }

  static async findByPk(id: string): Promise<Report | null> {
    const report = this.records.get(String(id));
    if (!report) return null;
    return Object.assign(new Report(), report);
  }

  static async destroy(options: Record<string, unknown>): Promise<number> {
    const where = (options.where ?? {}) as Record<string, unknown>;
    const matches = [...this.records.entries()].filter(([, report]) =>
      Object.entries(where).every(([key, value]) => (report as Record<string, unknown>)[key] === value));
    for (const [id] of matches) this.records.delete(id);
    return matches.length;
  }

  async update(data: ReportData): Promise<ReportData> {
    Object.assign(this, data);
    if (this.id !== undefined) Report.records.set(String(this.id), { ...this });
    return { ...this };
  }

}
