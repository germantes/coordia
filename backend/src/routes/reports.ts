// src/routes/reports.ts
import { Router, Request, Response } from 'express';
import { Report } from '../models/report.js';
import { checkAbility, defineAbilityFor, subject } from '../middleware/ability.js';
import { Role } from '../constants/roles.js';
import { validateCreateReport } from '../validation/report.js';
import { ReportResponse } from '../models/report-response.js';
import { AgencyCatalog, INCIDENT_ROUTING_RULES, resolveIncidentRouting } from '../models/recipient-matrix.js';
import { isUrgentCriticality } from '../validation/urgent-report.js';
import { ReportDistribution } from '../models/report-distribution.js';
import {
  distanceBetweenMeters,
  getLocationQualityError,
  MAX_RESPONSE_DISTANCE_METERS,
  validateLocationObservation,
  validateSubmitReportResponse,
} from '../validation/report-response.js';

const router = Router();

/** Consulta del catálogo identificado de organismos receptores y matriz de incidentes (HU-07). */
router.get('/catalog/agencies', (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Autenticación requerida' });
  return res.json({
    agencies: AgencyCatalog.all(),
    rules: Object.values(INCIDENT_ROUTING_RULES),
  });
});

/** Procesa los envíos en cola horaria diferida cuya ventana laboral (08:00 L-V) ya se cumplió. */
router.post('/queue/process', (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Autenticación requerida' });
  if (req.user.role !== Role.Admin) {
    return res.status(403).json({ error: 'Solo un administrador puede procesar la cola diferida manualmente' });
  }
  const now = typeof req.body?.now === 'string' && Number.isFinite(Date.parse(req.body.now))
    ? req.body.now
    : new Date().toISOString();
  const processed = ReportDistribution.processDueQueue(now);
  return res.json({ processedCount: processed.length, deliveries: processed });
});

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

/** List nearby pending reports without exposing reporter identity or exact coordinates. */
router.post('/nearby', async (req: Request, res: Response) => {
  const user = requireCitizen(req, res);
  if (!user) return;

  const validation = validateLocationObservation(req.body?.location);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Ubicación no válida', fields: validation.errors });
  }
  const qualityError = getLocationQualityError(validation.location);
  if (qualityError) return res.status(422).json({ error: qualityError });

  const reports = await Report.findAll({ where: { organizationId: user.organizationId, status: 'pending' } });
  const visibleReports = [];
  for (const report of reports) {
    if (!report.id || !report.location || report.ownerId === user.id) continue;
    const distanceMeters = distanceBetweenMeters(validation.location, report.location);
    if (distanceMeters > MAX_RESPONSE_DISTANCE_METERS) continue;
    const [myResponse, counts] = await Promise.all([
      ReportResponse.find(String(report.id), user.id),
      ReportResponse.counts(String(report.id)),
    ]);
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

/** CREATE */
router.post('/', async (req: Request, res: Response) => {
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
  const createdAt = new Date().toISOString();
  const data = {
    ...validation.data,
    ...(user.role === Role.Admin ? {} : { organizationId: user.organizationId }),
    ...(user.role === Role.Dev ? { environment: 'development' as const } : {}),
    ownerId: user.id,
    status: 'pending',
    urgent,
    createdAt,
  };
  if (!defineAbilityFor(user).can('create', subject('Report', data) as never)) {
    return res.status(403).json({ error: 'Permiso denegado para este ámbito' });
  }
  const report = await Report.create(data);
  if (report.id && report.category && report.location) {
    ReportDistribution.distributeNewReport({
      reportId: String(report.id),
      category: report.category,
      description: report.description,
      location: report.location,
      occurredAt: report.occurredAt,
      createdAt: report.createdAt ?? createdAt,
      status: report.status,
      urgent,
    });
  }
  res.status(201).json(report);
});

/** Record or change a citizen's single response to a pending report. */
router.put('/:id/response', async (req: Request, res: Response) => {
  const user = requireCitizen(req, res);
  if (!user) return;

  const validation = validateSubmitReportResponse(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Respuesta no válida', fields: validation.errors });
  }
  const qualityError = getLocationQualityError(validation.data.location);
  if (qualityError) return res.status(422).json({ error: qualityError });

  const report = await Report.findByPk(req.params.id);
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

  const { record, changed } = await ReportResponse.upsert(
    req.params.id,
    user.id,
    validation.data.response,
    new Date().toISOString(),
  );
  const counts = await ReportResponse.counts(req.params.id);
  const distribution = ReportDistribution.recordVerificationSignal({
    reportId: req.params.id,
    citizenConfirmations: counts.confirm,
    citizenRejections: counts.question,
  });
  if (distribution?.urgentState === 'confirmed' && report.status === 'pending') {
    await report.update({ status: 'validated' });
  } else if (distribution?.urgentState === 'refuted' && report.status === 'pending') {
    await report.update({ status: 'rejected' });
  }
  return res.json({
    reportId: req.params.id,
    response: record.response,
    changed,
    updatedAt: record.updatedAt,
    counts,
  });
});

/** Consulta el estado de enrutamiento y registro de entregas de un reporte (HU-07 · T2). */
router.get('/:id/deliveries', async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
  const report = await Report.findByPk(req.params.id);
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

  const ability = defineAbilityFor(user);
  if (!ability.can('read', subject('Report', report as unknown as Record<string, unknown>) as never)) {
    return res.status(403).json({ error: 'Permiso denegado para consultar entregas de este reporte' });
  }

  const summary = ReportDistribution.getSummary(req.params.id);
  if (!summary) {
    return res.json({ reportId: req.params.id, deliveries: [] });
  }
  return res.json(summary);
});

/** Reintenta entregas fallidas/pendientes de reintento asociadas a un reporte (HU-07 · T2). */
router.post('/:id/deliveries/retry', async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
  const report = await Report.findByPk(req.params.id);
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

  const ability = defineAbilityFor(user);
  if (!ability.can('update', subject('Report', report as unknown as Record<string, unknown>) as never)) {
    return res.status(403).json({ error: 'No tiene permiso para reintentar entregas en este ámbito' });
  }

  const retried = ReportDistribution.retryPendingDeliveries({ reportId: req.params.id });
  return res.json({
    reportId: req.params.id,
    retriedCount: retried.length,
    deliveries: ReportDistribution.listDeliveriesForReport(req.params.id),
  });
});

/** READ REPORTS WITH THE CALLER'S ACTUAL ROLE AND RESOURCE SCOPE */
router.get('/', async (req: Request, res: Response) => {
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
  const where = user.role === Role.Admin
    ? undefined
    : {
        organizationId: user.organizationId,
        ...(user.role === Role.Guest ? { ownerId: user.id } : {}),
        ...(user.role === Role.Dev ? { environment: 'development' } : {}),
      };
  const options = where ? { where } : {};
  const reports = await Report.findAll(options);
  res.json(reports);
});

/** READ THE CALLER'S REPORTS */
router.get('/mi', async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
  if (user.role !== Role.Admin && !user.organizationId) {
    return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
  }
  const ability = defineAbilityFor(user);
  const where = {
    ownerId: user.id,
    ...(user.role === Role.Admin ? {} : { organizationId: user.organizationId }),
    ...(user.role === Role.Dev ? { environment: 'development' } : {}),
  };
  if (!ability.can('read', subject('Report', where) as never)) {
    return res.status(403).json({ error: 'Permiso denegado para consultar reportes propios' });
  }
  const reports = await Report.findAll({ where });
  res.json(reports);
});

/** UPDATE */
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const report = await Report.findByPk(id) as (Report & { ownerId?: string; status?: string }) | null;
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

  const updated = await report.update(req.body);
  if (req.body.status === 'validated' || req.body.status === 'approved') {
    if (AgencyCatalog.isInstitutionalVerifier(user.organizationId)) {
      ReportDistribution.recordVerificationSignal({
        reportId: id,
        institutionalConfirmations: 1,
      });
    } else {
      ReportDistribution.confirmUrgentReport(id);
    }
  } else if (req.body.status === 'rejected') {
    if (AgencyCatalog.isInstitutionalVerifier(user.organizationId)) {
      ReportDistribution.recordVerificationSignal({
        reportId: id,
        institutionalRejections: 1,
      });
    } else {
      ReportDistribution.refuteUrgentReport(id);
    }
  }
  res.json(updated);
});

/** DELETE */
router.delete('/:id', checkAbility('delete', 'Report'), async (req: Request, res: Response) => {
  const rows = await Report.destroy({ where: { id: req.params.id } });
  if (!rows) return res.status(404).json({ error: 'No encontrado' });
  res.status(204).send();
});

export default router;
