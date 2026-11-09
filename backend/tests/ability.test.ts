import { describe, expect, it } from 'vitest';
import { Role } from '../src/constants/roles.js';
import { defineAbilityFor, subject } from '../src/middleware/ability.js';
import type { User } from '../src/types/user.js';

function abilityFor(role: Role, organizationId?: string) {
  const user: User = { id: 'user-1', email: 'user@example.test', role, organizationId };
  return defineAbilityFor(user);
}

function report(organizationId: string, attributes: Record<string, unknown> = {}) {
  return subject('Report', { organizationId, ...attributes });
}

describe('role permissions and organization scope', () => {
  it('gives admins global access', () => {
    const ability = abilityFor(Role.Admin);

    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('read', report('another-organization') as never)).toBe(true);
  });

  it('limits developers to their organization and development data', () => {
    const ability = abilityFor(Role.Dev, 'org-1');

    expect(ability.can('update', report('org-1', { environment: 'development' }) as never)).toBe(true);
    expect(ability.can('update', report('org-2', { environment: 'development' }) as never)).toBe(false);
    expect(ability.can('read', report('org-1', { environment: 'production' }) as never)).toBe(false);
  });

  it('limits QA to pending reports in its organization', () => {
    const ability = abilityFor(Role.QA, 'org-1');

    expect(ability.can('read', report('org-1') as never)).toBe(true);
    expect(ability.can('read', report('org-2') as never)).toBe(false);
    expect(ability.can('update', report('org-1', { status: 'pending' }) as never)).toBe(true);
    expect(ability.can('update', report('org-1', { status: 'validated' }) as never)).toBe(false);
  });

  it('lets product owners approve or reject eligible reports in their organization', () => {
    const ability = abilityFor(Role.PO, 'org-1');

    expect(ability.can('update', report('org-1', { status: 'pending' }) as never)).toBe(true);
    expect(ability.can('update', report('org-1', { status: 'validated' }) as never)).toBe(true);
    expect(ability.can('update', report('org-2', { status: 'pending' }) as never)).toBe(false);
    expect(ability.can('delete', 'Report')).toBe(false);
  });

  it('limits guests to their own reports in their assigned organization', () => {
    const ability = abilityFor(Role.Guest, 'org-1');

    expect(ability.can('create', report('org-1') as never)).toBe(true);
    expect(ability.can('create', report('org-2') as never)).toBe(false);
    expect(ability.can('read', report('org-1', { ownerId: 'user-1' }) as never)).toBe(true);
    expect(ability.can('read', report('org-1', { ownerId: 'user-2' }) as never)).toBe(false);
    expect(ability.can('read', report('org-2', { ownerId: 'user-1' }) as never)).toBe(false);
  });

  it('denies scoped access when a user has no assigned organization', () => {
    const ability = abilityFor(Role.Guest);

    expect(ability.can('create', report('org-1') as never)).toBe(false);
    expect(ability.can('read', report('org-1', { ownerId: 'user-1' }) as never)).toBe(false);
  });
});
