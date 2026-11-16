import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { createServer } from '../src/index.js';
import { issueAccessToken } from '../src/routes/auth.js';
import { Role } from '../src/constants/roles.js';
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

      // Sábado por la noche -> próximo laborable es Lunes 08:00 Europe/Madrid (07:00 UTC en noviembre)
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

      const queuedDeliveries = nightSummary.deliveries.filter((d) => d.status === 'queued');
      expect(queuedDeliveries.map((d) => d.agencyId)).toEqual([
        'limasam-malaga',
        'parques-jardines-malaga',
        'movilidad-malaga',
      ]);
      for (const queued of queuedDeliveries) {
        expect(queued.scheduledFor).toBe('2026-11-16T07:00:00.000Z');
      }

      // Al llegar el lunes a las 08:00 se procesa la cola diferida sin pérdidas
      const processed = ReportDistribution.processDueQueue('2026-11-16T07:00:00Z');
      expect(processed).toHaveLength(3);
      expect(processed.every((d) => d.status === 'delivered')).toBe(true);
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

      // Tras 10 minutos sin confirmación: pasa a pending_manual_review sin cancelar la prealerta
      const afterTenMin = ReportDistribution.checkManualReviewTimeout('rep-forest-1', '2026-11-16T12:11:00Z');
      expect(afterTenMin?.urgentState).toBe('pending_manual_review');
      expect(afterTenMin?.deliveries.every((d) => d.status === 'delivered')).toBe(true);

      // Al recibir 2 confirmaciones ciudadanas: se confirma y se despachan todos los secundarios (Bomberos, Guardia Civil)
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

  describe('4. Registro de entrega con reintentos e integración en rutas HTTP', () => {
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

    function tokenFor(role: Role, id: string, organizationId = 'policia-local-malaga') {
      const user = { id, email: `${id}@coordia.test`, role, organizationId };
      const session = authStore.createSession(user);
      return issueAccessToken(session.sid, user);
    }

    it('registra fallos de entrega, permite reintentar por API y agota maxAttempts tras 3 fallos', async () => {
      ReportDistribution.setSimulatedFailure('bomberos-malaga', 'Timeout en pasarela de Bomberos');

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
      expect(createdReport.urgent).toBe(true);
      expect(createdReport.status).toBe('pending');

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

      // Se restablece el servicio de Bomberos y el admin o QA reintenta por API
      ReportDistribution.clearSimulatedFailure('bomberos-malaga');
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
    });

    it('mantiene una única entrega por organismo y procesa automáticamente el reintento programado', () => {
      ReportDistribution.setSimulatedFailure('bomberos-malaga', 'Pasarela temporalmente no disponible');
      const first = ReportDistribution.distributeNewReport({
        reportId: 'rep-idempotent-retry',
        category: 'safety',
        description: 'Incendio urbano activo en edificio residencial',
        location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 15 },
        createdAt: '2026-11-16T10:00:00Z',
      });
      const second = ReportDistribution.distributeNewReport({
        reportId: 'rep-idempotent-retry',
        category: 'safety',
        description: 'Incendio urbano activo en edificio residencial',
        location: { latitude: 36.7213, longitude: -4.4214, source: 'gps', accuracyMeters: 15 },
        createdAt: '2026-11-16T10:00:00Z',
      });
      expect(second.deliveries).toHaveLength(first.deliveries.length);
      expect(new Set(second.deliveries.map((delivery) => delivery.id)).size).toBe(first.deliveries.length);

      const failedDelivery = second.deliveries.find((delivery) => delivery.agencyId === 'bomberos-malaga');
      expect(failedDelivery).toMatchObject({ status: 'retry_pending', attempts: 1 });

      ReportDistribution.clearSimulatedFailure('bomberos-malaga');
      const processed = ReportDistribution.processDueQueue(failedDelivery!.nextRetryAt!);
      expect(processed).toHaveLength(1);
      expect(processed[0]).toMatchObject({ id: failedDelivery!.id, status: 'delivered', attempts: 2 });
      expect(ReportDistribution.processDueQueue(failedDelivery!.nextRetryAt!)).toHaveLength(0);
    });
  });
});
