import { openDatabase, type Database } from '../database.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { User } from '../types/user.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthStore {
  private readonly db: Database;

  constructor(path: string) {
    this.db = openDatabase(path);
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, userJson TEXT NOT NULL, passwordHash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY, userJson TEXT NOT NULL, refreshHash TEXT NOT NULL UNIQUE,
        createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, revokedAt INTEGER
      );
      CREATE TABLE IF NOT EXISTS attempts (bucket TEXT NOT NULL, time INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS attempts_bucket_time ON attempts(bucket, time);
    `);
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  account(email: string) {
    const row = this.db.prepare('SELECT userJson, passwordHash FROM accounts WHERE email = ?').get(email);
    return row ? { user: JSON.parse(String(row.userJson)) as User, passwordHash: String(row.passwordHash) } : null;
  }

  addAccount(user: User, passwordHash: string): boolean {
    return this.db.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?)')
      .run(user.id, user.email, JSON.stringify(user), passwordHash).changes === 1;
  }

  createSession(user: User) {
    const sid = randomUUID();
    const refreshToken = randomBytes(32).toString('base64url');
    const now = Date.now();
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, NULL)')
      .run(sid, JSON.stringify(user), hash(refreshToken), now, now + SESSION_LIFETIME_MS);
    return { sid, user, refreshToken, expiresAt: now + SESSION_LIFETIME_MS };
  }

  activeSession(sid: string) {
    const row = this.db.prepare('SELECT * FROM sessions WHERE sid = ? AND revokedAt IS NULL AND expiresAt > ?')
      .get(sid, Date.now());
    return row ? JSON.parse(String(row.userJson)) as User : null;
  }

  rotate(refreshToken: string, maximum = 30) {
    return this.transaction(() => {
      const now = Date.now();
      const row = this.db.prepare('SELECT * FROM sessions WHERE refreshHash = ? AND revokedAt IS NULL AND expiresAt > ?')
        .get(hash(refreshToken), now);
      if (!row) return null;
      const bucket = `refresh:session:${row.sid}`;
      this.db.prepare('DELETE FROM attempts WHERE time <= ?').run(now - 900000);
      const attempts = this.db.prepare('SELECT COUNT(*) AS count FROM attempts WHERE bucket = ?').get(bucket)!;
      if (Number(attempts.count) >= maximum) return 'limited' as const;
      this.db.prepare('INSERT INTO attempts VALUES (?, ?)').run(bucket, now);
      const next = randomBytes(32).toString('base64url');
      this.db.prepare('UPDATE sessions SET refreshHash = ? WHERE sid = ?').run(hash(next), row.sid);
      return { sid: String(row.sid), user: JSON.parse(String(row.userJson)) as User,
        refreshToken: next, expiresAt: Number(row.expiresAt) };
    });
  }

  revoke(sid: string, userId: string) {
    this.transaction(() => {
      const row = this.db.prepare('SELECT userJson FROM sessions WHERE sid = ?').get(sid);
      if (row && (JSON.parse(String(row.userJson)) as User).id === userId) {
        this.db.prepare('UPDATE sessions SET revokedAt = COALESCE(revokedAt, ?) WHERE sid = ?').run(Date.now(), sid);
      }
    });
  }

  limit(buckets: { key: string; maximum: number }[]): number {
    return this.transaction(() => {
      const now = Date.now();
      const windowMs = 15 * 60 * 1000;
      this.db.prepare('DELETE FROM attempts WHERE time <= ?').run(now - windowMs);
      let retryAfter = 0;
      for (const bucket of buckets) {
        const row = this.db.prepare('SELECT COUNT(*) AS count, MIN(time) AS oldest FROM attempts WHERE bucket = ?').get(bucket.key)!;
        if (Number(row.count) >= bucket.maximum) {
          retryAfter = Math.max(retryAfter, Math.ceil((Number(row.oldest) + windowMs - now) / 1000));
        }
      }
      if (!retryAfter) {
        for (const bucket of buckets) this.db.prepare('INSERT INTO attempts VALUES (?, ?)').run(bucket.key, now);
      }
      return retryAfter;
    });
  }

  close() { this.db.close(); }
}
