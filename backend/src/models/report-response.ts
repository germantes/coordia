import { pool } from './pool.js';

export interface ReportResponseData {
  reportId: string;
  userId: string;
  response: string;
  updatedAt: string;
}

export class ReportResponse {
  static async upsert(reportId: string, userId: string, response: string, updatedAt: string): Promise<{ record: ReportResponseData, changed: boolean }> {
    const checkQuery = `SELECT response FROM report_responses WHERE report_id = $1 AND user_id = $2`;
    const { rows: existingRows } = await pool.query(checkQuery, [reportId, userId]);
    
    let changed = true;
    if (existingRows.length > 0 && existingRows[0].response === response) {
      changed = false;
    }

    const query = `
      INSERT INTO report_responses (report_id, user_id, response, updated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (report_id, user_id) 
      DO UPDATE SET response = EXCLUDED.response, updated_at = EXCLUDED.updated_at
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [reportId, userId, response, updatedAt]);
    
    const record = {
      reportId: rows[0].report_id,
      userId: rows[0].user_id,
      response: rows[0].response,
      updatedAt: new Date(rows[0].updated_at).toISOString()
    };

    return { record, changed };
  }

  static async find(reportId: string, userId: string): Promise<ReportResponseData | null> {
    const query = `SELECT * FROM report_responses WHERE report_id = $1 AND user_id = $2`;
    const { rows } = await pool.query(query, [reportId, userId]);
    
    if (rows.length === 0) return null;
    return {
      reportId: rows[0].report_id,
      userId: rows[0].user_id,
      response: rows[0].response,
      updatedAt: new Date(rows[0].updated_at).toISOString()
    };
  }

  static async counts(reportId: string): Promise<Record<string, number>> {
    const query = `
      SELECT response, COUNT(*) as count 
      FROM report_responses 
      WHERE report_id = $1 
      GROUP BY response
    `;
    const { rows } = await pool.query(query, [reportId]);
    
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.response] = parseInt(row.count, 10);
    }
    return result;
  }
}
