// src/routes/reports.ts
import { Router, Request, Response } from 'express';
import { Report } from '../models/report.js';
import { checkAbility, defineAbilityFor, subject } from '../middleware/ability.js';

const router = Router();

/** CREATE */
router.post('/', checkAbility('create', 'Report'), async (req: Request, res: Response) => {
  const report = await Report.create({ ...req.body, ownerId: (req as any).user.id });
  res.status(201).json(report);
});

/** READ ALL (admin, dev, qa, po) */
router.get('/', checkAbility('read', 'Report'), async (req: Request, res: Response) => {
  const ability = defineAbilityFor(req.user!);
  const canReadAll = ability.can('read', 'Report');
  const reports = await Report.findAll(!canReadAll
    ? { where: { ownerId: req.user!.id } }
    : {});
  res.json(reports);
});

/** READ OWN */
router.get('/mi', checkAbility('read', 'Report'), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const reports = await Report.findAll({ where: { ownerId: userId } });
  res.json(reports);
});

/** UPDATE */
router.patch('/:id', checkAbility('update', 'Report'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const report = await Report.findByPk(id) as (Report & { ownerId?: string; status?: string }) | null;
  if (!report) return res.status(404).json({ error: 'No encontrado' });

  const ability = defineAbilityFor(req.user!);
  if (!ability.can('update', subject('Report', report as unknown as Record<string, unknown>) as never)) {
    return res.status(403).json({ error: 'No tiene permiso para actualizar' });
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
