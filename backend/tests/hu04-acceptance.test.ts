import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { Role } from '../src/constants/roles.js';
import { Report } from '../src/models/report.js';
import { ReportResponse } from '../src/models/report-response.js';
import {
  distanceBetweenMeters,
  MAX_LOCATION_ACCURACY_METERS,
  MAX_RESPONSE_DISTANCE_METERS,
} from '../src/validation/report-response.js';
import type { User } from '../src/types/user.js';

// HU-04 está implementada en main (PUT /api/reports/:id/response y POST /api/reports/nearby).
// El radio inclusivo es 500 m: se rechaza solo si la distancia Haversine es estrictamente mayor.

const ORIGIN = { latitude: 0, longitude: 0 };

let store: AuthStore;
let server: Server;
let base: string;

beforeEach(async () => {
  store = new AuthStore(':memory:');
  server = createServer(store).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
});

function openSession(user: User) {
  const session = store.createSession(user);
  return { sid: session.sid, token: issueAccessToken(session.sid, user), user };
}

function citizen(organizationId: string, id = crypto.randomUUID()) {
  return openSession({
    id,
    email: `${id}@example.test`,
    role: Role.Guest,
    organizationId,
  });
}

async function createReport(organizationId: string, ownerId = crypto.randomUUID()) {
  const owner = citizen(organizationId, ownerId);
  const response = await fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({
      category: 'safety',
      description: 'Hay una señal de tráfico caída en la calzada.',
      location: ORIGIN,
    }),
  });
  expect(response.status).toBe(201);
  const body = await response.json() as { id: string };
  return { id: body.id, owner };
}

function observation(longitude: number, overrides: Record<string, unknown> = {}) {
  return {
    latitude: ORIGIN.latitude,
    longitude,
    accuracyMeters: 24,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

function longitudeForMeters(meters: number) {
  return (meters / 6_371_000) * (180 / Math.PI);
}

function boundaryPair() {
  let inside = 0;
  let outside = longitudeForMeters(MAX_RESPONSE_DISTANCE_METERS + 5);
  for (let step = 0; step < 60; step += 1) {
    const midpoint = (inside + outside) / 2;
    const distance = distanceBetweenMeters(ORIGIN, { latitude: ORIGIN.latitude, longitude: midpoint });
    if (distance <= MAX_RESPONSE_DISTANCE_METERS) inside = midpoint;
    else outside = midpoint;
  }
  return {
    insideLongitude: inside,
    outsideLongitude: outside,
    insideDistance: distanceBetweenMeters(ORIGIN, { latitude: ORIGIN.latitude, longitude: inside }),
    outsideDistance: distanceBetweenMeters(ORIGIN, { latitude: ORIGIN.latitude, longitude: outside }),
  };
}

function sendResponse(
  reportId: string,
  token: string | null,
  responseValue: string,
  longitude: number,
  locationOverrides: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${base}/api/reports/${reportId}/response`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      response: responseValue,
      location: observation(longitude, locationOverrides),
      ...extra,
    }),
  });
}

interface ContributionBody {
  reportId: string;
  response: 'confirm' | 'question';
  changed: boolean;
  updatedAt: string;
  counts: { confirm: number; question: number };
}

describe('HU-04 acceptance: confirm or question a report', () => {
  it('CA-1 lets an authenticated citizen confirm and question a report inside the radius', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const inside = longitudeForMeters(100);
    expect(distanceBetweenMeters(ORIGIN, { latitude: 0, longitude: inside })).toBeLessThan(MAX_RESPONSE_DISTANCE_METERS);

    const confirmer = citizen(organizationId);
    const confirmed = await sendResponse(report.id, confirmer.token, 'confirm', inside);
    const confirmedBody = await confirmed.json() as ContributionBody;
    expect(confirmed.status).toBe(200);
    expect(confirmedBody).toMatchObject({
      reportId: report.id,
      response: 'confirm',
      changed: true,
      counts: { confirm: 1, question: 0 },
    });

    const questioner = citizen(organizationId);
    const questioned = await sendResponse(report.id, questioner.token, 'question', inside);
    const questionedBody = await questioned.json() as ContributionBody;
    expect(questioned.status).toBe(200);
    expect(questionedBody).toMatchObject({
      reportId: report.id,
      response: 'question',
      changed: true,
      counts: { confirm: 1, question: 1 },
    });
  });

  it('CA-1 accepts the configured accuracy and age limits when the citizen is inside the radius', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const actor = citizen(organizationId);
    const capturedAt = new Date(Date.now() - (5 * 60 * 1000 - 2_000)).toISOString();
    const response = await sendResponse(report.id, actor.token, 'confirm', longitudeForMeters(50), {
      accuracyMeters: MAX_LOCATION_ACCURACY_METERS,
      capturedAt,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ response: 'confirm', counts: { confirm: 1, question: 0 } });
  });

  it('accepts a location on the inclusive 500 m boundary and rejects the next point outside it', async () => {
    const boundary = boundaryPair();
    expect(boundary.insideDistance).toBeLessThanOrEqual(MAX_RESPONSE_DISTANCE_METERS);
    expect(boundary.outsideDistance).toBeGreaterThan(MAX_RESPONSE_DISTANCE_METERS);
    expect(MAX_RESPONSE_DISTANCE_METERS - boundary.insideDistance).toBeLessThan(0.001);
    expect(boundary.outsideDistance - MAX_RESPONSE_DISTANCE_METERS).toBeLessThan(0.001);

    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const onBoundary = citizen(organizationId);
    const accepted = await sendResponse(report.id, onBoundary.token, 'confirm', boundary.insideLongitude);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ changed: true, counts: { confirm: 1, question: 0 } });

    const justOutside = citizen(organizationId);
    const rejected = await sendResponse(report.id, justOutside.token, 'question', boundary.outsideLongitude);
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({
      error: 'Debes estar a 500 metros o menos del incidente para responder',
    });
    expect(await ReportResponse.find(report.id, justOutside.user.id)).toBeNull();
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 1, question: 0 });
  });

  it('rejects a location outside the radius without recording a contribution', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const outside = longitudeForMeters(800);
    expect(distanceBetweenMeters(ORIGIN, { latitude: 0, longitude: outside })).toBeGreaterThan(MAX_RESPONSE_DISTANCE_METERS);

    const actor = citizen(organizationId);
    const response = await sendResponse(report.id, actor.token, 'confirm', outside);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: 'Debes estar a 500 metros o menos del incidente para responder',
    });
    expect(await ReportResponse.find(report.id, actor.user.id)).toBeNull();
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 0, question: 0 });
  });

  it('rejects an imprecise or stale location without recording a contribution', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const actor = citizen(organizationId);

    const imprecise = await sendResponse(report.id, actor.token, 'confirm', 0, { accuracyMeters: MAX_LOCATION_ACCURACY_METERS + 1 });
    expect(imprecise.status).toBe(422);
    expect(await imprecise.json()).toEqual({
      error: `La ubicación debe tener una precisión de ${MAX_LOCATION_ACCURACY_METERS} metros o mejor`,
    });

    const stale = await sendResponse(report.id, actor.token, 'question', 0, {
      capturedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    });
    expect(stale.status).toBe(422);
    expect(await stale.json()).toEqual({ error: 'La ubicación ha caducado; obtén una nueva' });
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 0, question: 0 });
  });

  it('CA-2 records the user, report, sense and date of an accepted contribution', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const actor = citizen(organizationId);
    const before = Date.now();
    const response = await sendResponse(report.id, actor.token, 'question', longitudeForMeters(20));
    const body = await response.json() as ContributionBody;

    expect(response.status).toBe(200);
    expect(body.reportId).toBe(report.id);
    expect(body.response).toBe('question');
    expect(Number.isNaN(Date.parse(body.updatedAt))).toBe(false);
    expect(Date.parse(body.updatedAt)).toBeGreaterThanOrEqual(before - 1_000);
    expect(Date.parse(body.updatedAt)).toBeLessThanOrEqual(Date.now() + 1_000);

    const stored = await ReportResponse.find(report.id, actor.user.id);
    expect(stored).toMatchObject({
      reportId: report.id,
      userId: actor.user.id,
      response: 'question',
      updatedAt: body.updatedAt,
    });
    expect(stored?.history).toEqual([{
      previous: null,
      next: 'question',
      changedAt: body.updatedAt,
    }]);
    expect(stored?.proximityVerifiedAt).toBe(body.updatedAt);

    const nearby = await fetch(`${base}/api/reports/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor.token}` },
      body: JSON.stringify({ location: observation(longitudeForMeters(20)) }),
    });
    const listed = (await nearby.json() as { reports: Record<string, unknown>[] }).reports.find((item) => item.id === report.id);
    expect(nearby.status).toBe(200);
    expect(listed).toMatchObject({
      response: 'question',
      counts: { confirm: 0, question: 1 },
    });
    expect(listed).not.toHaveProperty('ownerId');
    expect(listed).not.toHaveProperty('location');

    const other = citizen(organizationId);
    const otherNearby = await fetch(`${base}/api/reports/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${other.token}` },
      body: JSON.stringify({ location: observation(0) }),
    });
    const otherListed = (await otherNearby.json() as { reports: Record<string, unknown>[] }).reports
      .find((item) => item.id === report.id);
    expect(otherListed).toMatchObject({ response: null, counts: { confirm: 0, question: 1 } });
  });

  it('CA-3 does not accumulate duplicate contributions and replaces the opinion in place', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const actor = citizen(organizationId);
    const submit = (responseValue: 'confirm' | 'question') =>
      sendResponse(report.id, actor.token, responseValue, longitudeForMeters(30));

    const first = await submit('confirm');
    const firstBody = await first.json() as ContributionBody;
    expect(first.status).toBe(200);
    expect(firstBody).toMatchObject({ changed: true, counts: { confirm: 1, question: 0 } });

    const repeated = await submit('confirm');
    const repeatedBody = await repeated.json() as ContributionBody;
    expect(repeated.status).toBe(200);
    expect(repeatedBody).toMatchObject({ changed: false, response: 'confirm', counts: { confirm: 1, question: 0 } });
    expect(repeatedBody.updatedAt).toBe(firstBody.updatedAt);

    const changed = await submit('question');
    const changedBody = await changed.json() as ContributionBody;
    expect(changed.status).toBe(200);
    expect(changedBody).toMatchObject({ changed: true, response: 'question', counts: { confirm: 0, question: 1 } });

    const repeatedChange = await submit('question');
    expect(await repeatedChange.json()).toMatchObject({ changed: false, counts: { confirm: 0, question: 1 } });

    const stored = await ReportResponse.find(report.id, actor.user.id);
    expect(stored?.response).toBe('question');
    expect(stored?.userId).toBe(actor.user.id);
    expect(stored?.history).toEqual([
      { previous: null, next: 'confirm', changedAt: firstBody.updatedAt },
      { previous: 'confirm', next: 'question', changedAt: changedBody.updatedAt },
    ]);
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 0, question: 1 });
  });

  it('CA-4 makes accepted contributions available as counts for a confidence calculation', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const otherReport = await createReport(organizationId);
    const confirmer = citizen(organizationId);
    const questioner = citizen(organizationId);

    expect((await sendResponse(report.id, confirmer.token, 'confirm', longitudeForMeters(10))).status).toBe(200);
    const questioned = await sendResponse(report.id, questioner.token, 'question', longitudeForMeters(15));
    const questionedBody = await questioned.json() as ContributionBody;
    expect(questioned.status).toBe(200);
    expect(questionedBody.counts).toEqual({ confirm: 1, question: 1 });
    expect(await ReportResponse.counts(report.id)).toEqual(questionedBody.counts);

    const outsider = citizen(organizationId);
    expect((await sendResponse(report.id, outsider.token, 'confirm', longitudeForMeters(900))).status).toBe(422);
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 1, question: 1 });
    expect(await ReportResponse.counts(otherReport.id)).toEqual({ confirm: 0, question: 0 });

    const nearby = await fetch(`${base}/api/reports/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${confirmer.token}` },
      body: JSON.stringify({ location: observation(0) }),
    });
    const reports = (await nearby.json() as { reports: { id: string; counts: ContributionBody['counts'] }[] }).reports;
    expect(reports.find((item) => item.id === report.id)?.counts).toEqual({ confirm: 1, question: 1 });
    expect(reports.find((item) => item.id === otherReport.id)?.counts).toEqual({ confirm: 0, question: 0 });
  });

  it('rejects a missing session or an invalid token with 401 and does not record a contribution', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);

    const anonymous = await sendResponse(report.id, null, 'confirm', 0);
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: 'Inicia sesión para responder a reportes' });

    const anonymousNearby = await fetch(`${base}/api/reports/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: observation(0) }),
    });
    expect(anonymousNearby.status).toBe(401);

    const invalid = await fetch(`${base}/api/reports/${report.id}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer esto-no-es-un-token' },
      body: JSON.stringify({ response: 'confirm', location: observation(0) }),
    });
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual({ error: 'Credenciales inválidas' });

    const revokedUser = citizen(organizationId);
    store.revoke(revokedUser.sid, revokedUser.user.id);
    const revoked = await sendResponse(report.id, revokedUser.token, 'question', 0);
    expect(revoked.status).toBe(401);
    expect(await revoked.json()).toEqual({ error: 'Sesión inválida' });
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 0, question: 0 });
  });

  it('rejects users who are not allowed to respond to the report', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const cases: { token: string; error: string }[] = [];

    const unassigned = openSession({ id: crypto.randomUUID(), email: 'sin-org@example.test', role: Role.Guest });
    cases.push({ token: unassigned.token, error: 'Tu usuario no tiene un organismo asignado' });

    const otherOrganization = citizen(crypto.randomUUID());
    cases.push({ token: otherOrganization.token, error: 'No tienes acceso a este reporte' });

    cases.push({ token: report.owner.token, error: 'No puedes responder a tu propio reporte' });

    const reviewer = openSession({
      id: crypto.randomUUID(),
      email: 'qa@example.test',
      role: Role.QA,
      organizationId,
    });
    cases.push({ token: reviewer.token, error: 'Solo los ciudadanos pueden confirmar o cuestionar reportes' });

    for (const entry of cases) {
      const response = await sendResponse(report.id, entry.token, 'confirm', 0);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: entry.error });
    }
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 0, question: 0 });
  });

  it('returns 404 for a report that does not exist and 409 once it no longer accepts responses', async () => {
    const organizationId = crypto.randomUUID();
    const actor = citizen(organizationId);
    const missingId = crypto.randomUUID();
    const missing = await sendResponse(missingId, actor.token, 'confirm', 0);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Reporte no encontrado' });
    expect(await ReportResponse.find(missingId, actor.user.id)).toBeNull();

    const report = await createReport(organizationId);
    const stored = await Report.findByPk(report.id);
    await stored?.update({ status: 'validated' });
    const closed = await sendResponse(report.id, actor.token, 'question', 0);
    expect(closed.status).toBe(409);
    expect(await closed.json()).toEqual({ error: 'El reporte ya no acepta respuestas' });
    expect(await ReportResponse.counts(report.id)).toEqual({ confirm: 0, question: 0 });
  });

  it('rejects a response payload with an invalid sense or a forged identity', async () => {
    const organizationId = crypto.randomUUID();
    const report = await createReport(organizationId);
    const actor = citizen(organizationId);

    const invalid = await sendResponse(report.id, actor.token, 'approve', 0, {}, { userId: 'forjado' });
    expect(invalid.status).toBe(400);
    const body = await invalid.json() as { error: string; fields: Record<string, string> };
    expect(body.error).toBe('Respuesta no válida');
    expect(body.fields.response).toBe('La respuesta debe ser confirm o question');
    expect(body.fields.userId).toBe('Campo no permitido');
    expect(await ReportResponse.find(report.id, actor.user.id)).toBeNull();
    expect(await ReportResponse.find(report.id, 'forjado')).toBeNull();
  });
});
