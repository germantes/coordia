import { Router, Request, Response } from 'express';
import { ReportStore, type StoredReport } from '../models/report.js';
import { checkAbility, defineAbilityFor, subject } from '../middleware/ability.js';
import { Role } from '../constants/roles.js';
import type { User } from '../types/user.js';
import { REPORT_CATEGORIES, validateCreateReport } from '../validation/report.js';
import { proximityFactor, validRule } from '../models/confidence.js';
import { AgencyCatalog, INCIDENT_ROUTING_RULES, resolveIncidentRouting } from '../models/recipient-matrix.js';
import { isUrgentCriticality } from '../validation/urgent-report.js';
import {
  distanceBetweenMeters,
  getLocationQualityError,
  MAX_RESPONSE_DISTANCE_METERS,
  validateLocationObservation,
  validateSubmitReportResponse,
} from '../validation/report-response.js';

function requireCitizen(req: Request, res: Response) {
  const user = req.user;
  if (!user || user.id === 'guest') {
    res.status(401).json({ error: 'Inicia sesión para responder a reportes' });
    return null;
  }
  if (user.role !== Role.Guest) {
    res.status(403).json({ error: 'Solo los ciudadanos pueden confirmar o cuestionar reportes' });
    return null;
  }
  if (!user.organizationId) {
    res.status(403).json({ error: 'Tu usuario no tiene un organismo asignado' });
    return null;
  }
  return user;
}

// Permite lectura por ámbito de origen (CASL) o al organismo destinatario que recibió el aviso en su bandeja.
function canReadReport(store: ReportStore, user: User, report: StoredReport): boolean {
  if (defineAbilityFor(user).can('read', subject('Report', { ...report }) as never)) return true;
  if (user.role === Role.Guest || !user.organizationId) return false;
  if (user.role === Role.Dev && report.environment !== 'development') return false;
  return store.distribution.hasInboxEntry(user.organizationId, report.id);
}

export function reportsRouter(store: ReportStore) {
  const router = Router();

  // Catálogo identificado de organismos receptores y matriz de incidentes (HU-07).
  router.get('/catalog/agencies', (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Autenticación requerida' });
    return res.json({ agencies: AgencyCatalog.all(), rules: Object.values(INCIDENT_ROUTING_RULES) });
  });

  // Procesa envíos en cola horaria diferida o reintentos vencidos (HU-07 · T2).
  router.post('/queue/process', (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Autenticación requerida' });
    if (req.user.role !== Role.Admin) {
      return res.status(403).json({ error: 'Solo un administrador puede procesar la cola diferida manualmente' });
    }
    const now = typeof req.body?.now === 'string' && Number.isFinite(Date.parse(req.body.now))
      ? req.body.now
      : new Date().toISOString();
    const processed = store.distribution.processDueQueue(now);
    return res.json({ processedCount: processed.length, deliveries: processed });
  });

  // Bandeja de avisos recibidos por el organismo destinatario (CA-2 de HU-07 · T2).
  const readInboxHandler = (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.id === 'guest') return res.status(401).json({ error: 'Autenticación requerida' });
    if (user.role === Role.Guest) {
      return res.status(403).json({ error: 'Los ciudadanos no tienen acceso a la bandeja de un organismo' });
    }
    const requestedAgency = typeof req.params.agencyId === 'string' && req.params.agencyId
      ? req.params.agencyId
      : (typeof req.query.agencyId === 'string' && req.query.agencyId ? req.query.agencyId : user.organizationId);

    if (!requestedAgency) return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
    if (user.role !== Role.Admin && user.organizationId !== requestedAgency) {
      return res.status(403).json({ error: 'No tienes permiso para consultar la bandeja de otro organismo' });
    }
    const reportId = typeof req.query.reportId === 'string' && req.query.reportId ? req.query.reportId : undefined;
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    const entries = store.distribution.inbox(requestedAgency, { reportId, unacknowledgedOnly });
    return res.json({ agencyId: requestedAgency, entries });
  };

  router.get('/inbox', readInboxHandler);
  router.get('/inbox/:agencyId', readInboxHandler);

  // Acuse de recibo idempotente de un aviso en la bandeja del organismo receptor (CA-2).
  router.post('/inbox/:deliveryId/acknowledge', (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.id === 'guest') return res.status(401).json({ error: 'Autenticación requerida' });
    if (user.role === Role.Guest) {
      return res.status(403).json({ error: 'Los ciudadanos no tienen acceso a la bandeja de un organismo' });
    }
    const agencyId = user.role === Role.Admin && typeof req.body?.agencyId === 'string'
      ? req.body.agencyId
      : user.organizationId;
    if (!agencyId) return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });

    const acknowledged = store.distribution.acknowledge(req.params.deliveryId, agencyId, user.id);
    if (!acknowledged) return res.status(404).json({ error: 'Aviso no encontrado en la bandeja del organismo' });
    return res.json(acknowledged);
  });

  router.route('/confidence-rules/:category').all((req, res, next) => {
    if (!req.sessionId) return res.status(401).json({ error: 'Autenticación requerida' });
    if (req.user?.role !== Role.Admin) return res.status(403).json({ error: 'Permiso denegado' });
    next();
  }).get((req, res) => {
    const category = REPORT_CATEGORIES.find(value => value === req.params.category);
    if (!category) return res.status(404).json({ error: 'Categoría desconocida' });
    res.json(store.rule(category));
  }).put((req, res) => {
    const category = REPORT_CATEGORIES.find(value => value === req.params.category);
    if (!category) return res.status(404).json({ error: 'Categoría desconocida' });
    if (!validRule(req.body)) return res.status(400).json({ error: 'Regla de confianza no válida' });
    store.setRule(category, req.body);
    res.json(store.rule(category));
  });

  router.get('/:id/verification', (req, res) => {
    if (!req.sessionId || !req.user) return res.status(401).json({ error: 'Autenticación requerida' });
    const report = store.findByPk(req.params.id);
    if (!report || !canReadReport(store, req.user, report)) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.json({ verification: report.verification, history: store.history(report.id) });
  });

  // Consulta el estado de enrutamiento y registro de entregas de un reporte (HU-07 · T2).
  router.get('/:id/deliveries', (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
    const report = store.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

    if (!canReadReport(store, user, report)) {
      return res.status(403).json({ error: 'Permiso denegado para consultar entregas de este reporte' });
    }
    return res.json(store.distribution.getSummary(req.params.id) ?? { reportId: req.params.id, deliveries: [] });
  });

  // Reintenta entregas con fallo recuperable asociadas a un reporte (HU-07 · T2).
  router.post('/:id/deliveries/retry', (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
    const report = store.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

    if (!defineAbilityFor(user).can('update', subject('Report', { ...report }) as never)) {
      return res.status(403).json({ error: 'No tiene permiso para reintentar entregas en este ámbito' });
    }
    const retried = store.distribution.retryPendingDeliveries({ reportId: req.params.id });
    return res.json({
      reportId: req.params.id,
      retriedCount: retried.length,
      deliveries: store.distribution.listDeliveriesForReport(req.params.id),
    });
  });

  // Lista reportes pendientes cercanos sin exponer autor ni coordenadas exactas.
  router.post('/nearby', (req: Request, res: Response) => {
    const user = requireCitizen(req, res);
    if (!user) return;

    const validation = validateLocationObservation(req.body?.location);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Ubicación no válida', fields: validation.errors });
    }
    const qualityError = getLocationQualityError(validation.location);
    if (qualityError) return res.status(422).json({ error: qualityError });

    const reports = store.findAll({ organizationId: user.organizationId, status: 'pending' });
    const visibleReports = [];
    for (const report of reports) {
      if (!report.id || !report.location || report.ownerId === user.id) continue;
      const distanceMeters = distanceBetweenMeters(validation.location, report.location);
      if (distanceMeters > MAX_RESPONSE_DISTANCE_METERS) continue;
      const { entry: myResponse, counts } = store.responses(report.id, user.id);
      visibleReports.push({
        id: report.id,
        category: report.category,
        description: report.description,
        createdAt: report.createdAt,
        distanceMeters: Math.round(distanceMeters),
        response: myResponse?.response ?? null,
        counts,
      });
    }
    visibleReports.sort((first, second) => first.distanceMeters - second.distanceMeters);
    return res.json({ radiusMeters: MAX_RESPONSE_DISTANCE_METERS, reports: visibleReports });
  });

  // Creación de reporte.
  router.post('/', (req: Request, res: Response) => {
    const validation = validateCreateReport(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Datos del reporte no válidos', fields: validation.errors });
    }

    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
    if (user.role !== Role.Admin && !user.organizationId) {
      return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
    }
    const routingRule = resolveIncidentRouting(validation.data.category, {
      description: validation.data.description,
      urgent: validation.data.urgent,
    });
    const urgent = isUrgentCriticality(routingRule.criticality, validation.data.urgent);
    const data = {
      ...validation.data,
      ...(user.role === Role.Admin ? {} : { organizationId: user.organizationId }),
      ...(user.role === Role.Dev ? { environment: 'development' as const } : {}),
      ownerId: user.id,
      status: 'pending',
      urgent,
      createdAt: new Date().toISOString(),
    };
    if (!defineAbilityFor(user).can('create', subject('Report', data) as never)) {
      return res.status(403).json({ error: 'Permiso denegado para este ámbito' });
    }
    const report = store.create(data, validation.creatorProximityMeters === undefined
      ? 0 : proximityFactor(validation.creatorProximityMeters));
    res.status(201).json(report);
  });

  // Registra o actualiza la respuesta de un ciudadano a un reporte pendiente.
  router.put('/:id/response', (req: Request, res: Response) => {
    const user = requireCitizen(req, res);
    if (!user) return;

    const validation = validateSubmitReportResponse(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Respuesta no válida', fields: validation.errors });
    }
    const qualityError = getLocationQualityError(validation.data.location);
    if (qualityError) return res.status(422).json({ error: qualityError });

    const report = store.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });
    if (report.organizationId !== user.organizationId) {
      return res.status(403).json({ error: 'No tienes acceso a este reporte' });
    }
    if (report.ownerId === user.id) {
      return res.status(403).json({ error: 'No puedes responder a tu propio reporte' });
    }
    if (report.status !== 'pending') {
      return res.status(409).json({ error: 'El reporte ya no acepta respuestas' });
    }
    if (!report.location) {
      return res.status(409).json({ error: 'El reporte no tiene una ubicación verificable' });
    }

    const distanceMeters = distanceBetweenMeters(validation.data.location, report.location);
    if (distanceMeters > MAX_RESPONSE_DISTANCE_METERS) {
      return res.status(422).json({ error: 'Debes estar a 500 metros o menos del incidente para responder' });
    }

    const result = store.respond(report, user.id, validation.data.response);
    if (!result) return res.status(409).json({ error: 'El reporte ya no acepta respuestas' });

    const distSummary = store.distribution.getSummary(report.id);
    if (distSummary?.urgentState === 'confirmed' && report.status === 'pending') {
      const current = store.findByPk(report.id);
      if (current) store.update(current, { status: 'validated' });
    } else if (distSummary?.urgentState === 'refuted' && report.status === 'pending') {
      const current = store.findByPk(report.id);
      if (current) store.update(current, { status: 'rejected' });
    }

    return res.json({ reportId: report.id, response: validation.data.response, ...result });
  });

  // Consulta de reportes según el rol y ámbito del usuario.
  router.get('/', (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
    if (user.role !== Role.Admin && !user.organizationId) {
      return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
    }
    const ability = defineAbilityFor(user);
    const probe = {
      ownerId: user.role === Role.Guest ? user.id : '__another_user__',
      organizationId: user.organizationId,
      environment: user.role === Role.Dev ? 'development' : 'production',
      status: 'pending',
    };
    if (!ability.can('read', subject('Report', probe) as never)) {
      return res.status(403).json({ error: 'Permiso denegado para consultar reportes' });
    }
    if (user.role === Role.Admin) return res.json(store.findAll());
    if (user.role === Role.Guest) {
      return res.json(store.findAll({ organizationId: user.organizationId, ownerId: user.id }));
    }
    res.json(store.findAll().filter((report) => canReadReport(store, user, report)));
  });

  // Consulta de los reportes propios del usuario.
  router.get('/mi', (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
    if (user.role !== Role.Admin && !user.organizationId) {
      return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
    }
    const ability = defineAbilityFor(user);
    const where = {
      ownerId: user.id,
      ...(user.role === Role.Admin ? {} : { organizationId: user.organizationId }),
      ...(user.role === Role.Dev ? { environment: 'development' as const } : {}),
    };
    if (!ability.can('read', subject('Report', where) as never)) {
      return res.status(403).json({ error: 'Permiso denegado para consultar reportes propios' });
    }
    res.json(store.findAll(where));
  });

  // Detalle de un incidente para el organismo de origen o el organismo que recibió el aviso en bandeja.
  router.get('/:id', (req: Request, res: Response) => {
    const user = req.user;
    if (!user || !req.sessionId) return res.status(401).json({ error: 'Autenticación requerida' });
    const report = store.findByPk(req.params.id);
    if (!report || !canReadReport(store, user, report)) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    return res.json(report);
  });

  // Actualización de reporte.
  router.patch('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const report = store.findByPk(id);
    if (!report) return res.status(404).json({ error: 'No encontrado' });

    const ability = defineAbilityFor(req.user!);
    const currentReport = report as unknown as Record<string, unknown>;
    if (!ability.can('update', subject('Report', currentReport) as never)) {
      return res.status(403).json({ error: 'No tiene permiso para actualizar en este ámbito' });
    }

    const user = req.user!;
    if (user.role !== Role.Admin && !user.organizationId) {
      return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
    }
    const mutable = ['status', 'category', 'description', 'location', 'occurredAt', 'organizationId', 'ownerId', 'environment', 'projectId'];
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).some(key => !mutable.includes(key))) {
      return res.status(400).json({ error: 'Campo de reporte no editable' });
    }
    if (user.role !== Role.Admin && ['organizationId', 'ownerId', 'environment'].some((field) => field in req.body)) {
      return res.status(403).json({ error: 'No se pueden cambiar los campos de ámbito' });
    }
    if (user.role === 'qa' || user.role === 'po') {
      const bodyKeys = Object.keys(req.body);
      const allowedStatus = user.role === 'qa'
        ? currentReport.status === 'pending' && ['validated', 'rejected'].includes(req.body.status)
        : ['pending', 'validated'].includes(String(currentReport.status))
          && ['approved', 'rejected'].includes(req.body.status);
      if (bodyKeys.length !== 1 || bodyKeys[0] !== 'status' || !allowedStatus) {
        return res.status(403).json({ error: 'Este rol solo puede aplicar la transición de estado permitida' });
      }
    }

    if (req.body.category !== undefined && !REPORT_CATEGORIES.some(category => category === req.body.category)) {
      return res.status(400).json({ error: 'Categoría desconocida' });
    }
    const updated = store.update(report, req.body);
    if (!updated) return res.status(409).json({ error: 'El reporte ha cambiado; vuelve a consultarlo' });

    if (req.body.status === 'validated' || req.body.status === 'approved') {
      if (AgencyCatalog.isInstitutionalVerifier(user.organizationId)) {
        store.distribution.recordVerificationSignal({ reportId: id, institutionalConfirmations: 1 });
      } else {
        store.distribution.confirmUrgentReport(id);
      }
    } else if (req.body.status === 'rejected') {
      if (AgencyCatalog.isInstitutionalVerifier(user.organizationId)) {
        store.distribution.recordVerificationSignal({ reportId: id, institutionalRejections: 1 });
      } else {
        store.distribution.refuteUrgentReport(id);
      }
    }

    res.json(updated);
  });

  // Eliminación de reporte.
  router.delete('/:id', checkAbility('delete', 'Report'), (req: Request, res: Response) => {
    const rows = store.destroy(req.params.id);
    if (!rows) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).send();
  });

  return router;
}

export default reportsRouter;
