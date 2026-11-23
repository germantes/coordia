import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthStore } from '../auth/store.js';
import { hashPassword } from '../auth/password.js';
import { Role } from '../constants/roles.js';
import { checkAbility, defineAbilityFor, subject } from '../middleware/ability.js';
import type { User } from '../types/user.js';
import {
  ORGANIZATION_MEMBER_ROLES,
  validateCreateOrganizationInput,
  validateCreateUserInput,
  validateUpdateOrganizationInput,
  validateUpdateUserInput,
} from '../validation/administration.js';

/** User and organization administration endpoints with RBAC and immediate session sync. */
export function administrationRouter(store: AuthStore) {
  const router = Router();
  const route = (handler: (req: Request, res: Response) => Promise<unknown> | unknown) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve().then(() => handler(req, res)).catch(next);
    };

  router.get('/users', checkAbility('read', 'User'), (req, res) => {
    const organizationId = typeof req.query.organizationId === 'string' && req.query.organizationId.trim()
      ? req.query.organizationId.trim()
      : undefined;
    const role = typeof req.query.role === 'string' && req.query.role.trim()
      ? req.query.role.trim()
      : undefined;
    res.json(store.listAccounts({ organizationId, role }));
  });

  router.get('/users/:id', checkAbility('read', 'User'), (req, res) => {
    const account = store.accountById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(account.user);
  });

  router.post('/users', checkAbility('create', 'User'), route(async (req, res) => {
    const validation = validateCreateUserInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Datos de usuario inválidos', fields: validation.errors });
    }

    const { displayName, email, password, role, organizationId } = validation.data;
    if (store.account(email)) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    if (organizationId !== undefined && !store.organizationById(organizationId)) {
      return res.status(400).json({
        error: 'Datos de usuario inválidos',
        fields: { organizationId: 'El organismo asignado no existe' },
      });
    }

    const user: User = {
      id: randomUUID(),
      displayName,
      email,
      role,
      ...(organizationId !== undefined ? { organizationId } : {}),
      createdAt: new Date().toISOString(),
    };
    const passwordHash = await hashPassword(password);
    if (!store.addAccount(user, passwordHash)) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    return res.status(201).json(user);
  }));

  router.patch('/users/:id', checkAbility('update', 'User'), (req, res) => {
    const validation = validateUpdateUserInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Datos de actualización inválidos', fields: validation.errors });
    }

    const existing = store.accountById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    const nextRole = validation.data.role ?? existing.user.role;
    const nextOrganizationId = validation.data.organizationId === undefined
      ? existing.user.organizationId
      : (validation.data.organizationId ?? undefined);

    if (ORGANIZATION_MEMBER_ROLES.has(nextRole) && !nextOrganizationId) {
      return res.status(400).json({
        error: 'Datos de actualización inválidos',
        fields: { organizationId: 'Los miembros de un organismo (dev, qa, po) requieren un organismo asignado' },
      });
    }
    if (nextOrganizationId !== undefined && !store.organizationById(nextOrganizationId)) {
      return res.status(400).json({
        error: 'Datos de actualización inválidos',
        fields: { organizationId: 'El organismo asignado no existe' },
      });
    }

    const updated = store.updateAccount(req.params.id, validation.data, req.user?.id);
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(updated);
  });

  router.get('/users/:id/audit', checkAbility('read', 'User'), (req, res) => {
    if (!store.accountById(req.params.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json(store.accountAudit(req.params.id));
  });

  const revokeSessionsHandler = (req: Request, res: Response) => {
    if (!store.accountById(req.params.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    store.revokeUserSessions(req.params.id);
    return res.status(204).send();
  };

  router.post('/users/:id/revoke', checkAbility('update', 'User'), revokeSessionsHandler);
  router.delete('/users/:id/sessions', checkAbility('update', 'User'), revokeSessionsHandler);

  router.delete('/users/:id', checkAbility('delete', 'User'), (req, res) => {
    if (!store.deleteAccount(req.params.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.status(204).send();
  });

  router.get('/organizations', checkAbility('read', 'Organization'), (req, res) => {
    const user = req.user!;
    if (user.role === Role.Admin) {
      return res.json(store.listOrganizations());
    }
    if (!user.organizationId) {
      return res.status(403).json({ error: 'El usuario no tiene un organismo asignado' });
    }
    const organization = store.organizationById(user.organizationId);
    return res.json([organization ?? { id: user.organizationId, name: user.organizationId }]);
  });

  router.get('/organizations/:id', checkAbility('read', 'Organization'), (req, res) => {
    const user = req.user!;
    if (!defineAbilityFor(user).can('read', subject('Organization', { id: req.params.id }) as never)) {
      return res.status(403).json({ error: 'Permiso denegado' });
    }
    const organization = store.organizationById(req.params.id);
    if (!organization) return res.status(404).json({ error: 'Organismo no encontrado' });
    return res.json(organization);
  });

  router.post('/organizations', checkAbility('create', 'Organization'), (req, res) => {
    const validation = validateCreateOrganizationInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Datos de organismo inválidos', fields: validation.errors });
    }
    const created = store.createOrganization(validation.data);
    if (created === 'conflict') {
      return res.status(409).json({ error: 'El organismo ya existe' });
    }
    return res.status(201).json(created);
  });

  router.patch('/organizations/:id', checkAbility('update', 'Organization'), (req, res) => {
    const validation = validateUpdateOrganizationInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Datos de organismo inválidos', fields: validation.errors });
    }
    const updated = store.updateOrganization(req.params.id, validation.data);
    if (updated === 'not_found') return res.status(404).json({ error: 'Organismo no encontrado' });
    if (updated === 'conflict') return res.status(409).json({ error: 'El organismo ya existe' });
    return res.json(updated);
  });

  router.delete('/organizations/:id', checkAbility('delete', 'Organization'), (req, res) => {
    if (!store.deleteOrganization(req.params.id)) {
      return res.status(404).json({ error: 'Organismo no encontrado' });
    }
    return res.status(204).send();
  });

  return router;
}

export default administrationRouter;
