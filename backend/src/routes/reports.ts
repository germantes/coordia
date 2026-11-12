// src/routes/reports.ts
import { Router, Request, Response } from 'express';
import { ReportStore } from '../models/report.js';
import { checkAbility, defineAbilityFor, subject } from '../middleware/ability.js';
import { Role } from '../constants/roles.js';
import { REPORT_CATEGORIES, validateCreateReport } from '../validation/report.js';
import { proximityFactor, validRule } from '../models/confidence.js';
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

export function reportsRouter(store: ReportStore) {
  const router = Router();

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
    if (!report || !defineAbilityFor(req.user).can('read', subject('Report', { ...report }) as never)) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.json({ verification: report.verification, history: store.history(report.id) });
  });

  /** List nearby pending reports without exposing reporter identity or exact coordinates. */
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

  /** CREATE */
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
    const data = {
      ...validation.data,
      ...(user.role === Role.Admin ? {} : { organizationId: user.organizationId }),
      ...(user.role === Role.Dev ? { environment: 'development' as const } : {}),
      ownerId: user.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    if (!defineAbilityFor(user).can('create', subject('Report', data) as never)) {
      return res.status(403).json({ error: 'Permiso denegado para este ámbito' });
    }
    const report = store.create(data, validation.creatorProximityMeters === undefined
      ? 0 : proximityFactor(validation.creatorProximityMeters));
    res.status(201).json(report);
  });

  /** Record or change a citizen's single response to a pending report. */
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
    return res.json({ reportId: report.id, response: validation.data.response, ...result });
  });

  /** READ REPORTS WITH THE CALLER'S ACTUAL ROLE AND RESOURCE SCOPE */
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
    const where = user.role === Role.Admin
      ? undefined
      : {
          organizationId: user.organizationId,
          ...(user.role === Role.Guest ? { ownerId: user.id } : {}),
          ...(user.role === Role.Dev ? { environment: 'development' as const } : {}),
        };
    const reports = store.findAll(where);
    res.json(reports);
  });

  /** READ THE CALLER'S REPORTS */
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
    const reports = store.findAll(where);
    res.json(reports);
  });

  /** UPDATE */
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
    res.json(updated);
  });

  /** DELETE */
  router.delete('/:id', checkAbility('delete', 'Report'), (req: Request, res: Response) => {
    const rows = store.destroy(req.params.id);
    if (!rows) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).send();
  });

  return router;
}
