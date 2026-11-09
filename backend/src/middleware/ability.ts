import { AbilityBuilder, Ability, AbilityClass } from '@casl/ability';
import type { User } from '../types/user.js';
import { Role } from '../constants/roles.js';

export type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
export type Subjects = 'Report' | 'User' | 'Organization' | 'Project' | 'Map' | 'all';
type AppSubjects =
  | { type: 'Report'; ownerId?: string; organizationId?: string; environment?: string; status?: string }
  | { type: 'User'; organizationId?: string }
  | { type: 'Organization'; id?: string }
  | { type: 'Project'; organizationId?: string; environment?: string }
  | { type: 'Map'; organizationId?: string }
  | 'all';
export type AppAbility = Ability<[Actions, Subjects], any>;

export function subject<T extends Record<string, unknown>, S extends Subjects>(type: S, value: T) {
  return Object.assign({}, value, { type }) as T & { type: S };
}

/** Central role matrix. Ownership and organization scope are expressed as CASL conditions. */
export function defineAbilityFor(user: User): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<Ability<[Actions, Subjects], any>>(
    Ability as AbilityClass<AppAbility>,
  );

  switch (user.role) {
    case Role.Admin:
      can('manage', 'all');
      break;
    case Role.Dev:
      if (user.organizationId) {
        const organization = { organizationId: user.organizationId };
        can(['create', 'read', 'update'], 'Report', { ...organization, environment: 'development' });
        can(['read', 'create', 'update'], 'Project', { ...organization, environment: 'development' });
        can('read', 'Organization', { id: user.organizationId });
        can('read', 'Map', organization);
      }
      break;
    case Role.QA:
      if (user.organizationId) {
        can('read', 'Report', { organizationId: user.organizationId });
        can('update', 'Report', { organizationId: user.organizationId, status: 'pending' });
        can('read', 'Organization', { id: user.organizationId });
        can('read', 'Project', { organizationId: user.organizationId });
        can('read', 'Map', { organizationId: user.organizationId });
      }
      break;
    case Role.PO:
      if (user.organizationId) {
        can('read', 'Report', { organizationId: user.organizationId });
        can('update', 'Report', {
          organizationId: user.organizationId,
          status: { $in: ['pending', 'validated'] },
        });
        can('read', 'Project', { organizationId: user.organizationId });
        can('read', 'Organization', { id: user.organizationId });
        can('read', 'Map', { organizationId: user.organizationId });
      }
      cannot('delete', 'Report');
      break;
    case Role.Guest:
      if (user.organizationId) {
        can('create', 'Report', { organizationId: user.organizationId });
        can('read', 'Report', { ownerId: user.id, organizationId: user.organizationId });
        can('read', 'Organization', { id: user.organizationId });
        can('read', 'Map', { organizationId: user.organizationId });
      }
      break;
  }

  return build({ detectSubjectType: (item) => (item as { type?: Subjects }).type ?? item as Subjects });
}

export function checkAbility(action: Actions, subject: Subjects) {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Autenticación requerida' });
    if (defineAbilityFor(req.user).can(action, subject)) return next();
    return res.status(403).json({ error: 'Permiso denegado' });
  };
}
