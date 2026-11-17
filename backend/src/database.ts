import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

interface Statement {
  run(...args: unknown[]): { changes: number };
  all(...args: unknown[]): Record<string, unknown>[];
  get(...args: unknown[]): Record<string, unknown> | undefined;
}
export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (path: string) => Database;
};

export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);

  // INICIALIZAR ESQUEMA PARA HU-02 y HU-04
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        ownerId TEXT NOT NULL,
        organizationId TEXT,
        projectId TEXT,
        environment TEXT DEFAULT 'production',
        status TEXT DEFAULT 'pending',
        category TEXT,
        description TEXT,
        latitude REAL,
        longitude REAL,
        occurredAt TEXT,
        createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS report_responses (
        reportId TEXT,
        userId TEXT,
        response TEXT NOT NULL,
        updatedAt TEXT,
        PRIMARY KEY (reportId, userId),
        FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE
    );
  `);

  return db;
}

// Exportamos un singleton para que los modelos puedan consumirlo directamente
export const db = openDatabase(process.env.DB_PATH ?? '.data/coordia.sqlite');
