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
      can(['create', 'read', 'update'], 'Report', { environment: 'development' });
      can(['read', 'create', 'update'], 'Project', { environment: 'development' });
      can('read', 'Organization');
      can('read', 'User');
      can('read', 'Map');
      break;
    case Role.QA:
      can('read', 'Report');
      can('update', 'Report', { status: { $in: ['pending', 'validated'] } });
      can('read', 'Organization');
      can('read', 'Project');
      can('read', 'Map');
      break;
    case Role.PO:
      can('read', 'Report');
      can('update', 'Report', { status: { $in: ['pending', 'validated'] } });
      cannot('delete', 'Report');
      can('read', 'Project');
      can('read', 'Organization');
      can('read', 'Map');
      break;
    case Role.Guest:
      can('create', 'Report');
      can('read', 'Report', { ownerId: user.id });
      can('read', 'Organization');
      can('read', 'Map');
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
