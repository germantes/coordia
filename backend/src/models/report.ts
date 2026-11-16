// In-memory placeholder model. Replace with the persistent repository when the DB schema is available.
import { randomUUID } from 'node:crypto';
import type { ReportCategory } from '../validation/report.js';
import { pool } from './pool.js';

export interface ReportData {
  id?: string | number;
  ownerId?: string;
  organizationId?: string;
  projectId?: string;
  environment?: 'development' | 'production';
  status?: string;
  category?: ReportCategory;
  description?: string;
  location?: { latitude: number; longitude: number };
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
  location?: { latitude: number; longitude: number };
  occurredAt?: string;
  createdAt?: string;

  private static mapRowToData(row: any): ReportData {
    return {
      id: row.id,
      ownerId: row.owner_id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      environment: row.environment,
      status: row.status,
      category: row.category,
      description: row.description,
      location: row.latitude !== null && row.longitude !== null
        ? { latitude: parseFloat(row.latitude), longitude: parseFloat(row.longitude) }
        : undefined,
      occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    };
  }

  static async create(data: ReportData): Promise<ReportData> {
    const reportId = data.id || randomUUID();
    const query = `
      INSERT INTO reports (
        id, owner_id, organization_id, project_id, environment, status, category, description, location, occurred_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        ${data.location ? `ST_SetSRID(ST_MakePoint($9, $10), 4326)` : 'NULL'},
        $11, $12
      ) RETURNING *, ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude;
    `;
    const values = [
      reportId,
      data.ownerId,
      data.organizationId,
      data.projectId,
      data.environment,
      data.status,
      data.category,
      data.description,
      data.location?.longitude,
      data.location?.latitude,
      data.occurredAt,
      data.createdAt || new Date().toISOString()
    ];
    
    const { rows } = await pool.query(query, values);
    return this.mapRowToData(rows[0]);
  }

  static async findAll(options: Record<string, unknown> = {}): Promise<ReportData[]> {
    const where = (options.where ?? {}) as Record<string, unknown>;
    const keys = Object.keys(where);
    
    let query = `SELECT *, ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude FROM reports`;
    const values: any[] = [];
    
    if (keys.length > 0) {
      const conditions = keys.map((key, index) => {
        values.push(where[key]);
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        return `${dbKey} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const { rows } = await pool.query(query, values);
    return rows.map(this.mapRowToData);
  }

  static async findByPk(id: string): Promise<Report | null> {
    const query = `SELECT *, ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude FROM reports WHERE id = $1`;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) return null;
    
    const data = this.mapRowToData(rows[0]);
    return Object.assign(new Report(), data);
  }

  static async destroy(options: Record<string, unknown>): Promise<number> {
    const where = (options.where ?? {}) as Record<string, unknown>;
    const keys = Object.keys(where);
    
    let query = `DELETE FROM reports`;
    const values: any[] = [];
    
    if (keys.length > 0) {
      const conditions = keys.map((key, index) => {
        values.push(where[key]);
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        return `${dbKey} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const { rowCount } = await pool.query(query, values);
    return rowCount ?? 0;
  }

  async update(data: ReportData): Promise<ReportData> {
    Object.assign(this, data);
    if (!this.id) return { ...this };

    const updates: string[] = [];
    const values: any[] = [this.id];
    let counter = 2;

    const mapField = (objKey: string, dbKey: string) => {
      if ((this as Record<string, any>)[objKey] !== undefined) {
        updates.push(`${dbKey} = $${counter}`);
        values.push((this as Record<string, any>)[objKey]);
        counter++;
      }
    };

    mapField('status', 'status');
    mapField('description', 'description');
    mapField('organizationId', 'organization_id');
    mapField('ownerId', 'owner_id');
    mapField('environment', 'environment');
    mapField('projectId', 'project_id');
    mapField('category', 'category');
    mapField('occurredAt', 'occurred_at');
    
    if (updates.length === 0) return { ...this };

    const query = `UPDATE reports SET ${updates.join(', ')} WHERE id = $1 RETURNING *, ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude`;
    const { rows } = await pool.query(query, values);
    const updatedData = Report.mapRowToData(rows[0]);
    Object.assign(this, updatedData);
    
    return { ...this };
  }
}
