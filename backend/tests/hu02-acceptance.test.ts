import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { Role } from '../src/constants/roles.js';
import { ReportStore } from '../src/models/report.js';
import type { User } from '../src/types/user.js';

// HU-02 T3: envío correcto, datos incompletos, coordenadas inválidas y
// respuestas de error sin eco de datos sensibles. El fallo de conexión
// (CA-4) se cubre en los tests del formulario del frontend.

const validReport = {
  category: 'infrastructure',
  description: 'Hay una farola caída que bloquea parte de la acera.',
  location: { latitude: 36.7213, longitude: -4.4214 },
};

let authStore: AuthStore;
let reportStore: ReportStore;
let server: Server;
let base: string;

beforeEach(async () => {
  authStore = new AuthStore(':memory:');
  reportStore = new ReportStore(':memory:');
  server = createServer(authStore, reportStore).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  reportStore.close();
  authStore.close();
});

function openSession(user: User) {
  const session = authStore.createSession(user);
  return { sid: session.sid, token: issueAccessToken(session.sid, user), user };
}

function citizen(organizationId = 'malaga', id = crypto.randomUUID()) {
  return openSession({
    id,
    email: `${id}@example.test`,
    role: Role.Guest,
    organizationId,
  });
}

function create(token: string | null, body: unknown, extra: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${base}/api/reports`, {
    method: 'POST',
    ...extra,
    headers,
    body: extra.body === undefined ? JSON.stringify(body) : extra.body as BodyInit,
  });
}

async function json(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

describe('HU-02 acceptance: create a geolocated report', () => {
  it('CA-1 records description, location, category, author and timestamp, stays pending and returns an id', async () => {
    const author = citizen();
    const occurredAt = '2026-11-10T08:30:00Z';
    const response = await create(author.token, { ...validReport, occurredAt });
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ...validReport,
      occurredAt: '2026-11-10T08:30:00.000Z',
      ownerId: author.user.id,
      organizationId: 'malaga',
      status: 'pending',
    });
    expect(body.id).toEqual(expect.any(String));
    expect(body.createdAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(String(body.createdAt)))).toBe(false);
  });

  it('CA-2 rejects missing required fields with Spanish field errors', async () => {
    const { token } = citizen();
    const response = await create(token, {});
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe('Datos del reporte no válidos');
    expect(body.fields).toMatchObject({
      category: 'Selecciona una categoría válida',
      description: 'La descripción es obligatoria',
      location: 'La ubicación es obligatoria',
    });
  });

  it('CA-2 rejects an empty or too-short description', async () => {
    const { token } = citizen();
    const response = await create(token, { ...validReport, description: '   corto   ' });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe('Datos del reporte no válidos');
    expect(body.fields).toMatchObject({
      description: 'La descripción debe tener entre 10 y 2.000 caracteres',
    });
  });

  it('CA-2 rejects GPS-unavailable payloads without a location', async () => {
    const { token } = citizen();
    const response = await create(token, {
      category: validReport.category,
      description: validReport.description,
    });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe('Datos del reporte no válidos');
    expect(body.fields).toMatchObject({ location: 'La ubicación es obligatoria' });
  });

  it('CA-2 rejects invalid coordinates', async () => {
    const { token } = citizen();
    const response = await create(token, {
      ...validReport,
      location: { latitude: 91, longitude: -181 },
    });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe('Datos del reporte no válidos');
    expect(body.fields).toMatchObject({
      'location.latitude': 'La latitud debe ser un número entre -90 y 90',
      'location.longitude': 'La longitud debe ser un número entre -180 y 180',
    });
  });

  it('does not echo sensitive client fields in validation errors', async () => {
    const { token } = citizen();
    const secret = 'gho_super-secret-token';
    const response = await create(token, {
      ...validReport,
      ownerId: 'forged-owner',
      status: 'validated',
      password: 'frase-secreta-de-prueba',
      accessToken: secret,
    });
    const body = await json(response);
    const text = serialized(body);

    expect(response.status).toBe(400);
    expect(body.error).toBe('Datos del reporte no válidos');
    expect(body.fields).toMatchObject({
      ownerId: 'Campo no permitido',
      status: 'Campo no permitido',
      password: 'Campo no permitido',
      accessToken: 'Campo no permitido',
    });
    expect(text).not.toContain('forged-owner');
    expect(text).not.toContain('frase-secreta-de-prueba');
    expect(text).not.toContain(secret);
    expect(text).not.toContain('validated');
  });

  it('returns a generic 400 for malformed JSON without echoing the payload', async () => {
    const { token } = citizen();
    const raw = '{"password":"eco-prohibido","category":';
    const response = await create(token, null, { body: raw });
    const body = await json(response);
    const text = serialized(body);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'JSON inválido' });
    expect(text).not.toContain('eco-prohibido');
  });

  it('returns a generic 500 when persistence fails without exposing the technical detail', async () => {
    const { token } = citizen();
    vi.spyOn(reportStore, 'create').mockImplementation(() => {
      throw new Error('detalle interno: sqlite token=super-secret');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await create(token, validReport);
    const body = await json(response);
    const text = serialized(body);

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error interno del servidor' });
    expect(text).not.toContain('super-secret');
    expect(text).not.toContain('detalle interno');
  });
});
