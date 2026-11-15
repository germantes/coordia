import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/constants/roles.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { Report } from '../src/models/report.js';
import type { User } from '../src/types/user.js';

let store: AuthStore;
let server: Server;
let baseUrl: string;
let cachedPasswordHash: string;

const samplePassword = 'clave segura administrativa';

beforeEach(async () => {
  cachedPasswordHash ??= await hashPassword(samplePassword);
  store = new AuthStore(':memory:');
  server = createServer(store).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
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

describe('HU-11 T2: organization management and scope isolation', () => {
  it('validates administrative management with Policía Local, Bomberos and 112 Andalucía', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    const organizations = [
      { id: 'policia-local-malaga', name: 'Policía Local de Málaga', description: 'Tráfico y seguridad ciudadana' },
      { id: 'bomberos-malaga', name: 'Real Cuerpo de Bomberos de Málaga', description: 'Incendios y rescates' },
      { id: '112-andalucia', name: '112 Andalucía', description: 'Coordinación de emergencias' },
    ];

    for (const organization of organizations) {
      const response = await requestJson('/api/organizations', 'POST', admin.token, organization);
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject(organization);
    }

    const policeOperator = await requestJson('/api/users', 'POST', admin.token, {
      displayName: 'Operadora Policía Local',
      email: 'operadora.policia@coordia.test',
      password: samplePassword,
      role: Role.QA,
      organizationId: 'policia-local-malaga',
    });
    expect(policeOperator.status).toBe(201);
    const policeUser = await policeOperator.json() as User;
    const policeSession = store.createSession(policeUser);
    const policeToken = issueAccessToken(policeSession.sid, policeUser);

    expect((await requestJson('/api/organizations/policia-local-malaga', 'GET', policeToken)).status).toBe(200);
    expect((await requestJson('/api/organizations/bomberos-malaga', 'GET', policeToken)).status).toBe(403);
    expect((await requestJson('/api/organizations/112-andalucia', 'GET', policeToken)).status).toBe(403);

    const reassigned = await requestJson(`/api/users/${policeUser.id}`, 'PATCH', admin.token, {
      organizationId: 'bomberos-malaga',
    });
    expect(reassigned.status).toBe(200);
    expect((await requestJson('/api/organizations/policia-local-malaga', 'GET', policeToken)).status).toBe(403);
    expect((await requestJson('/api/organizations/bomberos-malaga', 'GET', policeToken)).status).toBe(200);

    const listed = await requestJson('/api/organizations', 'GET', admin.token);
    expect(listed.status).toBe(200);
    const ids = (await listed.json() as Array<{ id: string }>).map(({ id }) => id);
    expect(ids).toEqual(expect.arrayContaining(organizations.map(({ id }) => id)));
  });

  it('allows admin to create, list, inspect, update and delete organizations and unassigns linked users', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });

    const created = await requestJson('/api/organizations', 'POST', admin.token, {
      id: 'org-malaga',
      name: 'Ayuntamiento de Málaga',
      description: 'Coordinación municipal',
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { id: string; name: string; description: string };
    expect(createdBody).toMatchObject({
      id: 'org-malaga',
      name: 'Ayuntamiento de Málaga',
      description: 'Coordinación municipal',
    });

    const duplicateName = await requestJson('/api/organizations', 'POST', admin.token, {
      id: 'org-malaga-2',
      name: 'ayuntamiento de málaga',
    });
    expect(duplicateName.status).toBe(409);

    const duplicateId = await requestJson('/api/organizations', 'POST', admin.token, {
      id: 'org-malaga',
      name: 'Otro nombre',
    });
    expect(duplicateId.status).toBe(409);

    const listed = await requestJson('/api/organizations', 'GET', admin.token);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([expect.objectContaining({ id: 'org-malaga' })]);

    const fetched = await requestJson('/api/organizations/org-malaga', 'GET', admin.token);
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toMatchObject({ id: 'org-malaga', name: 'Ayuntamiento de Málaga' });

    const updated = await requestJson('/api/organizations/org-malaga', 'PATCH', admin.token, {
      name: 'CECOP Málaga',
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: 'org-malaga', name: 'CECOP Málaga' });

    const member = createAccountWithSession({
      email: 'tecnico@malaga.test',
      role: Role.QA,
      organizationId: 'org-malaga',
    });
    expect((await requestJson('/api/organizations/org-malaga', 'GET', member.token)).status).toBe(200);

    const deleted = await requestJson('/api/organizations/org-malaga', 'DELETE', admin.token);
    expect(deleted.status).toBe(204);
    expect(store.accountById(member.user.id)?.user.organizationId).toBeUndefined();
    expect((await requestJson('/api/organizations/org-malaga', 'GET', admin.token)).status).toBe(404);
    expect((await requestJson('/api/organizations', 'GET', member.token)).status).toBe(403);
  });

  it('isolates /api/organizations read access to the caller assigned organization and denies writes to non-admins', async () => {
    store.createOrganization({ id: 'org-malaga', name: 'Málaga' });
    store.createOrganization({ id: 'org-sevilla', name: 'Sevilla' });

    const citizen = createAccountWithSession({
      email: 'ciudadano@malaga.test',
      role: Role.Guest,
      organizationId: 'org-malaga',
    });
    const qaMember = createAccountWithSession({
      email: 'qa@malaga.test',
      role: Role.QA,
      organizationId: 'org-malaga',
    });
    const unassignedGuest = createAccountWithSession({
      email: 'sin-org@coordia.test',
      role: Role.Guest,
    });

    for (const caller of [citizen, qaMember]) {
      const list = await requestJson('/api/organizations', 'GET', caller.token);
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual([expect.objectContaining({ id: 'org-malaga', name: 'Málaga' })]);

      const own = await requestJson('/api/organizations/org-malaga', 'GET', caller.token);
      expect(own.status).toBe(200);

      const other = await requestJson('/api/organizations/org-sevilla', 'GET', caller.token);
      expect(other.status).toBe(403);

      expect((await requestJson('/api/organizations', 'POST', caller.token, { name: 'Nueva' })).status).toBe(403);
      expect((await requestJson('/api/organizations/org-malaga', 'PATCH', caller.token, { name: 'Hack' })).status).toBe(403);
      expect((await requestJson('/api/organizations/org-malaga', 'DELETE', caller.token)).status).toBe(403);
    }

    expect((await requestJson('/api/organizations', 'GET', unassignedGuest.token)).status).toBe(403);
    expect((await requestJson('/api/organizations/org-malaga', 'GET', unassignedGuest.token)).status).toBe(403);
    expect((await requestJson('/api/organizations', 'GET')).status).toBe(403);
  });
});

describe('HU-11 T2: user management, role enforcement and privilege escalation prevention', () => {
  it('allows admin to create, list, filter and update user roles and organizations without exposing password hashes', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    store.createOrganization({ id: 'org-malaga', name: 'Málaga' });

    const created = await requestJson('/api/users', 'POST', admin.token, {
      displayName: 'Carmen López',
      email: '  CARMEN@malaga.test ',
      password: samplePassword,
      role: Role.QA,
      organizationId: 'org-malaga',
    });
    expect(created.status).toBe(201);
    const createdUser = await created.json() as Record<string, unknown>;
    expect(createdUser).toMatchObject({
      displayName: 'Carmen López',
      email: 'carmen@malaga.test',
      role: Role.QA,
      organizationId: 'org-malaga',
    });
    expect(createdUser).not.toHaveProperty('passwordHash');

    const duplicate = await requestJson('/api/users', 'POST', admin.token, {
      displayName: 'Carmen Duplicada',
      email: 'carmen@malaga.test',
      password: samplePassword,
      role: Role.Guest,
    });
    expect(duplicate.status).toBe(409);

    const citizen = createAccountWithSession({
      email: 'vecino@coordia.test',
      role: Role.Guest,
    });

    const filteredQa = await requestJson('/api/users?organizationId=org-malaga&role=qa', 'GET', admin.token);
    expect(filteredQa.status).toBe(200);
    const filteredList = await filteredQa.json() as Record<string, unknown>[];
    expect(filteredList).toHaveLength(1);
    expect(filteredList[0]).toMatchObject({ id: createdUser.id, email: 'carmen@malaga.test' });
    expect(filteredList[0]).not.toHaveProperty('passwordHash');

    const promoted = await requestJson(`/api/users/${citizen.user.id}`, 'PATCH', admin.token, {
      role: Role.PO,
      organizationId: 'org-malaga',
    });
    expect(promoted.status).toBe(200);
    expect(await promoted.json()).toMatchObject({
      id: citizen.user.id,
      role: Role.PO,
      organizationId: 'org-malaga',
    });

    const fetched = await requestJson(`/api/users/${citizen.user.id}`, 'GET', admin.token);
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toMatchObject({ role: Role.PO, organizationId: 'org-malaga' });
  });

  it('requires an organizationId for organization member roles (dev, qa, po)', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });

    for (const role of [Role.Dev, Role.QA, Role.PO]) {
      const res = await requestJson('/api/users', 'POST', admin.token, {
        displayName: 'Sin Organismo',
        email: `${role}@coordia.test`,
        password: samplePassword,
        role,
      });
      expect(res.status).toBe(400);
    }

    const citizen = createAccountWithSession({ email: 'ciudadano@coordia.test', role: Role.Guest });
    const upgradeWithoutOrg = await requestJson(`/api/users/${citizen.user.id}`, 'PATCH', admin.token, {
      role: Role.Dev,
    });
    expect(upgradeWithoutOrg.status).toBe(400);

    const qaUser = createAccountWithSession({
      email: 'qa@org.test',
      role: Role.QA,
      organizationId: 'org-1',
    });
    const clearOrgForQa = await requestJson(`/api/users/${qaUser.user.id}`, 'PATCH', admin.token, {
      organizationId: null,
    });
    expect(clearOrgForQa.status).toBe(400);
  });

  it('does not allow users to be assigned to an organism that does not exist', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    const citizen = createAccountWithSession({ email: 'ciudadano@coordia.test', role: Role.Guest });

    const createWithUnknownOrganization = await requestJson('/api/users', 'POST', admin.token, {
      displayName: 'Miembro sin organismo real',
      email: 'sin-organismo@coordia.test',
      password: samplePassword,
      role: Role.QA,
      organizationId: 'org-inexistente',
    });
    expect(createWithUnknownOrganization.status).toBe(400);

    const assignUnknownOrganization = await requestJson(`/api/users/${citizen.user.id}`, 'PATCH', admin.token, {
      organizationId: 'org-inexistente',
    });
    expect(assignUnknownOrganization.status).toBe(400);
    expect(store.accountById(citizen.user.id)?.user.organizationId).toBeUndefined();
  });

  it('denies all /api/users endpoints to non-admin roles', async () => {
    const target = createAccountWithSession({
      email: 'target@coordia.test',
      role: Role.Guest,
      organizationId: 'org-1',
    });

    const nonAdmins = [
      createAccountWithSession({ email: 'guest@coordia.test', role: Role.Guest, organizationId: 'org-1' }),
      createAccountWithSession({ email: 'dev@coordia.test', role: Role.Dev, organizationId: 'org-1' }),
      createAccountWithSession({ email: 'qa@coordia.test', role: Role.QA, organizationId: 'org-1' }),
      createAccountWithSession({ email: 'po@coordia.test', role: Role.PO, organizationId: 'org-1' }),
    ];

    for (const actor of nonAdmins) {
      expect((await requestJson('/api/users', 'GET', actor.token)).status).toBe(403);
      expect((await requestJson(`/api/users/${target.user.id}`, 'GET', actor.token)).status).toBe(403);
      expect((await requestJson('/api/users', 'POST', actor.token, {
        displayName: 'Escalada',
        email: 'escalada@coordia.test',
        password: samplePassword,
        role: Role.Admin,
      })).status).toBe(403);
      expect((await requestJson(`/api/users/${target.user.id}`, 'PATCH', actor.token, {
        role: Role.Admin,
      })).status).toBe(403);
      expect((await requestJson(`/api/users/${target.user.id}/revoke`, 'POST', actor.token)).status).toBe(403);
      expect((await requestJson(`/api/users/${target.user.id}/sessions`, 'DELETE', actor.token)).status).toBe(403);
      expect((await requestJson(`/api/users/${target.user.id}`, 'DELETE', actor.token)).status).toBe(403);
    }
  });
});

describe('HU-11 T2: immediate synchronization and session revocation on admin changes', () => {
  it('immediately updates scope and permissions on active sessions when organizationId or role changes', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    store.createOrganization({ id: 'org-1', name: 'Organismo 1' });
    store.createOrganization({ id: 'org-2', name: 'Organismo 2' });

    const qaAccount = createAccountWithSession({
      email: 'qa@org1.test',
      role: Role.QA,
      organizationId: 'org-1',
    });

    const report = await Report.create({
      ownerId: 'author-1',
      organizationId: 'org-1',
      status: 'pending',
      category: 'safety',
      description: 'Farola caída en calle principal.',
      location: { latitude: 40.4168, longitude: -3.7038 },
      createdAt: new Date().toISOString(),
    });

    expect((await requestJson('/api/organizations/org-1', 'GET', qaAccount.token)).status).toBe(200);

    // Move QA user from org-1 to org-2: existing access token loses org-1 access immediately.
    const moved = await requestJson(`/api/users/${qaAccount.user.id}`, 'PATCH', admin.token, {
      organizationId: 'org-2',
    });
    expect(moved.status).toBe(200);
    expect((await requestJson('/api/organizations/org-1', 'GET', qaAccount.token)).status).toBe(403);
    expect((await requestJson(`/api/reports/${report.id}`, 'PATCH', qaAccount.token, { status: 'validated' })).status).toBe(403);
    expect((await requestJson('/api/organizations/org-2', 'GET', qaAccount.token)).status).toBe(200);

    // Move back to org-1 and verify QA can validate, then downgrade to Guest and verify immediate denial.
    expect((await requestJson(`/api/users/${qaAccount.user.id}`, 'PATCH', admin.token, {
      organizationId: 'org-1',
    })).status).toBe(200);
    expect((await requestJson(`/api/reports/${report.id}`, 'PATCH', qaAccount.token, { status: 'validated' })).status).toBe(200);

    const secondReport = await Report.create({
      ownerId: 'author-2',
      organizationId: 'org-1',
      status: 'pending',
      category: 'infrastructure',
      description: 'Bache profundo en vía pública.',
      location: { latitude: 40.4168, longitude: -3.7038 },
      createdAt: new Date().toISOString(),
    });

    const downgraded = await requestJson(`/api/users/${qaAccount.user.id}`, 'PATCH', admin.token, {
      role: Role.Guest,
    });
    expect(downgraded.status).toBe(200);
    expect((await requestJson(`/api/reports/${secondReport.id}`, 'PATCH', qaAccount.token, { status: 'validated' })).status).toBe(403);
  });

  it('immediately revokes access and refresh tokens on admin revoke or user deletion', async () => {
    const admin = createAccountWithSession({ email: 'admin@coordia.test', role: Role.Admin });
    const member = createAccountWithSession({
      email: 'ciudadano@org1.test',
      role: Role.Guest,
      organizationId: 'org-1',
    });

    const loginResponse = await requestJson('/api/auth/login', 'POST', undefined, {
      email: 'ciudadano@org1.test',
      password: samplePassword,
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json() as { accessToken: string };
    const refreshCookie = loginResponse.headers.get('set-cookie')!.split(';')[0];

    expect((await requestJson('/api/reports/mi', 'GET', loginBody.accessToken)).status).toBe(200);

    const revoked = await requestJson(`/api/users/${member.user.id}/revoke`, 'POST', admin.token);
    expect(revoked.status).toBe(204);

    const afterRevoke = await requestJson('/api/reports/mi', 'GET', loginBody.accessToken);
    expect(afterRevoke.status).toBe(401);
    expect(await afterRevoke.json()).toEqual({ error: 'Sesión inválida' });

    const refreshAfterRevoke = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: refreshCookie },
    });
    expect(refreshAfterRevoke.status).toBe(401);

    // New login works until user is deleted by admin.
    const secondLogin = await requestJson('/api/auth/login', 'POST', undefined, {
      email: 'ciudadano@org1.test',
      password: samplePassword,
    });
    expect(secondLogin.status).toBe(200);
    const secondAccessToken = (await secondLogin.json() as { accessToken: string }).accessToken;
    const secondCookie = secondLogin.headers.get('set-cookie')!.split(';')[0];

    const deleted = await requestJson(`/api/users/${member.user.id}`, 'DELETE', admin.token);
    expect(deleted.status).toBe(204);

    expect((await requestJson('/api/reports/mi', 'GET', secondAccessToken)).status).toBe(401);
    const refreshAfterDelete = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: secondCookie },
    });
    expect(refreshAfterDelete.status).toBe(401);
  });
});
