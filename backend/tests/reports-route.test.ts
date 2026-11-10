import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer } from '../src/index.js';
import { Role } from '../src/constants/roles.js';

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

function tokenForGuest() {
  return jwt.sign({
    id: `test-user-${crypto.randomUUID()}`,
    email: 'citizen@example.test',
    role: Role.Guest,
    organizationId: 'test-organization',
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
