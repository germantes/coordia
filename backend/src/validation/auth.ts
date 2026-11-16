export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Partial<Record<keyof T, string>> };

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : null;
}

export function parseDisplayName(value: unknown): string | null {
  const displayName = typeof value === 'string' ? value.trim() : '';
  const length = [...displayName].length;
  return length >= 2 && length <= 80 ? displayName : null;
}

export function isValidNewPassword(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const length = [...value].length;
  return length >= 12 && length <= MAX_PASSWORD_LENGTH && Boolean(value.trim());
}

export const DISPLAY_NAME_ERROR = 'El nombre debe tener entre 2 y 80 caracteres.';
export const EMAIL_ERROR = 'Introduce un correo electrónico válido.';
export const NEW_PASSWORD_ERROR =
  'La contraseña debe tener entre 12 y 128 caracteres y no puede estar formada solo por espacios. Se conserva tal como se escribió; no se recorta.';

export function validateRegisterInput(value: unknown): ValidationResult<RegisterInput> {
  const input = asRecord(value);
  if (!input) {
    return { success: false, errors: { displayName: 'Introduce los datos de la cuenta.' } };
  }

  const errors: Partial<Record<keyof RegisterInput, string>> = {};
  const displayName = parseDisplayName(input.displayName);
  if (!displayName) errors.displayName = DISPLAY_NAME_ERROR;

  const email = normalizeEmail(input.email);
  if (!email) errors.email = EMAIL_ERROR;

  const password = typeof input.password === 'string' ? input.password : '';
  if (!isValidNewPassword(password)) errors.password = NEW_PASSWORD_ERROR;

  if (typeof input.confirmPassword !== 'string' || input.confirmPassword !== password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }

  if (Object.keys(errors).length > 0 || !displayName || !email) return { success: false, errors };

  // Ignore authority fields such as role and organizationId from client input.
  return {
    success: true,
    data: { displayName, email, password, confirmPassword: password },
  };
}

export function validateLoginInput(value: unknown): ValidationResult<LoginInput> {
  const input = asRecord(value);
  if (!input) return { success: false, errors: { email: 'Introduce correo y contraseña.' } };

  const errors: Partial<Record<keyof LoginInput, string>> = {};
  const email = normalizeEmail(input.email);
  if (!email) errors.email = 'Introduce un correo electrónico válido.';

  const password = typeof input.password === 'string' ? input.password : '';
  const passwordLength = [...password].length;
  if (passwordLength < 1 || passwordLength > MAX_PASSWORD_LENGTH || !password.trim()) {
    errors.password = 'Introduce una contraseña de hasta 128 caracteres que no esté formada solo por espacios. No se recorta.';
  }

  if (Object.keys(errors).length > 0 || !email) return { success: false, errors };
  return { success: true, data: { email, password } };
}
