import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthStore } from '../src/auth/store.js';
import { issueAccessToken } from '../src/routes/auth.js';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer } from '../src/index.js';
import { Role } from '../src/constants/roles.js';
import { Report } from '../src/models/report.js';

const authStore = new AuthStore(':memory:');
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createServer(authStore).listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  authStore.close();
});

function tokenForGuest(id = `test-user-${crypto.randomUUID()}`, organizationId = 'test-organization') {
  return tokenForRole(Role.Guest, id, organizationId);
}

function tokenForRole(role: Role, id: string, organizationId = 'test-organization') {
  const user = {
    id,
    email: 'citizen@example.test',
    role,
    organizationId,
  };
  const session = authStore.createSession(user);
  return issueAccessToken(session.sid, user);
}

const reportBody = {
  category: 'safety',
  description: 'Hay una señal de tráfico caída en la calzada.',
  location: { latitude: 40.4168, longitude: -3.7038 },
};

describe('POST /api/reports', () => {
  it('creates a report with server-controlled identity and initial status', async () => {
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenForGuest()}`,
      },
      body: JSON.stringify({ ...reportBody, ownerId: 'forged-owner', status: 'approved' }),
    });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.error).toBe('Datos del reporte no válidos');
  });

  it('accepts a valid report for an in-scope user', async () => {
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenForGuest()}`,
      },
      body: JSON.stringify(reportBody),
    });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ...reportBody,
      organizationId: 'test-organization',
      status: 'pending',
    });
    expect(body.id).toBeTypeOf('string');
    expect(body.ownerId).toMatch(/^test-user-/);
    expect(body.createdAt).toBeTypeOf('string');
  });

  it('rejects a guest without an organization assignment', async () => {
    const user = {
      id: 'unassigned-guest',
      email: 'guest@example.test',
      role: Role.Guest,
    };
    const session = authStore.createSession(user);
    const noOrganizationToken = issueAccessToken(session.sid, user);
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${noOrganizationToken}`,
      },
      body: JSON.stringify(reportBody),
    });

    expect(response.status).toBe(403);
  });
});

describe('nearby reports and citizen responses', () => {
  async function createReport(ownerId = `author-${crypto.randomUUID()}`, organizationId = 'test-organization') {
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest(ownerId, organizationId)}` },
      body: JSON.stringify(reportBody),
    });
    expect(response.status).toBe(201);
    return await response.json() as { id: string };
  }

  function locationObservation(longitude = reportBody.location.longitude) {
    return {
      latitude: reportBody.location.latitude,
      longitude,
      accuracyMeters: 24,
      capturedAt: new Date().toISOString(),
    };
  }

  it('lists nearby pending reports without exposing owner or exact coordinates', async () => {
    const report = await createReport();
    const response = await fetch(`${baseUrl}/api/reports/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest('nearby-user')}` },
      body: JSON.stringify({ location: locationObservation() }),
    });
    const body = await response.json() as { reports: Record<string, unknown>[] };

    expect(response.status).toBe(200);
    expect(body.reports).toContainEqual(expect.objectContaining({ id: report.id, distanceMeters: 0 }));
    const listed = body.reports.find((item) => item.id === report.id)!;
    expect(listed).not.toHaveProperty('ownerId');
    expect(listed).not.toHaveProperty('location');
  });

  it('prevents duplicate counts and updates a response when the user changes their mind', async () => {
    const report = await createReport();
    const token = tokenForGuest('responding-user');
    const submitResponse = (responseValue: 'confirm' | 'question') => fetch(`${baseUrl}/api/reports/${report.id}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ response: responseValue, location: locationObservation() }),
    });

    const first = await submitResponse('confirm');
    const firstBody = await first.json() as { counts: { confirm: number; question: number }; changed: boolean };
    expect(first.status).toBe(200);
    expect(firstBody.changed).toBe(true);
    expect(firstBody.counts).toEqual({ confirm: 1, question: 0 });

    const repeated = await submitResponse('confirm');
    const repeatedBody = await repeated.json() as typeof firstBody;
    expect(repeatedBody.changed).toBe(false);
    expect(repeatedBody.counts).toEqual({ confirm: 1, question: 0 });

    const changed = await submitResponse('question');
    const changedBody = await changed.json() as { counts: { confirm: number; question: number }; changed: boolean };
    expect(changedBody.changed).toBe(true);
    expect(changedBody.counts).toEqual({ confirm: 0, question: 1 });
  });

  it('rejects self-responses and responses from outside the proximity radius', async () => {
    const ownReport = await createReport('same-citizen');
    const ownResponse = await fetch(`${baseUrl}/api/reports/${ownReport.id}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest('same-citizen')}` },
      body: JSON.stringify({ response: 'confirm', location: locationObservation() }),
    });
    expect(ownResponse.status).toBe(403);

    const otherReport = await createReport();
    const distantResponse = await fetch(`${baseUrl}/api/reports/${otherReport.id}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest('distant-citizen')}` },
      body: JSON.stringify({ response: 'confirm', location: locationObservation(-3.71) }),
    });
    expect(distantResponse.status).toBe(422);
  });

  it('requires an authenticated guest with an organization assignment', async () => {
    const response = await fetch(`${baseUrl}/api/reports/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: locationObservation() }),
    });
    expect(response.status).toBe(401);
  });

  it('rejects responses from another organization and after report closure', async () => {
    const report = await createReport();
    const otherOrganizationResponse = await fetch(`${baseUrl}/api/reports/${report.id}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest('other-org-user', 'other-org')}` },
      body: JSON.stringify({ response: 'confirm', location: locationObservation() }),
    });
    expect(otherOrganizationResponse.status).toBe(403);

    const storedReport = await Report.findByPk(report.id);
    await storedReport?.update({ status: 'validated' });
    const closedResponse = await fetch(`${baseUrl}/api/reports/${report.id}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest('closed-report-user')}` },
      body: JSON.stringify({ response: 'question', location: locationObservation() }),
    });
    expect(closedResponse.status).toBe(409);
  });
});

describe('report read scope', () => {
  async function createGuestReport(ownerId: string, organizationId: string) {
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenForGuest(ownerId, organizationId)}`,
      },
      body: JSON.stringify(reportBody),
    });
    expect(response.status).toBe(201);
    return await response.json() as { id: string };
  }

  async function listReports(path: string, token: string) {
    return fetch(`${baseUrl}/api/reports${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  it('allows a citizen to read their own reports but not another citizen’s', async () => {
    const ownReport = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest('scope-citizen')}` },
      body: JSON.stringify(reportBody),
    });
    const own = await ownReport.json() as { id: string };
    const other = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest('another-citizen')}` },
      body: JSON.stringify(reportBody),
    });
    const otherBody = await other.json() as { id: string };

    const response = await listReports('', tokenForGuest('scope-citizen'));
    const reports = await response.json() as { id: string }[];
    expect(response.status).toBe(200);
    expect(reports.map(({ id }) => id)).toContain(own.id);
    expect(reports.map(({ id }) => id)).not.toContain(otherBody.id);

    const ownOnly = await listReports('/mi', tokenForGuest('scope-citizen'));
    expect(ownOnly.status).toBe(200);
    expect(await ownOnly.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: own.id })]));
  });

  it('limits organization members to their assigned organization', async () => {
    const inScope = await createGuestReport('scope-org-author', 'scope-org');
    const outOfScope = await createGuestReport('other-org-author', 'other-org');

    const response = await listReports('', tokenForRole(Role.QA, 'qa-reviewer', 'scope-org'));
    const reports = await response.json() as { id: string }[];
    expect(response.status).toBe(200);
    expect(reports.map(({ id }) => id)).toContain(inScope.id);
    expect(reports.map(({ id }) => id)).not.toContain(outOfScope.id);
  });

  it('creates and lists development reports for dev without exposing production reports', async () => {
    const devToken = tokenForRole(Role.Dev, 'developer', 'dev-org');
    const created = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devToken}` },
      body: JSON.stringify(reportBody),
    });
    const createdBody = await created.json() as { id: string; environment: string };
    expect(created.status).toBe(201);
    expect(createdBody.environment).toBe('development');

    await createGuestReport('developer', 'dev-org');
    await Report.create({
      ...reportBody,
      category: 'safety',
      ownerId: 'developer',
      organizationId: 'dev-org',
      environment: 'production',
    });
    const response = await listReports('', devToken);
    const reports = await response.json() as { id: string; environment?: string }[];
    expect(response.status).toBe(200);
    expect(reports.map(({ id }) => id)).toContain(createdBody.id);
    expect(reports.every(({ environment }) => environment === 'development')).toBe(true);

    const ownReports = await listReports('/mi', devToken);
    expect(ownReports.status).toBe(200);
    expect(await ownReports.json()).toEqual([expect.objectContaining({ id: createdBody.id })]);
  });
});
