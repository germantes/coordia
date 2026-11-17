import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { Role } from '../src/constants/roles.js';
import { ReportStore } from '../src/models/report.js';
import {
  AgencyCatalog,
  INCIDENT_ROUTING_RULES,
  isDaytimeWorkingHours,
  nextWorkingWindowStart,
  resolveIncidentRouting,
} from '../src/models/recipient-matrix.js';
import { ReportDistribution } from '../src/models/report-distribution.js';

describe('HU-07 · T2 — Catálogo de organismos, matriz de destinatarios, cola horaria y entregas con reintentos', () => {
  beforeEach(() => {
    ReportDistribution.reset();
  });

  describe('1. AgencyCatalog y Matriz de Destinatarios (Málaga)', () => {
    it('expone todos los organismos separados con IDs territoriales explícitos', () => {
      const ids = AgencyCatalog.ids();
      expect(ids).toEqual(
        expect.arrayContaining([
          '112-andalucia',
          'infoca-andalucia',
          '061-andalucia',
          'bomberos-malaga',
          'policia-local-malaga',
          'policia-nacional-malaga',
          'guardia-civil-trafico-malaga',
          'proteccion-civil-malaga',
          'urbanismo-malaga',
          'emasa-malaga',
          'movilidad-malaga',
          'limasam-malaga',
          'parques-jardines-malaga',
        ]),
      );

      expect(AgencyCatalog.bySchedule('24/7')).toHaveLength(8);
      expect(AgencyCatalog.bySchedule('daytime')).toHaveLength(5);
      expect(AgencyCatalog.get('bomberos-malaga')?.schedule).toBe('24/7');
      expect(AgencyCatalog.get('emasa-malaga')?.fallback24x7).toBe('bomberos-malaga');
      expect(AgencyCatalog.get('limasam-malaga')?.fallback24x7).toBe('policia-local-malaga');
    });

    it('distingue incidentes concretos dentro de safety e infrastructure según la matriz documental', () => {
      const urbanFire = resolveIncidentRouting('safety', { description: 'Incendio en vivienda del centro histórico' });
      expect(urbanFire.incidentType).toBe('urban_fire');
      expect(urbanFire.primary).toBe('bomberos-malaga');
      expect(urbanFire.secondary).toEqual(['112-andalucia', 'policia-local-malaga', '061-andalucia']);

      const forestFire = resolveIncidentRouting('safety', { description: 'Conato de incendio forestal en Montes de Málaga' });
      expect(forestFire.incidentType).toBe('forest_fire');
      expect(forestFire.primary).toBe('112-andalucia');
      expect(forestFire.secondary).toContain('infoca-andalucia');
      expect(forestFire.secondary).toContain('guardia-civil-trafico-malaga');

      const highwayAccident = resolveIncidentRouting('safety', { description: 'Colisión múltiple en ronda MA-20' });
      expect(highwayAccident.incidentType).toBe('highway_traffic_accident');
      expect(highwayAccident.secondary).toContain('guardia-civil-trafico-malaga');

      const medical = resolveIncidentRouting('safety', { description: 'Persona inconsciente en la vía pública, emergencia sanitaria' });
      expect(medical.incidentType).toBe('medical_emergency');
      expect(medical.primary).toBe('061-andalucia');

      const crime = resolveIncidentRouting('safety', { description: 'Agresión y robo con violencia en vía pública' });
      expect(crime.incidentType).toBe('public_security_crime');
      expect(crime.primary).toBe('policia-nacional-malaga');

      const collapse = resolveIncidentRouting('infrastructure', { description: 'Derrumbe parcial de fachada en calle Larios' });
      expect(collapse.incidentType).toBe('structural_collapse');
      expect(collapse.primary).toBe('bomberos-malaga');
      expect(collapse.secondary).toContain('urbanismo-malaga');

      const waterBreak = resolveIncidentRouting('infrastructure', { description: 'Avería y rotura en tubería de agua potable' });
      expect(waterBreak.incidentType).toBe('water_network_break');
      expect(waterBreak.primary).toBe('emasa-malaga');

      expect(INCIDENT_ROUTING_RULES.road_tree_obstacle.secondary).toEqual([
        'limasam-malaga',
        'parques-jardines-malaga',
        'movilidad-malaga',
      ]);
    });
  });

  describe('2. Régimen Horario (08:00–15:00 L-V vs 24/7) y Cola Diferida', () => {
    it('despacha inmediatamente en horario laboral y encola organismos diurnos fuera de horario o en fin de semana', () => {
      expect(isDaytimeWorkingHours('2026-11-17T10:30:00Z')).toBe(true);
      expect(isDaytimeWorkingHours('2026-11-17T22:30:00Z')).toBe(false);
      expect(isDaytimeWorkingHours('2026-11-15T11:00:00Z')).toBe(false); // Domingo

      // Sábado por la noche -> próximo laborable es Lunes 08:00 Europe/Madrid (07:00 UTC en horario de invierno)
      expect(nextWorkingWindowStart('2026-11-14T23:15:00Z')).toBe('2026-11-16T07:00:00.000Z');

      const nightSummary = ReportDistribution.distributeNewReport({
        reportId: 'rep-night-accessibility',
        category: 'accessibility',
        description: 'Rama caída obstaculizando la acera y el carril',
        location: { latitude: 36.7213, longitude: -4.4214 },
        createdAt: '2026-11-15T23:10:00Z',
        urgent: false,
      });

      const primaryDelivery = nightSummary.deliveries.find((d) => d.agencyId === 'policia-local-malaga');
      expect(primaryDelivery?.status).toBe('delivered');
      expect(ReportDistribution.inbox('policia-local-malaga', { reportId: 'rep-night-accessibility' })).toHaveLength(1);

      const queuedDeliveries = nightSummary.deliveries.filter((d) => d.status === 'queued');
      expect(queuedDeliveries.map((d) => d.agencyId)).toEqual([
        'limasam-malaga',
        'parques-jardines-malaga',
        'movilidad-malaga',
      ]);
      for (const queued of queuedDeliveries) {
        expect(queued.scheduledFor).toBe('2026-11-16T07:00:00.000Z');
        expect(ReportDistribution.inbox(queued.agencyId, { reportId: 'rep-night-accessibility' })).toHaveLength(0);
      }

      // Al llegar el lunes a las 08:00 Europe/Madrid (07:00 UTC) se procesa la cola diferida y cada organismo diurno recibe su aviso en bandeja
      const processed = ReportDistribution.processDueQueue('2026-11-16T07:00:00Z');
      expect(processed).toHaveLength(3);
      expect(processed.every((d) => d.status === 'delivered')).toBe(true);
      expect(ReportDistribution.inbox('limasam-malaga', { reportId: 'rep-night-accessibility' })).toHaveLength(1);
      expect(ReportDistribution.inbox('parques-jardines-malaga', { reportId: 'rep-night-accessibility' })).toHaveLength(1);
      expect(ReportDistribution.inbox('movilidad-malaga', { reportId: 'rep-night-accessibility' })).toHaveLength(1);
    });

    it('redirige inmediatamente al retén 24/7 cuando entra una urgencia en categoría diurna fuera de horario', () => {
      const dispatch = AgencyCatalog.resolveDispatchTarget('emasa-malaga', {
        timestamp: '2026-11-15T23:30:00Z',
        urgent: true,
        category: 'infrastructure',
      });
      expect(dispatch.immediate).toBe(true);
      expect(dispatch.redirectedTo24x7).toBe(true);
      expect(dispatch.targetAgencyId).toBe('bomberos-malaga');
    });
  });

  describe('3. Tratamiento de Urgencias No Verificadas (Filtros, Duplicados, Confirmación, Refutación y Timeout 10 min)', () => {
    it('aplica filtro de precisión GPS (< 50 m) y admite selección manual dentro del término de Málaga', () => {
      const rejectedGps = ReportDistribution.distributeNewReport({
        reportId: 'rep-bad-gps',
        category: 'safety',
        description: 'Incendio urbano en contenedor junto a edificio',
        location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 65 },
        createdAt: '2026-11-16T10:00:00Z',
      });
      expect(rejectedGps.admission?.admitted).toBe(false);
      expect(rejectedGps.deliveries).toHaveLength(0);

      const acceptedManual = ReportDistribution.distributeNewReport({
        reportId: 'rep-manual-malaga',
        category: 'safety',
        description: 'Incendio urbano en contenedor junto a edificio',
        location: { latitude: 36.7213, longitude: -4.4214, source: 'manual' },
        createdAt: '2026-11-16T10:01:00Z',
      });
      expect(acceptedManual.admission?.admitted).toBe(true);
      expect(acceptedManual.urgentState).toBe('pre_alert_active');
      expect(acceptedManual.deliveries.every((d) => d.role === 'pre_alert')).toBe(true);
    });

    it('vincula duplicados a < 150 m en los últimos 20 minutos sin emitir prealertas duplicadas', () => {
      const first = ReportDistribution.distributeNewReport({
        reportId: 'rep-open-1',
        category: 'safety',
        description: 'Incendio urbano en local comercial',
        location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 18 },
        createdAt: '2026-11-16T10:00:00Z',
      });
      expect(first.deliveries.length).toBeGreaterThan(0);

      const second = ReportDistribution.distributeNewReport({
        reportId: 'rep-dup-2',
        category: 'safety',
        description: 'Humo y fuego en el mismo local comercial',
        location: { latitude: 36.7216, longitude: -4.4215, source: 'gps', accuracyMeters: 20 },
        createdAt: '2026-11-16T10:08:00Z',
      });
      expect(second.linkedToReportId).toBe('rep-open-1');
      expect(second.deliveries).toHaveLength(0);
    });

    it('completa el despacho secundario al confirmarse (2 ciudadanos o 1 institucional) y pasa a revisión manual a los 10 min sin anularse', () => {
      const summary = ReportDistribution.distributeNewReport({
        reportId: 'rep-forest-1',
        category: 'safety',
        description: 'Incendio forestal en Gibralfaro',
        location: { latitude: 36.7235, longitude: -4.4095, source: 'gps', accuracyMeters: 15 },
        createdAt: '2026-11-16T12:00:00Z',
      });
      expect(summary.fastTrackRadiusMeters).toBe(1000);
      expect(summary.secondaryDispatched).toBe(false);

      const afterTenMin = ReportDistribution.checkManualReviewTimeout('rep-forest-1', '2026-11-16T12:11:00Z');
      expect(afterTenMin?.urgentState).toBe('pending_manual_review');
      expect(afterTenMin?.deliveries.every((d) => d.status === 'delivered')).toBe(true);

      const confirmed = ReportDistribution.recordVerificationSignal({
        reportId: 'rep-forest-1',
        citizenConfirmations: 2,
        now: '2026-11-16T12:12:00Z',
      });
      expect(confirmed?.urgentState).toBe('confirmed');
      expect(confirmed?.secondaryDispatched).toBe(true);
      const notifiedAgencies = confirmed!.deliveries.map((d) => d.agencyId);
      expect(notifiedAgencies).toEqual(
        expect.arrayContaining([
          '112-andalucia',
          'infoca-andalucia',
          'bomberos-malaga',
          'policia-local-malaga',
          'guardia-civil-trafico-malaga',
        ]),
      );
    });

    it('emite aviso inmediato de cancelación a los centros notificados cuando se refuta una urgencia', () => {
      ReportDistribution.distributeNewReport({
        reportId: 'rep-false-alarm',
        category: 'safety',
        description: 'Incendio urbano en calle Larios',
        location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 12 },
        createdAt: '2026-11-16T14:00:00Z',
      });

      const refuted = ReportDistribution.recordVerificationSignal({
        reportId: 'rep-false-alarm',
        citizenRejections: 2,
        now: '2026-11-16T14:03:00Z',
      });
      expect(refuted?.urgentState).toBe('refuted');
      const cancellations = refuted!.deliveries.filter((d) => d.role === 'cancellation');
      expect(cancellations.length).toBeGreaterThan(0);
      expect(cancellations.every((d) => d.status === 'delivered')).toBe(true);
    });
  });

  describe('4. CA-2 y CA-4: Bandeja del organismo receptor, persistencia SQLite tras reinicio e integración HTTP', () => {
    const authStore = new AuthStore(':memory:');
    const reportStore = new ReportStore(':memory:');
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      await new Promise<void>((resolve) => {
        server = createServer(authStore, reportStore).listen(0, '127.0.0.1', () => {
          const address = server.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      reportStore.close();
      authStore.close();
    });

    beforeEach(() => {
      reportStore.distribution.reset();
    });

    function tokenFor(role: Role, id: string, organizationId = 'policia-local-malaga') {
      const user = { id, email: `${id}@coordia.test`, role, organizationId };
      const session = authStore.createSession(user);
      return issueAccessToken(session.sid, user);
    }

    it('CA-2: crea un reporte y comprueba que el organismo receptor recibe, consulta y acusa recibo del aviso en su bandeja', async () => {
      const citizenToken = tokenFor(Role.Guest, 'citizen-ca2', 'bomberos-malaga');
      const createRes = await fetch(`${baseUrl}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` },
        body: JSON.stringify({
          category: 'safety',
          description: 'Incendio urbano activo en portal de viviendas de calle Larios',
          location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 12 },
        }),
      });
      expect(createRes.status).toBe(201);
      const createdReport = await createRes.json() as { id: string; urgent: boolean; status: string };
      expect(createdReport.urgent).toBe(true);

      // El operador de Bomberos de Málaga consulta su bandeja y observa el aviso con el id del incidente
      const bomberosOperatorToken = tokenFor(Role.QA, 'qa-bomberos', 'bomberos-malaga');
      const inboxRes = await fetch(`${baseUrl}/api/reports/inbox?reportId=${createdReport.id}`, {
        headers: { Authorization: `Bearer ${bomberosOperatorToken}` },
      });
      expect(inboxRes.status).toBe(200);
      const inboxBody = await inboxRes.json() as {
        agencyId: string;
        entries: Array<{
          deliveryId: string;
          agencyId: string;
          reportId: string;
          role: string;
          receivedAt: string;
          acknowledgedAt?: string;
          payload: { incidentType: string; urgent: boolean };
        }>;
      };
      expect(inboxBody.agencyId).toBe('bomberos-malaga');
      expect(inboxBody.entries).toHaveLength(1);
      expect(inboxBody.entries[0]).toMatchObject({
        agencyId: 'bomberos-malaga',
        reportId: createdReport.id,
        role: 'pre_alert',
        payload: { incidentType: 'urban_fire', urgent: true },
      });

      // El operador de Bomberos acusa recibo del aviso de forma idempotente
      const deliveryId = inboxBody.entries[0].deliveryId;
      const ackRes = await fetch(`${baseUrl}/api/reports/inbox/${deliveryId}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bomberosOperatorToken}` },
      });
      expect(ackRes.status).toBe(200);
      const ackBody = await ackRes.json() as { deliveryId: string; acknowledgedBy: string; acknowledgedAt: string };
      expect(ackBody.deliveryId).toBe(deliveryId);
      expect(ackBody.acknowledgedBy).toBe('qa-bomberos');

      // Otro organismo no autorizado no puede leer la bandeja de Bomberos
      const emasaOperatorToken = tokenFor(Role.QA, 'qa-emasa', 'emasa-malaga');
      const forbiddenRes = await fetch(`${baseUrl}/api/reports/inbox/bomberos-malaga`, {
        headers: { Authorization: `Bearer ${emasaOperatorToken}` },
      });
      expect(forbiddenRes.status).toBe(403);

      // Al validarse el reporte en ReportStore, el organismo secundario (061-andalucia) recibe el despacho en su bandeja
      const patchRes = await fetch(`${baseUrl}/api/reports/${createdReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bomberosOperatorToken}` },
        body: JSON.stringify({ status: 'validated' }),
      });
      expect(patchRes.status).toBe(200);

      const sasOperatorToken = tokenFor(Role.QA, 'qa-061', '061-andalucia');
      const sasInboxRes = await fetch(`${baseUrl}/api/reports/inbox?reportId=${createdReport.id}`, {
        headers: { Authorization: `Bearer ${sasOperatorToken}` },
      });
      expect(sasInboxRes.status).toBe(200);
      const sasInbox = await sasInboxRes.json() as { entries: Array<{ reportId: string; agencyId: string; role: string }> };
      expect(sasInbox.entries).toEqual([
        expect.objectContaining({
          reportId: createdReport.id,
          agencyId: '061-andalucia',
          role: 'secondary',
        }),
      ]);
    });

    it('registra fallos de entrega, permite reintentar por API y deposita el aviso en la bandeja tras el reintento', async () => {
      reportStore.distribution.setSimulatedFailure('bomberos-malaga', 'Timeout en pasarela de Bomberos');

      const guestToken = tokenFor(Role.Guest, 'citizen-hu07');
      const createRes = await fetch(`${baseUrl}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guestToken}` },
        body: JSON.stringify({
          category: 'safety',
          description: 'Incendio urbano activo en portal de viviendas',
          location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 15 },
        }),
      });
      expect(createRes.status).toBe(201);
      const createdReport = await createRes.json() as { id: string; urgent: boolean; status: string };

      // Mientras está en retry_pending, Bomberos aún no tiene el aviso en su bandeja
      expect(reportStore.distribution.inbox('bomberos-malaga', { reportId: createdReport.id })).toHaveLength(0);

      const deliveriesRes = await fetch(`${baseUrl}/api/reports/${createdReport.id}/deliveries`, {
        headers: { Authorization: `Bearer ${guestToken}` },
      });
      expect(deliveriesRes.status).toBe(200);
      const summary = await deliveriesRes.json() as {
        deliveries: Array<{ id: string; agencyId: string; status: string; attempts: number; lastError?: string }>;
      };

      const bomberosDelivery = summary.deliveries.find((d) => d.agencyId === 'bomberos-malaga');
      expect(bomberosDelivery).toMatchObject({
        agencyId: 'bomberos-malaga',
        status: 'retry_pending',
        attempts: 1,
        lastError: 'Timeout en pasarela de Bomberos',
      });

      // Se restablece el servicio de Bomberos y el admin reintenta por API
      reportStore.distribution.clearSimulatedFailure('bomberos-malaga');
      const adminToken = tokenFor(Role.Admin, 'admin-hu07');
      const retryRes = await fetch(`${baseUrl}/api/reports/${createdReport.id}/deliveries/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(retryRes.status).toBe(200);
      const retryBody = await retryRes.json() as {
        retriedCount: number;
        deliveries: Array<{ agencyId: string; status: string; attempts: number }>;
      };
      expect(retryBody.retriedCount).toBe(1);
      expect(retryBody.deliveries.find((d) => d.agencyId === 'bomberos-malaga')).toMatchObject({
        status: 'delivered',
        attempts: 2,
      });
      expect(reportStore.distribution.inbox('bomberos-malaga', { reportId: createdReport.id })).toHaveLength(1);
    });

    it('CA-4: persiste entregas y cola en SQLite y, tras reabrir ReportStore, completa un reintento pendiente sin duplicar entregas ya confirmadas', () => {
      const dir = mkdtempSync(join(tmpdir(), 'coordia-hu07-persistence-'));
      const dbPath = join(dir, 'reports.sqlite');
      let persistentStore = new ReportStore(dbPath);

      try {
        // Fallo simulado solo en Bomberos; 112 y Policía Local confirman en el primer intento
        persistentStore.distribution.setSimulatedFailure('bomberos-malaga', 'Caída temporal de red');
        const created = persistentStore.create({
          category: 'safety',
          description: 'Incendio urbano en bloque de viviendas de Málaga',
          location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 14 },
          ownerId: 'citizen-persist',
          organizationId: 'policia-local-malaga',
          status: 'pending',
          urgent: true,
          createdAt: '2026-11-16T10:00:00.000Z',
        });

        const beforeRestart = persistentStore.distribution.listDeliveriesForReport(created.id);
        expect(beforeRestart).toHaveLength(3);
        expect(beforeRestart.find((d) => d.agencyId === '112-andalucia')).toMatchObject({
          status: 'delivered',
          attempts: 1,
        });
        expect(beforeRestart.find((d) => d.agencyId === 'policia-local-malaga')).toMatchObject({
          status: 'delivered',
          attempts: 1,
        });
        const pendingBomberos = beforeRestart.find((d) => d.agencyId === 'bomberos-malaga')!;
        expect(pendingBomberos).toMatchObject({
          status: 'retry_pending',
          attempts: 1,
        });

        // Simulamos reinicio del proceso cerrando y reabriendo la base SQLite
        persistentStore.close();
        persistentStore = new ReportStore(dbPath);

        // El reporte, el historial de entregas y las bandejas confirmadas siguen intactos en SQLite
        expect(persistentStore.findByPk(created.id)?.id).toBe(created.id);
        expect(persistentStore.distribution.inbox('112-andalucia', { reportId: created.id })).toHaveLength(1);
        expect(persistentStore.distribution.inbox('policia-local-malaga', { reportId: created.id })).toHaveLength(1);
        expect(persistentStore.distribution.inbox('bomberos-malaga', { reportId: created.id })).toHaveLength(0);

        // Al completar el reintento pendiente tras reabrir: Bomberos pasa a delivered y no se duplican las entregas ya confirmadas
        const retried = persistentStore.distribution.retryPendingDeliveries({
          reportId: created.id,
          now: '2026-11-16T10:02:00.000Z',
        });
        expect(retried).toHaveLength(1);
        expect(retried[0]).toMatchObject({
          id: pendingBomberos.id,
          agencyId: 'bomberos-malaga',
          status: 'delivered',
          attempts: 2,
        });

        // Reintentar de nuevo una entrega ya confirmada o re-distribuir el mismo reporte es idempotente
        persistentStore.distribution.retryDelivery(pendingBomberos.id, '2026-11-16T10:03:00.000Z');
        persistentStore.distribution.distributeNewReport({
          reportId: created.id,
          category: 'safety',
          description: 'Incendio urbano en bloque de viviendas de Málaga',
          location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 14 },
          createdAt: '2026-11-16T10:00:00.000Z',
          urgent: true,
        });

        const afterRetry = persistentStore.distribution.listDeliveriesForReport(created.id);
        expect(afterRetry).toHaveLength(3);
        expect(afterRetry.find((d) => d.agencyId === '112-andalucia')?.attempts).toBe(1);
        expect(afterRetry.find((d) => d.agencyId === 'policia-local-malaga')?.attempts).toBe(1);
        expect(afterRetry.find((d) => d.agencyId === 'bomberos-malaga')?.attempts).toBe(2);
        expect(persistentStore.distribution.inbox('112-andalucia', { reportId: created.id })).toHaveLength(1);
        expect(persistentStore.distribution.inbox('policia-local-malaga', { reportId: created.id })).toHaveLength(1);
        expect(persistentStore.distribution.inbox('bomberos-malaga', { reportId: created.id })).toHaveLength(1);
      } finally {
        persistentStore.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
