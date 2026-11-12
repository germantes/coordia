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
  return new DatabaseSync(path);
}
