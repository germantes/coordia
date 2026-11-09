import { Router } from 'express';
import { checkAbility } from '../middleware/ability.js';

/** User and organization administration endpoints are intentionally admin-only. */
const router = Router();

router.get('/users', checkAbility('read', 'User'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de usuarios aún no está configurada' });
});

router.post('/users', checkAbility('create', 'User'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de usuarios aún no está configurada' });
});

router.patch('/users/:id', checkAbility('update', 'User'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de usuarios aún no está configurada' });
});

router.delete('/users/:id', checkAbility('delete', 'User'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de usuarios aún no está configurada' });
});

router.get('/organizations', checkAbility('read', 'Organization'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de organismos aún no está configurada' });
});

router.post('/organizations', checkAbility('create', 'Organization'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de organismos aún no está configurada' });
});

router.patch('/organizations/:id', checkAbility('update', 'Organization'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de organismos aún no está configurada' });
});

router.delete('/organizations/:id', checkAbility('delete', 'Organization'), (_req, res) => {
  res.status(501).json({ error: 'La persistencia de organismos aún no está configurada' });
});

export default router;
