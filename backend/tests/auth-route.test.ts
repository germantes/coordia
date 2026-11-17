import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportStore } from '../src/models/report.js';
import { AuthStore } from '../src/auth/store.js';
import { createServer } from '../src/index.js';
import { Role } from '../src/constants/roles.js';
import { hashPassword } from '../src/auth/password.js';

let store: AuthStore;
let reportStore: ReportStore;
let server: Server;
let base: string;
const credentials = { email: 'laura@example.test', password: '  exact long password  ' };
const user = { id: 'citizen', email: credentials.email, role: Role.Guest, organizationId: 'org' };

beforeEach(async () => {
  store = new AuthStore(':memory:');
  store.addAccount(user, await hashPassword(credentials.password));
  reportStore = new ReportStore(':memory:');
  server = createServer(store, reportStore).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  reportStore.close();
});

function post(path: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}
async function login() {
  const response = await post('login', credentials);
  expect(response.status).toBe(200);
  return { token: (await response.json() as { accessToken: string }).accessToken,
    cookie: response.headers.get('set-cookie')!.split(';')[0] };
}
const protectedCall = (token: string) => fetch(`${base}/api/reports/mi`, { headers: { Authorization: `Bearer ${token}` } });

describe('persistent authentication and CA-4', () => {
  it('revokes access and refresh immediately, supports repeated logout and preserves other sessions', async () => {
    const first = await login();
    const second = await login();
    expect((await protectedCall(first.token)).status).toBe(200);
    const headers = { Authorization: `Bearer ${first.token}` };
    expect((await post('logout', {}, headers)).status).toBe(204);
    expect((await protectedCall(first.token)).status).toBe(401);
    expect((await post('refresh', {}, { Cookie: first.cookie })).status).toBe(401);
    expect((await post('logout', {}, headers)).status).toBe(204);
    expect((await protectedCall(second.token)).status).toBe(200);
  });

  it('rotates refresh once and revokes access tokens issued before and after refresh', async () => {
    const first = await login();
    const refreshed = await post('refresh', {}, { Cookie: first.cookie });
    expect(refreshed.status).toBe(200);
    const nextToken = (await refreshed.json() as { accessToken: string }).accessToken;
    const nextCookie = refreshed.headers.get('set-cookie')!.split(';')[0];
    expect((await post('refresh', {}, { Cookie: first.cookie })).status).toBe(401);
    await post('logout', {}, { Authorization: `Bearer ${first.token}` });
    expect((await protectedCall(nextToken)).status).toBe(401);
    expect((await post('refresh', {}, { Cookie: nextCookie })).status).toBe(401);
  });

  it('keeps logout effective during a concurrent refresh', async () => {
    const first = await login();
    const [logout, refresh] = await Promise.all([
      post('logout', {}, { Authorization: `Bearer ${first.token}` }),
      post('refresh', {}, { Cookie: first.cookie }),
    ]);
    expect(logout.status).toBe(204);
    expect([200, 401]).toContain(refresh.status);
    if (refresh.status === 200) {
      expect((await protectedCall((await refresh.json() as { accessToken: string }).accessToken)).status).toBe(401);
    }
    expect((await protectedCall(first.token)).status).toBe(401);
  });

  it('validates registration, rejects duplicates and ignores authority fields', async () => {
    expect((await post('register', { ...credentials, password: ' '.repeat(12), confirmPassword: ' '.repeat(12), displayName: 'Laura' })).status).toBe(400);
    const body = { ...credentials, email: 'new@example.test', confirmPassword: credentials.password,
      displayName: 'Laura', role: 'admin', organizationId: 'forged' };
    expect((await post('register', body)).status).toBe(201);
    expect(store.account(body.email)?.user).toMatchObject({ role: Role.Guest });
    expect(store.account(body.email)?.user).not.toHaveProperty('organizationId');
    expect((await post('register', body)).status).toBe(409);
    expect((await post('login', { ...credentials, password: 'wrong password' })).status).toBe(401);
    const unknown = await post('login', { ...credentials, email: 'unknown@example.test' });
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual({ error: 'Credenciales inválidas' });
  });

  it('enforces attempt limits and returns Retry-After', async () => {
    for (let index = 0; index < 5; index++) expect((await post('login', {})).status).toBe(400);
    const blocked = await post('login', {});
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    for (let index = 0; index < 5; index++) expect((await post('register', {})).status).toBe(400);
    expect((await post('register', {})).status).toBe(429);
    for (let index = 0; index < 60; index++) expect((await post('refresh')).status).toBe(401);
    expect((await post('refresh')).status).toBe(429);
  });

  it('fails closed when the session store is unavailable', async () => {
    const first = await login();
    store.close();
    expect((await protectedCall(first.token)).status).toBe(503);
    expect((await post('logout', {}, { Authorization: `Bearer ${first.token}` })).status).toBe(503);
    // Replace the closed fixture for teardown.
    store = new AuthStore(':memory:');
  });

  it('limits refresh per session across successive token rotations', async () => {
    const session = await login();
    let cookie = session.cookie;
    for (let index = 0; index < 30; index++) {
      const response = await post('refresh', {}, { Cookie: cookie });
      expect(response.status).toBe(200);
      cookie = response.headers.get('set-cookie')!.split(';')[0];
    }
    expect((await post('refresh', {}, { Cookie: cookie })).status).toBe(429);
  });

  it('persists revocation across connections and restarts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coordia-auth-'));
    const path = join(directory, 'auth.sqlite');
    const first = new AuthStore(path);
    const second = new AuthStore(path);
    const session = first.createSession(user);
    expect(second.activeSession(session.sid)?.id).toBe(user.id);
    second.revoke(session.sid, user.id);
    expect(first.activeSession(session.sid)).toBeNull();
    first.close();
    second.close();
    const reopened = new AuthStore(path);
    expect(reopened.activeSession(session.sid)).toBeNull();
    reopened.close();
    rmSync(directory, { recursive: true });
  });
});
