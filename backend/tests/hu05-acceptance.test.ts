import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { Role } from '../src/constants/roles.js';
import { ReportStore } from '../src/models/report.js';
import { defaultRule, evaluateConfidence, type Contribution } from '../src/models/confidence.js';
import type { User } from '../src/types/user.js';

// HU-05 T3: umbral 0,70 / pendiente por debajo, efecto de rechazos,
// duplicados de opinión y ráfaga. El estado de verificación no es «atendido».
// T2 no implementa REJECTED ni el +0,15 de fusión de T1: 0,39 permanece pendiente.

function confirm(reputation: number, seconds: number): Contribution {
  return { response: 'confirm', reputation, updatedAt: new Date(seconds * 1000).toISOString() };
}

function question(reputation: number, seconds: number): Contribution {
  return { response: 'question', reputation, updatedAt: new Date(seconds * 1000).toISOString() };
}

const MALAGA = { latitude: 36.7213, longitude: -4.4214 };

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
  await new Promise<void>((resolve) => server.close(() => resolve()));
  reportStore.close();
  authStore.close();
});

function tokenFor(role: Role, id: string, organizationId = 'org-malaga') {
  const user: User = { id, email: `${id}@example.test`, role, organizationId };
  const session = authStore.createSession(user);
  return issueAccessToken(session.sid, user);
}

function request(path: string, token: string, method = 'GET', body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createReport(ownerId: string, category = 'safety') {
  const response = await request('/api/reports', tokenFor(Role.Guest, ownerId), 'POST', {
    category,
    description: 'Incidente de prueba para umbral de confianza.',
    location: MALAGA,
    creatorObservation: { ...MALAGA, capturedAt: new Date().toISOString(), accuracyMeters: 10 },
  });
  expect(response.status).toBe(201);
  return await response.json() as { id: string; status: string; verification: { state: string; score: number } };
}

describe('HU-05 T3: umbrales, rechazos y duplicados', () => {
  it('CA-1 keeps a documented threshold of 0.70 and lets an admin change the rule by category', async () => {
    expect(defaultRule.threshold).toBe(0.70);
    const admin = tokenFor(Role.Admin, 'rule-admin');
    const citizen = tokenFor(Role.Guest, 'rule-citizen');
    const rule = { threshold: 0.50, creatorWeight: 0.30, proximityWeight: 0.25, socialWeight: 0.35 };

    expect((await request('/api/reports/confidence-rules/safety', citizen, 'PUT', rule)).status).toBe(403);
    expect((await request('/api/reports/confidence-rules/safety', admin, 'PUT', rule)).status).toBe(200);
    expect(await (await request('/api/reports/confidence-rules/safety', admin)).json())
      .toMatchObject({ threshold: 0.50 });
    expect(await (await request('/api/reports/confidence-rules/other', admin)).json())
      .toMatchObject({ threshold: 0.70 });
  });

  it('marks 0.69 as pending and 0.70 as verified', () => {
    expect(evaluateConfidence(defaultRule, 1, 1, [confirm(0.4, 0)])).toEqual({ state: 'pending', score: 0.69 });
    expect(evaluateConfidence(defaultRule, 1, 1, [confirm(3 / 7, 0)])).toEqual({ state: 'verified', score: 0.70 });
  });

  it('CA-3 keeps scores below the threshold pending, including 0.40 and 0.39', () => {
    expect(evaluateConfidence(defaultRule, 0.5, 1, [])).toEqual({ state: 'pending', score: 0.40 });
    expect(evaluateConfidence(defaultRule, 0.466, 1, [])).toEqual({ state: 'pending', score: 0.39 });
  });

  it('CA-2 records the transition time when the score reaches the threshold', async () => {
    const report = await createReport('owner-verified');
    const admin = tokenFor(Role.Admin, 'admin-verified');
    expect((await request('/api/reports/confidence-rules/safety', admin, 'PUT', {
      threshold: 0.38, creatorWeight: 0.30, proximityWeight: 0.25, socialWeight: 0.35,
    })).status).toBe(200);
    const before = Date.now();
    const answer = await request(`/api/reports/${report.id}/response`, tokenFor(Role.Guest, 'voter-verified'), 'PUT', {
      response: 'confirm',
      location: { ...MALAGA, capturedAt: new Date().toISOString(), accuracyMeters: 5 },
    });
    const body = await answer.json() as { verification: { state: string; changedAt: string } };
    expect(answer.status).toBe(200);
    expect(body.verification.state).toBe('verified');
    expect(Date.parse(body.verification.changedAt)).toBeGreaterThanOrEqual(before);

    const audit = await (await request(`/api/reports/${report.id}/verification`, tokenFor(Role.Guest, 'owner-verified'))).json() as {
      history: Array<{ state: string; changedAt: string }>;
    };
    expect(audit.history.map((event) => event.state)).toEqual(['pending', 'verified']);
    expect(Date.parse(audit.history[1].changedAt)).toBeGreaterThan(0);
  });

  it('CA-4 lowers the score when a confirmation is replaced by a rejection', () => {
    const confirmed = evaluateConfidence(defaultRule, 1, 1, [confirm(3 / 7, 0)]);
    const afterReject = evaluateConfidence(defaultRule, 1, 1, [question(3 / 7, 60)]);
    expect(confirmed).toEqual({ state: 'verified', score: 0.70 });
    expect(afterReject.state).toBe('pending');
    expect(afterReject.score).toBeLessThan(confirmed.score);
  });

  it('CA-4 does not count a duplicate confirmation from the same person twice', async () => {
    const report = await createReport('owner-dup');
    const voter = tokenFor(Role.Guest, 'voter-dup');
    const payload = {
      response: 'confirm',
      location: { ...MALAGA, capturedAt: new Date().toISOString(), accuracyMeters: 5 },
    };
    const first = await request(`/api/reports/${report.id}/response`, voter, 'PUT', payload);
    const second = await request(`/api/reports/${report.id}/response`, voter, 'PUT', payload);
    expect(await first.json()).toMatchObject({ changed: true, counts: { confirm: 1 } });
    expect(await second.json()).toMatchObject({ changed: false, counts: { confirm: 1 } });
  });

  it('applies the -0.40 burst penalty for three confirmations in under 30 seconds', () => {
    expect(evaluateConfidence(defaultRule, 1, 1, [0, 10, 20].map((time) => confirm(1, time))))
      .toEqual({ state: 'pending', score: 0.50 });
  });

  it('CA-4 does not treat community verification as an attended incident', async () => {
    const report = await createReport('owner-status');
    expect((await request('/api/reports/confidence-rules/safety', tokenFor(Role.Admin, 'admin-status'), 'PUT', {
      threshold: 0.38, creatorWeight: 0.30, proximityWeight: 0.25, socialWeight: 0.35,
    })).status).toBe(200);
    const answer = await request(`/api/reports/${report.id}/response`, tokenFor(Role.Guest, 'voter-status'), 'PUT', {
      response: 'confirm',
      location: { ...MALAGA, capturedAt: new Date().toISOString(), accuracyMeters: 5 },
    });
    expect(await answer.json()).toMatchObject({ verification: { state: 'verified' } });
    const stored = reportStore.findByPk(report.id);
    expect(stored?.verification.state).toBe('verified');
    // La verificación comunitaria no añade una marca de incidente atendido.
    expect(stored).not.toHaveProperty('attended');
  });
});
