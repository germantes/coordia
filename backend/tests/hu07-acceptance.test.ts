import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { Role } from '../src/constants/roles.js';
import { ReportStore } from '../src/models/report.js';
import type { User } from '../types/user.js';
import { DEFAULT_MAX_DELIVERY_ATTEMPTS } from '../src/models/report-distribution.js';

// HU-07 T3: destinatarios, aviso identificable, horario no laboral, reintentos
// y duplicados. El enrutamiento usa categoría y descripción; las coordenadas
// validan el término de Málaga y la precisión GPS, no el tipo de vía.

const MALAGA = { latitude: 36.7213, longitude: -4.4214 };
const NIGHT = '2026-11-15T22:30:00Z';
const NEXT_WINDOW = '2026-11-16T07:00:00.000Z';

let authStore: AuthStore;
let reportStore: ReportStore;
let server: Server;
let base: string;

beforeEach(async () => {
  authStore = new AuthStore(':memory:');
  reportStore = new ReportStore(':memory:');
  server = createServer(authStore, reportStore).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  reportStore.distribution.stopScheduler();
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  reportStore.close();
  authStore.close();
});

function tokenFor(role: Role, id: string, organizationId = 'bomberos-malaga') {
  const user: User = { id, email: `${id}@example.test`, role, organizationId };
  const session = authStore.createSession(user);
  return issueAccessToken(session.sid, user);
}

function post(path: string, token: string | null, body: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function json<T>(response: Response) {
  return await response.json() as T;
}

interface Delivery {
  id: string;
  agencyId: string;
  role: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  scheduledFor?: string;
  redirectedTo24x7?: boolean;
  lastError?: string;
  payload: {
    reportId: string;
    category: string;
    incidentType: string;
    criticality: string;
    urgent: boolean;
    timestamp: string;
  };
}

interface Summary {
  reportId: string;
  incidentType: string;
  criticality: string;
  urgent: boolean;
  urgentState?: string;
  linkedToReportId?: string;
  secondaryDispatched: boolean;
  admission?: { admitted: boolean; message?: string; duplicateOfReportId?: string };
  deliveries: Delivery[];
}

interface Inbox {
  agencyId: string;
  entries: Array<{
    deliveryId: string;
    reportId: string;
    agencyId: string;
    role: string;
    payload: Delivery['payload'];
  }>;
}

async function createReport(token: string, body: Record<string, unknown>) {
  const response = await post('/api/reports', token, body);
  expect(response.status).toBe(201);
  return await json<{ id: string; urgent: boolean; status: string }>(response);
}

function deliveriesOf(summary: Summary, agencyId: string) {
  return summary.deliveries.filter((delivery) => delivery.agencyId === agencyId);
}

describe('HU-07 acceptance: notify the competent agencies', () => {
  it('CA-1 routes by category, description, severity and verification', async () => {
    const author = tokenFor(Role.Guest, 'citizen-fire', 'bomberos-malaga');
    const fire = await createReport(author, {
      category: 'safety',
      description: 'Incendio urbano activo en un portal de viviendas',
      location: { ...MALAGA, source: 'gps', accuracyMeters: 12 },
      occurredAt: '2026-11-17T10:00:00Z',
    });
    const fireSummary = await json<Summary>(await fetch(`${base}/api/reports/${fire.id}/deliveries`, {
      headers: { Authorization: `Bearer ${author}` },
    }));

    expect(fire.urgent).toBe(true);
    expect(fireSummary).toMatchObject({
      incidentType: 'urban_fire',
      criticality: 'critical',
      urgent: true,
      urgentState: 'pre_alert_active',
      secondaryDispatched: false,
    });
    expect(fireSummary.deliveries.map((delivery) => delivery.agencyId).sort()).toEqual([
      '112-andalucia', 'bomberos-malaga', 'policia-local-malaga',
    ]);
    expect(fireSummary.deliveries.every((delivery) => delivery.role === 'pre_alert' && delivery.status === 'delivered')).toBe(true);

    const reviewer = tokenFor(Role.QA, 'qa-bomberos', 'bomberos-malaga');
    const validated = await fetch(`${base}/api/reports/${fire.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reviewer}` },
      body: JSON.stringify({ status: 'validated' }),
    });
    expect(validated.status).toBe(200);
    const verified = await json<Summary>(await fetch(`${base}/api/reports/${fire.id}/deliveries`, {
      headers: { Authorization: `Bearer ${author}` },
    }));
    expect(verified.urgentState).toBe('confirmed');
    expect(verified.secondaryDispatched).toBe(true);
    expect(deliveriesOf(verified, '061-andalucia')).toEqual([
      expect.objectContaining({ role: 'secondary', status: 'delivered' }),
    ]);

    const waterAuthor = tokenFor(Role.Guest, 'citizen-water', 'emasa-malaga');
    const water = await createReport(waterAuthor, {
      category: 'infrastructure',
      description: 'Rotura grave de la red de agua en la calzada',
      location: { ...MALAGA, source: 'manual' },
      urgent: false,
      occurredAt: '2026-11-17T11:00:00Z',
    });
    const waterSummary = await json<Summary>(await fetch(`${base}/api/reports/${water.id}/deliveries`, {
      headers: { Authorization: `Bearer ${waterAuthor}` },
    }));
    expect(water.urgent).toBe(false);
    expect(waterSummary).toMatchObject({ incidentType: 'water_network_break', criticality: 'medium', urgent: false });
    expect(deliveriesOf(waterSummary, 'emasa-malaga')).toEqual([
      expect.objectContaining({ role: 'primary', status: 'delivered' }),
    ]);
    expect(deliveriesOf(waterSummary, 'policia-local-malaga')).toEqual([
      expect.objectContaining({ role: 'secondary', status: 'delivered' }),
    ]);
  });

  it('CA-1 rejects an urgent notice outside Málaga or with an imprecise GPS fix', async () => {
    const author = tokenFor(Role.Guest, 'citizen-bounds', 'bomberos-malaga');
    const outside = await createReport(author, {
      category: 'safety',
      description: 'Incendio urbano fuera del término municipal',
      location: { latitude: 40.4168, longitude: -3.7038, source: 'manual' },
      occurredAt: '2026-11-17T09:00:00Z',
    });
    const outsideSummary = await json<Summary>(await fetch(`${base}/api/reports/${outside.id}/deliveries`, {
      headers: { Authorization: `Bearer ${author}` },
    }));
    expect(outsideSummary.admission).toMatchObject({
      admitted: false,
      message: 'Las coordenadas deben pertenecer al término municipal de Málaga',
    });
    expect(outsideSummary.deliveries).toEqual([]);

    const imprecise = await createReport(author, {
      category: 'safety',
      description: 'Incendio urbano con GPS demasiado impreciso',
      location: { ...MALAGA, source: 'gps', accuracyMeters: 80 },
      occurredAt: '2026-11-17T09:20:00Z',
    });
    const impreciseSummary = await json<Summary>(await fetch(`${base}/api/reports/${imprecise.id}/deliveries`, {
      headers: { Authorization: `Bearer ${author}` },
    }));
    expect(impreciseSummary.admission).toMatchObject({
      admitted: false,
      message: 'La captura por GPS automático requiere una precisión estrictamente menor a 50 metros',
    });
    expect(impreciseSummary.deliveries).toEqual([]);
  });

  it('CA-2 gives each recipient a notice that identifies the incident and lets them open it', async () => {
    const author = tokenFor(Role.Guest, 'citizen-notice', 'bomberos-malaga');
    const report = await createReport(author, {
      category: 'safety',
      description: 'Incendio urbano activo en portal de viviendas de calle Larios',
      location: { ...MALAGA, source: 'gps', accuracyMeters: 12 },
      occurredAt: '2026-11-17T10:30:00Z',
    });
    const recipient = tokenFor(Role.QA, 'qa-bomberos-notice', 'bomberos-malaga');
    const inbox = await json<Inbox>(await fetch(`${base}/api/reports/inbox?reportId=${report.id}`, {
      headers: { Authorization: `Bearer ${recipient}` },
    }));

    expect(inbox.agencyId).toBe('bomberos-malaga');
    expect(inbox.entries).toHaveLength(1);
    expect(inbox.entries[0]).toMatchObject({
      reportId: report.id,
      agencyId: 'bomberos-malaga',
      role: 'pre_alert',
      payload: {
        reportId: report.id,
        category: 'safety',
        incidentType: 'urban_fire',
        urgent: true,
        timestamp: '2026-11-17T10:30:00.000Z',
      },
    });

    const detail = await fetch(`${base}/api/reports/${report.id}`, {
      headers: { Authorization: `Bearer ${recipient}` },
    });
    expect(detail.status).toBe(200);
    expect(await json(detail)).toMatchObject({
      id: report.id,
      category: 'safety',
      description: 'Incendio urbano activo en portal de viviendas de calle Larios',
    });

    const stranger = tokenFor(Role.QA, 'qa-emasa-notice', 'emasa-malaga');
    expect((await fetch(`${base}/api/reports/${report.id}`, {
      headers: { Authorization: `Bearer ${stranger}` },
    })).status).toBe(404);
    const foreignInbox = await fetch(`${base}/api/reports/inbox/bomberos-malaga`, {
      headers: { Authorization: `Bearer ${stranger}` },
    });
    expect(foreignInbox.status).toBe(403);
    expect(await json(foreignInbox)).toEqual({ error: 'No tienes permiso para consultar la bandeja de otro organismo' });
  });

  it('CA-3 keeps priority notices moving outside working hours and queues ordinary daytime services', async () => {
    const author = tokenFor(Role.Guest, 'citizen-hours', 'policia-local-malaga');
    const ordinary = await createReport(author, {
      category: 'accessibility',
      description: 'Rama caída obstaculizando la acera y el carril',
      location: { ...MALAGA, source: 'manual' },
      urgent: false,
      occurredAt: NIGHT,
    });
    const ordinarySummary = await json<Summary>(await fetch(`${base}/api/reports/${ordinary.id}/deliveries`, {
      headers: { Authorization: `Bearer ${author}` },
    }));
    expect(deliveriesOf(ordinarySummary, 'policia-local-malaga')).toEqual([
      expect.objectContaining({ status: 'delivered' }),
    ]);
    const queued = ordinarySummary.deliveries.filter((delivery) => delivery.status === 'queued');
    expect(queued.map((delivery) => delivery.agencyId).sort()).toEqual([
      'limasam-malaga', 'movilidad-malaga', 'parques-jardines-malaga',
    ]);
    expect(queued.every((delivery) => delivery.scheduledFor === NEXT_WINDOW)).toBe(true);
    for (const delivery of queued) {
      expect(reportStore.distribution.inbox(delivery.agencyId, { reportId: ordinary.id })).toHaveLength(0);
    }

    const admin = tokenFor(Role.Admin, 'admin-hours', 'bomberos-malaga');
    const processed = await json<{ processedCount: number }>(await post('/api/reports/queue/process', admin, { now: NEXT_WINDOW }));
    expect(processed.processedCount).toBe(3);
    for (const agencyId of ['limasam-malaga', 'movilidad-malaga', 'parques-jardines-malaga']) {
      expect(reportStore.distribution.inbox(agencyId, { reportId: ordinary.id })).toHaveLength(1);
    }

    const priorityAuthor = tokenFor(Role.Guest, 'citizen-priority', 'bomberos-malaga');
    const priority = await createReport(priorityAuthor, {
      category: 'infrastructure',
      description: 'Derrumbe de un balcón sobre la calzada',
      location: { ...MALAGA, source: 'gps', accuracyMeters: 18 },
      occurredAt: NIGHT,
    });
    const reviewer = tokenFor(Role.QA, 'qa-priority', 'bomberos-malaga');
    expect((await fetch(`${base}/api/reports/${priority.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reviewer}` },
      body: JSON.stringify({ status: 'validated' }),
    })).status).toBe(200);
    const prioritySummary = await json<Summary>(await fetch(`${base}/api/reports/${priority.id}/deliveries`, {
      headers: { Authorization: `Bearer ${priorityAuthor}` },
    }));
    expect(priority.urgent).toBe(true);
    expect(prioritySummary.deliveries.some((delivery) => delivery.status === 'queued')).toBe(false);
    expect(prioritySummary.deliveries.every((delivery) => delivery.status === 'delivered')).toBe(true);
    expect(deliveriesOf(prioritySummary, 'urbanismo-malaga')).toEqual([]);
    expect(deliveriesOf(prioritySummary, 'bomberos-malaga').length).toBe(1);
  });

  it('CA-4 records each attempt and stops retrying instead of notifying forever', async () => {
    reportStore.distribution.setSimulatedFailure('bomberos-malaga', 'Timeout en pasarela de Bomberos');
    const author = tokenFor(Role.Guest, 'citizen-retry', 'bomberos-malaga');
    const report = await createReport(author, {
      category: 'safety',
      description: 'Incendio urbano activo en portal de viviendas',
      location: { ...MALAGA, source: 'gps', accuracyMeters: 15 },
      occurredAt: '2026-11-17T12:00:00Z',
    });
    const before = await json<Summary>(await fetch(`${base}/api/reports/${report.id}/deliveries`, {
      headers: { Authorization: `Bearer ${author}` },
    }));
    expect(deliveriesOf(before, 'bomberos-malaga')).toEqual([
      expect.objectContaining({
        status: 'retry_pending',
        attempts: 1,
        maxAttempts: DEFAULT_MAX_DELIVERY_ATTEMPTS,
        lastError: 'Timeout en pasarela de Bomberos',
      }),
    ]);
    expect(reportStore.distribution.inbox('bomberos-malaga', { reportId: report.id })).toHaveLength(0);

    const admin = tokenFor(Role.Admin, 'admin-retry', 'bomberos-malaga');
    const retry = async () => json<{ retriedCount: number; deliveries: Delivery[] }>(
      await post(`/api/reports/${report.id}/deliveries/retry`, admin, {}),
    );
    const second = await retry();
    expect(second.retriedCount).toBe(1);
    expect(second.deliveries.filter((delivery) => delivery.agencyId === 'bomberos-malaga')).toEqual([
      expect.objectContaining({ status: 'retry_pending', attempts: 2 }),
    ]);

    const exhausted = await retry();
    expect(exhausted.deliveries.filter((delivery) => delivery.agencyId === 'bomberos-malaga')).toEqual([
      expect.objectContaining({ status: 'failed', attempts: DEFAULT_MAX_DELIVERY_ATTEMPTS }),
    ]);
    const stopped = await retry();
    expect(stopped.deliveries.filter((delivery) => delivery.agencyId === 'bomberos-malaga')).toEqual([
      expect.objectContaining({ status: 'failed', attempts: DEFAULT_MAX_DELIVERY_ATTEMPTS }),
    ]);
    expect(reportStore.distribution.inbox('bomberos-malaga', { reportId: report.id })).toHaveLength(0);
    expect(deliveriesOf(before, 'bomberos-malaga')).toHaveLength(1);
  });

  it('does not send a second notice for the same incident to the same agency', async () => {
    const author = tokenFor(Role.Guest, 'citizen-dup', 'bomberos-malaga');
    const first = await createReport(author, {
      category: 'safety',
      description: 'Incendio urbano en local comercial',
      location: { ...MALAGA, source: 'gps', accuracyMeters: 18 },
      occurredAt: '2026-11-16T10:00:00Z',
    });
    const second = await createReport(author, {
      category: 'safety',
      description: 'Humo y fuego en el mismo local comercial',
      location: { latitude: 36.7216, longitude: -4.4215, source: 'gps', accuracyMeters: 20 },
      occurredAt: '2026-11-16T10:08:00Z',
    });
    const duplicate = await json<Summary>(await fetch(`${base}/api/reports/${second.id}/deliveries`, {
      headers: { Authorization: `Bearer ${author}` },
    }));

    expect(duplicate.linkedToReportId).toBe(first.id);
    expect(duplicate.admission?.duplicateOfReportId).toBe(first.id);
    expect(duplicate.deliveries).toEqual([]);
    expect(reportStore.distribution.inbox('bomberos-malaga', { reportId: second.id })).toHaveLength(0);
    expect(reportStore.distribution.inbox('bomberos-malaga', { reportId: first.id })).toHaveLength(1);

    reportStore.distribution.setSimulatedFailure('112-andalucia', 'Pasarela no disponible');
    const recoverable = await createReport(author, {
      category: 'safety',
      description: 'Incendio urbano en otro barrio de Málaga',
      location: { latitude: 36.75, longitude: -4.45, source: 'gps', accuracyMeters: 10 },
      occurredAt: '2026-11-16T12:00:00Z',
    });
    reportStore.distribution.clearSimulatedFailure('112-andalucia');
    const admin = tokenFor(Role.Admin, 'admin-dup', 'bomberos-malaga');
    await post(`/api/reports/${recoverable.id}/deliveries/retry`, admin, {});
    await post(`/api/reports/${recoverable.id}/deliveries/retry`, admin, {});
    expect(reportStore.distribution.inbox('112-andalucia', { reportId: recoverable.id })).toHaveLength(1);
    expect(reportStore.distribution.listDeliveriesForReport(recoverable.id)
      .filter((delivery) => delivery.agencyId === '112-andalucia')).toHaveLength(1);
  });

  it('returns Spanish errors without echoing sensitive data', async () => {
    const citizen = tokenFor(Role.Guest, 'citizen-errors', 'bomberos-malaga');
    const secret = 'gho_super-secret-token';
    const rejected = await post('/api/reports', citizen, {
      category: 'safety',
      description: 'Incendio urbano con un campo que no debe ecoarse',
      location: { ...MALAGA, source: 'manual' },
      password: 'frase-secreta-de-prueba',
      accessToken: secret,
    });
    const rejectedBody = await json<Record<string, unknown>>(rejected);
    const rejectedText = JSON.stringify(rejectedBody);
    expect(rejected.status).toBe(400);
    expect(rejectedBody.error).toBe('Datos del reporte no válidos');
    expect(rejectedBody.fields).toMatchObject({
      password: 'Campo no permitido',
      accessToken: 'Campo no permitido',
    });
    expect(rejectedText).not.toContain('frase-secreta-de-prueba');
    expect(rejectedText).not.toContain(secret);

    const forbidden = await post('/api/reports/queue/process', citizen, {});
    expect(forbidden.status).toBe(403);
    expect(await json(forbidden)).toEqual({
      error: 'Solo un administrador puede procesar la cola diferida manualmente',
    });

    vi.spyOn(reportStore, 'create').mockImplementation(() => {
      throw new Error('detalle interno token=super-secret');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = await post('/api/reports', citizen, {
      category: 'safety',
      description: 'Incendio urbano que no debe filtrar el fallo interno',
      location: { ...MALAGA, source: 'manual' },
    });
    const failedBody = await json<Record<string, unknown>>(failed);
    const failedText = JSON.stringify(failedBody);
    expect(failed.status).toBe(500);
    expect(failedBody).toEqual({ error: 'Error interno del servidor' });
    expect(failedText).not.toContain('super-secret');
    expect(failedText).not.toContain('detalle interno');
  });
});
