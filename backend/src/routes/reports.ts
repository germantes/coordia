// src/routes/reports.ts
import { Router, Request, Response } from 'express';
import { Report } from '../models/report.js';
import { checkAbility, defineAbilityFor, subject } from '../middleware/ability.js';
import { Role } from '../constants/roles.js';

const router = Router();

/** CREATE */
router.post('/', async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== Role.Admin && !user.organizationId) {
    return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
  }
  const data = {
    ...req.body,
    ...(user.role === Role.Admin ? {} : { organizationId: user.organizationId }),
    ownerId: user.id,
  };
  if (!defineAbilityFor(user).can('create', subject('Report', data))) {
    return res.status(403).json({ error: 'Permiso denegado para este ámbito' });
  }
  const report = await Report.create(data);
  res.status(201).json(report);
});

/** READ ALL (admin, dev, qa, po) */
router.get('/', checkAbility('read', 'Report'), async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== Role.Admin && !user.organizationId) {
    return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
  }
  const ability = defineAbilityFor(req.user!);
  const otherOwner = '__another_user__';
  const organizationId = user.organizationId;
  const canReadDevelopment = ability.can('read', subject('Report', {
    ownerId: otherOwner,
    environment: 'development',
    organizationId,
  }) as never);
  const canReadProduction = ability.can('read', subject('Report', {
    ownerId: otherOwner,
    environment: 'production',
    organizationId,
  }) as never);
  const where = user.role === Role.Admin
    ? undefined
    : {
        organizationId,
        ...(user.role === Role.Guest ? { ownerId: user.id } : {}),
        ...(canReadDevelopment && !canReadProduction ? { environment: 'development' } : {}),
      };
  const options = where ? { where } : {};
  const reports = await Report.findAll(options);
  res.json(reports);
});

/** READ OWN */
router.get('/mi', checkAbility('read', 'Report'), async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== Role.Admin && !user.organizationId) {
    return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
  }
  const reports = await Report.findAll({
    where: { ownerId: user.id, ...(user.role === Role.Admin ? {} : { organizationId: user.organizationId }) },
  });
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
  res.json(updated);
});

/** DELETE */
router.delete('/:id', checkAbility('delete', 'Report'), async (req: Request, res: Response) => {
  const rows = await Report.destroy({ where: { id: req.params.id } });
  if (!rows) return res.status(404).json({ error: 'No encontrado' });
  res.status(204).send();
});

export default router;
