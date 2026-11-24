import { openDatabase, type Database } from '../database.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { User } from '../types/user.js';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function mapOrganizationRow(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    ...(row.description != null ? { description: String(row.description) } : {}),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

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
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        description TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (bucket TEXT NOT NULL, time INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS attempts_bucket_time ON attempts(bucket, time);
      CREATE TABLE IF NOT EXISTS account_audit (
        id TEXT PRIMARY KEY,
        targetUserId TEXT NOT NULL,
        actorUserId TEXT NOT NULL,
        field TEXT NOT NULL,
        previous TEXT,
        next TEXT,
        changedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS account_audit_by_target ON account_audit(targetUserId, changedAt);
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

  private revokeSessionsForUser(userId: string, now = Date.now()): number {
    const rows = this.db.prepare('SELECT sid, userJson FROM sessions WHERE revokedAt IS NULL').all();
    let revoked = 0;
    for (const row of rows) {
      const sessionUser = JSON.parse(String(row.userJson)) as User;
      if (sessionUser.id === userId) {
        this.db.prepare('UPDATE sessions SET revokedAt = COALESCE(revokedAt, ?) WHERE sid = ?')
          .run(now, row.sid);
        revoked += 1;
      }
    }
    return revoked;
  }

  private syncActiveSessionsForUser(updatedUser: User) {
    const rows = this.db.prepare('SELECT sid, userJson FROM sessions WHERE revokedAt IS NULL').all();
    for (const row of rows) {
      const sessionUser = JSON.parse(String(row.userJson)) as User;
      if (sessionUser.id === updatedUser.id) {
        this.db.prepare('UPDATE sessions SET userJson = ? WHERE sid = ?')
          .run(JSON.stringify(updatedUser), row.sid);
      }
    }
  }

  account(email: string) {
    const row = this.db.prepare('SELECT userJson, passwordHash FROM accounts WHERE email = ?').get(email);
    return row ? { user: JSON.parse(String(row.userJson)) as User, passwordHash: String(row.passwordHash) } : null;
  }

  accountById(id: string) {
    const row = this.db.prepare('SELECT userJson, passwordHash FROM accounts WHERE id = ?').get(id);
    return row ? { user: JSON.parse(String(row.userJson)) as User, passwordHash: String(row.passwordHash) } : null;
  }

  listAccounts(filter?: { organizationId?: string; role?: string }): User[] {
    const rows = this.db.prepare('SELECT userJson FROM accounts ORDER BY email ASC').all();
    const users: User[] = [];
    for (const row of rows) {
      const user = JSON.parse(String(row.userJson)) as User;
      if (filter?.organizationId !== undefined && user.organizationId !== filter.organizationId) continue;
      if (filter?.role !== undefined && user.role !== filter.role) continue;
      users.push(user);
    }
    return users;
  }

  addAccount(user: User, passwordHash: string): boolean {
    return this.db.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?)')
      .run(user.id, user.email, JSON.stringify(user), passwordHash).changes === 1;
  }

  updateAccount(
    id: string,
    changes: { displayName?: string; role?: User['role']; organizationId?: string | null; revokeSessions?: boolean },
    actorUserId?: string,
  ): User | null {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT userJson FROM accounts WHERE id = ?').get(id);
      if (!row) return null;

      const current = JSON.parse(String(row.userJson)) as User;
      const updatedUser: User = { ...current };
      if (changes.displayName !== undefined) updatedUser.displayName = changes.displayName;
      if (changes.role !== undefined) updatedUser.role = changes.role;
      if (changes.organizationId === null) delete updatedUser.organizationId;
      else if (changes.organizationId !== undefined) updatedUser.organizationId = changes.organizationId;

      this.db.prepare('UPDATE accounts SET userJson = ? WHERE id = ?')
        .run(JSON.stringify(updatedUser), id);

      if (actorUserId) {
        const changedAt = new Date().toISOString();
        const insert = this.db.prepare(
          'INSERT INTO account_audit VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        if (current.role !== updatedUser.role) {
          insert.run(randomUUID(), id, actorUserId, 'role', current.role, updatedUser.role, changedAt);
        }
        if ((current.organizationId ?? null) !== (updatedUser.organizationId ?? null)) {
          insert.run(
            randomUUID(),
            id,
            actorUserId,
            'organizationId',
            current.organizationId ?? null,
            updatedUser.organizationId ?? null,
            changedAt,
          );
        }
      }

      if (changes.revokeSessions === true) {
        this.revokeSessionsForUser(id);
      } else {
        this.syncActiveSessionsForUser(updatedUser);
      }
      return updatedUser;
    });
  }

  accountAudit(targetUserId: string) {
    return this.db.prepare(
      'SELECT id, targetUserId, actorUserId, field, previous, next, changedAt FROM account_audit WHERE targetUserId = ? ORDER BY rowid',
    ).all(targetUserId).map((row) => ({
      id: String(row.id),
      targetUserId: String(row.targetUserId),
      actorUserId: String(row.actorUserId),
      field: String(row.field) as 'role' | 'organizationId',
      previous: row.previous == null ? null : String(row.previous),
      next: row.next == null ? null : String(row.next),
      changedAt: String(row.changedAt),
    }));
  }

  revokeUserSessions(userId: string): number {
    return this.transaction(() => this.revokeSessionsForUser(userId));
  }

  deleteAccount(id: string): boolean {
    return this.transaction(() => {
      this.revokeSessionsForUser(id);
      return this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id).changes === 1;
    });
  }

  listOrganizations(): Organization[] {
    const rows = this.db.prepare('SELECT id, name, description, createdAt, updatedAt FROM organizations ORDER BY name ASC').all();
    return rows.map(mapOrganizationRow);
  }

  organizationById(id: string): Organization | null {
    const row = this.db.prepare('SELECT id, name, description, createdAt, updatedAt FROM organizations WHERE id = ?').get(id);
    return row ? mapOrganizationRow(row) : null;
  }

  createOrganization(input: { id?: string; name: string; description?: string }): Organization | 'conflict' {
    return this.transaction(() => {
      const id = input.id ?? randomUUID();
      const existing = this.db.prepare('SELECT id FROM organizations WHERE id = ? OR name = ? COLLATE NOCASE')
        .get(id, input.name);
      if (existing) return 'conflict' as const;

      const now = new Date().toISOString();
      this.db.prepare('INSERT INTO organizations (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
        .run(id, input.name, input.description ?? null, now, now);

      return {
        id,
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  updateOrganization(
    id: string,
    changes: { name?: string; description?: string },
  ): Organization | 'not_found' | 'conflict' {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT id, name, description, createdAt, updatedAt FROM organizations WHERE id = ?').get(id);
      if (!row) return 'not_found' as const;

      const existing = mapOrganizationRow(row);
      if (changes.name !== undefined) {
        const collision = this.db.prepare('SELECT id FROM organizations WHERE name = ? COLLATE NOCASE AND id != ?')
          .get(changes.name, id);
        if (collision) return 'conflict' as const;
      }

      const nextName = changes.name ?? existing.name;
      const nextDescription = changes.description !== undefined ? changes.description : existing.description;
      const updatedAt = new Date().toISOString();

      this.db.prepare('UPDATE organizations SET name = ?, description = ?, updatedAt = ? WHERE id = ?')
        .run(nextName, nextDescription ?? null, updatedAt, id);

      return {
        id,
        name: nextName,
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
        createdAt: existing.createdAt,
        updatedAt,
      };
    });
  }

  deleteOrganization(id: string): boolean {
    return this.transaction(() => {
      const deleted = this.db.prepare('DELETE FROM organizations WHERE id = ?').run(id).changes === 1;
      if (!deleted) return false;

      const accountRows = this.db.prepare('SELECT id, userJson FROM accounts').all();
      for (const row of accountRows) {
        const user = JSON.parse(String(row.userJson)) as User;
        if (user.organizationId === id) {
          delete user.organizationId;
          this.db.prepare('UPDATE accounts SET userJson = ? WHERE id = ?')
            .run(JSON.stringify(user), row.id);
        }
      }

      const sessionRows = this.db.prepare('SELECT sid, userJson FROM sessions WHERE revokedAt IS NULL').all();
      for (const row of sessionRows) {
        const user = JSON.parse(String(row.userJson)) as User;
        if (user.organizationId === id) {
          delete user.organizationId;
          this.db.prepare('UPDATE sessions SET userJson = ? WHERE sid = ?')
            .run(JSON.stringify(user), row.sid);
        }
      }

      return true;
    });
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
