import { Role } from '../constants/roles.js';
import {
  asRecord,
  DISPLAY_NAME_ERROR,
  EMAIL_ERROR,
  isValidNewPassword,
  NEW_PASSWORD_ERROR,
  normalizeEmail,
  parseDisplayName,
} from './auth.js';

export const ORGANIZATION_MEMBER_ROLES = new Set<Role>([Role.Dev, Role.QA, Role.PO]);
const VALID_ROLES = new Set<string>(Object.values(Role));
const ORG_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface CreateUserInput {
  displayName: string;
  email: string;
  password: string;
  role: Role;
  organizationId?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: Role;
  organizationId?: string | null;
  revokeSessions?: boolean;
}

export interface CreateOrganizationInput {
  id?: string;
  name: string;
  description?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
}

export type AdminValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: Record<string, string> };

function rejectUnknownFields(
  input: Record<string, unknown>,
  allowed: Set<string>,
  errors: Record<string, string>,
) {
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) errors[field] = 'Campo no permitido';
  }
}

function parseOrganizationIdField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const length = [...trimmed].length;
  return length >= 1 && length <= 64 ? trimmed : null;
}

export function validateCreateUserInput(value: unknown): AdminValidationResult<CreateUserInput> {
  const input = asRecord(value);
  if (!input) return { valid: false, errors: { _form: 'El cuerpo debe ser un objeto JSON' } };

  const errors: Record<string, string> = {};
  rejectUnknownFields(input, new Set(['displayName', 'email', 'password', 'role', 'organizationId']), errors);

  const displayName = parseDisplayName(input.displayName);
  if (!displayName) errors.displayName = DISPLAY_NAME_ERROR;

  const email = normalizeEmail(input.email);
  if (!email) errors.email = EMAIL_ERROR;

  if (!isValidNewPassword(input.password)) errors.password = NEW_PASSWORD_ERROR;

  let role = Role.Guest;
  if (input.role !== undefined) {
    if (typeof input.role !== 'string' || !VALID_ROLES.has(input.role)) {
      errors.role = 'Rol no válido';
    } else {
      role = input.role as Role;
    }
  }

  let organizationId: string | undefined;
  if (input.organizationId !== undefined) {
    const parsedOrgId = parseOrganizationIdField(input.organizationId);
    if (!parsedOrgId) errors.organizationId = 'El identificador de organismo debe tener entre 1 y 64 caracteres';
    else organizationId = parsedOrgId;
  }

  if (ORGANIZATION_MEMBER_ROLES.has(role) && !organizationId && !errors.organizationId) {
    errors.organizationId = 'Los miembros de un organismo (dev, qa, po) requieren un organismo asignado';
  }

  if (Object.keys(errors).length > 0 || !displayName || !email) return { valid: false, errors };
  return {
    valid: true,
    data: {
      displayName,
      email,
      password: input.password as string,
      role,
      ...(organizationId !== undefined ? { organizationId } : {}),
    },
  };
}

export function validateUpdateUserInput(value: unknown): AdminValidationResult<UpdateUserInput> {
  const input = asRecord(value);
  if (!input) return { valid: false, errors: { _form: 'El cuerpo debe ser un objeto JSON' } };

  const errors: Record<string, string> = {};
  rejectUnknownFields(input, new Set(['displayName', 'role', 'organizationId', 'revokeSessions']), errors);

  const data: UpdateUserInput = {};
  if (input.displayName !== undefined) {
    const displayName = parseDisplayName(input.displayName);
    if (!displayName) errors.displayName = DISPLAY_NAME_ERROR;
    else data.displayName = displayName;
  }

  if (input.role !== undefined) {
    if (typeof input.role !== 'string' || !VALID_ROLES.has(input.role)) errors.role = 'Rol no válido';
    else data.role = input.role as Role;
  }

  if (input.organizationId !== undefined) {
    if (input.organizationId === null) {
      data.organizationId = null;
    } else {
      const parsedOrgId = parseOrganizationIdField(input.organizationId);
      if (!parsedOrgId) errors.organizationId = 'El identificador de organismo debe tener entre 1 y 64 caracteres';
      else data.organizationId = parsedOrgId;
    }
  }

  if (input.revokeSessions !== undefined) {
    if (typeof input.revokeSessions !== 'boolean') {
      errors.revokeSessions = 'revokeSessions debe ser un booleano';
    } else {
      data.revokeSessions = input.revokeSessions;
    }
  }

  if (
    data.displayName === undefined
    && data.role === undefined
    && data.organizationId === undefined
    && data.revokeSessions === undefined
    && Object.keys(errors).length === 0
  ) {
    errors._form = 'Indica al menos un campo para actualizar';
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, data };
}

export function validateCreateOrganizationInput(value: unknown): AdminValidationResult<CreateOrganizationInput> {
  const input = asRecord(value);
  if (!input) return { valid: false, errors: { _form: 'El cuerpo debe ser un objeto JSON' } };

  const errors: Record<string, string> = {};
  rejectUnknownFields(input, new Set(['id', 'name', 'description']), errors);

  let id: string | undefined;
  if (input.id !== undefined) {
    const trimmedId = typeof input.id === 'string' ? input.id.trim() : '';
    const idLen = [...trimmedId].length;
    if (idLen < 2 || idLen > 64 || !ORG_ID_PATTERN.test(trimmedId)) {
      errors.id = 'El identificador debe tener entre 2 y 64 caracteres alfanuméricos, guiones o guiones bajos';
    } else {
      id = trimmedId;
    }
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const nameLen = [...name].length;
  if (nameLen < 2 || nameLen > 120) {
    errors.name = 'El nombre del organismo debe tener entre 2 y 120 caracteres';
  }

  let description: string | undefined;
  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || [...input.description.trim()].length > 500) {
      errors.description = 'La descripción no puede superar los 500 caracteres';
    } else {
      description = input.description.trim();
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    data: {
      ...(id !== undefined ? { id } : {}),
      name,
      ...(description !== undefined ? { description } : {}),
    },
  };
}

export function validateUpdateOrganizationInput(value: unknown): AdminValidationResult<UpdateOrganizationInput> {
  const input = asRecord(value);
  if (!input) return { valid: false, errors: { _form: 'El cuerpo debe ser un objeto JSON' } };

  const errors: Record<string, string> = {};
  rejectUnknownFields(input, new Set(['name', 'description']), errors);

  const data: UpdateOrganizationInput = {};
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const nameLen = [...name].length;
    if (nameLen < 2 || nameLen > 120) {
      errors.name = 'El nombre del organismo debe tener entre 2 y 120 caracteres';
    } else {
      data.name = name;
    }
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || [...input.description.trim()].length > 500) {
      errors.description = 'La descripción no puede superar los 500 caracteres';
    } else {
      data.description = input.description.trim();
    }
  }

  if (data.name === undefined && data.description === undefined && Object.keys(errors).length === 0) {
    errors._form = 'Indica al menos un campo para actualizar';
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, data };
}
