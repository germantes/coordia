import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/constants/roles.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { ReportStore } from '../src/models/report.js';
import type { User } from '../src/types/user.js';

let store: AuthStore;
let reports: ReportStore;
let server: Server;
let baseUrl: string;
let cachedPasswordHash: string;
const samplePassword = 'clave segura administrativa';

beforeEach(async () => {
  cachedPasswordHash ??= await hashPassword(samplePassword);
  store = new AuthStore(':memory:');
  reports = new ReportStore(':memory:');
  server = createServer(store, reports).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  reports.close();
});

function createAccountWithSession(overrides: Partial<User> & { email: string; role: Role }) {
  const user: User = {
    id: crypto.randomUUID(),
    displayName: overrides.displayName ?? 'Usuario Prueba',
    ...overrides,
  };
  expect(store.addAccount(user, cachedPasswordHash)).toBe(true);
  const session = store.createSession(user);
  const token = issueAccessToken(session.sid, user);
  return { user, session, token };
}

function requestJson(path: string, method: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('HU-11 T3: privilege escalation, organization scope and revocation', () => {
  it('CA-1 lets an admin create users and organizations and assign defined roles', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    const organization = await requestJson('/api/organizations', 'POST', admin.token, {
      id: 'policia-local-malaga',
      name: 'Policía Local de Málaga',
    });
    expect(organization.status).toBe(201);

    const created = await requestJson('/api/users', 'POST', admin.token, {
      displayName: 'Técnica CECOP',
      email: 'tecnica@coordia.test',
      password: samplePassword,
      role: Role.QA,
      organizationId: 'policia-local-malaga',
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      role: Role.QA,
      organizationId: 'policia-local-malaga',
    });
  });

  it('CA-2 rejects privilege escalation and cross-organization reads on the API', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    store.createOrganization({ id: 'org-malaga', name: 'Málaga' });
    store.createOrganization({ id: 'org-sevilla', name: 'Sevilla' });

    const qaMalaga = createAccountWithSession({
      email: 'qa.malaga@coordia.test',
      role: Role.QA,
      organizationId: 'org-malaga',
    });
    const poSevilla = createAccountWithSession({
      email: 'po.sevilla@coordia.test',
      role: Role.PO,
      organizationId: 'org-sevilla',
    });

    expect((await requestJson('/api/users', 'POST', qaMalaga.token, {
      displayName: 'Escalada',
      email: 'escalada@coordia.test',
      password: samplePassword,
      role: Role.Admin,
    })).status).toBe(403);
    expect((await requestJson(`/api/users/${qaMalaga.user.id}`, 'PATCH', qaMalaga.token, {
      role: Role.Admin,
    })).status).toBe(403);
    expect((await requestJson('/api/organizations/org-sevilla', 'GET', qaMalaga.token)).status).toBe(403);
    expect((await requestJson('/api/organizations/org-malaga', 'GET', poSevilla.token)).status).toBe(403);

    const malagaReport = reports.create({
      ownerId: 'author-malaga',
      organizationId: 'org-malaga',
      status: 'pending',
      category: 'safety',
      description: 'Incidente en Málaga.',
      location: { latitude: 36.7213, longitude: -4.4214 },
    });
    expect((await requestJson(`/api/reports/${malagaReport.id}`, 'PATCH', poSevilla.token, {
      status: 'validated',
    })).status).toBe(403);
    expect((await requestJson('/api/users', 'GET', admin.token)).status).toBe(200);
  });

  it('CA-3 applies a role or scope change on the next authorization check of the same token', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    store.createOrganization({ id: 'org-1', name: 'Organismo 1' });
    store.createOrganization({ id: 'org-2', name: 'Organismo 2' });
    const qa = createAccountWithSession({
      email: 'qa@org1.test',
      role: Role.QA,
      organizationId: 'org-1',
    });

    expect((await requestJson('/api/organizations/org-1', 'GET', qa.token)).status).toBe(200);
    expect((await requestJson(`/api/users/${qa.user.id}`, 'PATCH', admin.token, {
      organizationId: 'org-2',
    })).status).toBe(200);
    expect((await requestJson('/api/organizations/org-1', 'GET', qa.token)).status).toBe(403);
    expect((await requestJson('/api/organizations/org-2', 'GET', qa.token)).status).toBe(200);

    expect((await requestJson(`/api/users/${qa.user.id}`, 'PATCH', admin.token, {
      role: Role.Guest,
    })).status).toBe(200);
    expect((await requestJson('/api/organizations', 'POST', qa.token, { name: 'Nueva' })).status).toBe(403);
  });

  it('CA-4 records who changed a role or organization and when', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    store.createOrganization({ id: 'org-1', name: 'Organismo 1' });
    store.createOrganization({ id: 'org-2', name: 'Organismo 2' });
    const member = createAccountWithSession({
      email: 'miembro@org1.test',
      role: Role.Guest,
      organizationId: 'org-1',
    });

    const before = Date.now();
    expect((await requestJson(`/api/users/${member.user.id}`, 'PATCH', admin.token, {
      role: Role.QA,
      organizationId: 'org-2',
    })).status).toBe(200);

    const auditResponse = await requestJson(`/api/users/${member.user.id}/audit`, 'GET', admin.token);
    expect(auditResponse.status).toBe(200);
    const events = await auditResponse.json() as Array<{
      actorUserId: string;
      field: string;
      previous: string | null;
      next: string | null;
      changedAt: string;
    }>;
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: admin.user.id,
        field: 'role',
        previous: Role.Guest,
        next: Role.QA,
      }),
      expect.objectContaining({
        actorUserId: admin.user.id,
        field: 'organizationId',
        previous: 'org-1',
        next: 'org-2',
      }),
    ]));
    for (const event of events) {
      expect(Date.parse(event.changedAt)).toBeGreaterThanOrEqual(before);
    }

    expect((await requestJson(`/api/users/${member.user.id}/audit`, 'GET', member.token)).status).toBe(403);
  });

  it('revokes access and refresh tokens when an admin withdraws the account', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    const member = createAccountWithSession({
      email: 'ciudadano@org1.test',
      role: Role.Guest,
      organizationId: 'org-1',
    });
    const login = await requestJson('/api/auth/login', 'POST', undefined, {
      email: 'ciudadano@org1.test',
      password: samplePassword,
    });
    expect(login.status).toBe(200);
    const accessToken = (await login.json() as { accessToken: string }).accessToken;
    const refreshCookie = login.headers.get('set-cookie')!.split(';')[0];

    expect((await requestJson(`/api/users/${member.user.id}/revoke`, 'POST', admin.token)).status).toBe(204);
    expect((await requestJson('/api/reports/mi', 'GET', accessToken)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: refreshCookie },
    })).status).toBe(401);
  });
});
