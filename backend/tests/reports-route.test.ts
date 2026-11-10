import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer } from '../src/index.js';
import { Role } from '../src/constants/roles.js';
import { Report } from '../src/models/report.js';

const secret = 'insecure-dev-secret';
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createServer().listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function tokenForGuest(id = `test-user-${crypto.randomUUID()}`, organizationId = 'test-organization') {
  return jwt.sign({
    id,
    email: 'citizen@example.test',
    role: Role.Guest,
    organizationId,
  }, secret);
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
    const noOrganizationToken = jwt.sign({
      id: 'unassigned-guest',
      email: 'guest@example.test',
      role: Role.Guest,
    }, secret);
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
  async function createReport(ownerId = `author-${crypto.randomUUID()}`) {
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenForGuest(ownerId)}` },
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
