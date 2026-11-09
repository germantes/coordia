import { describe, expect, it } from 'vitest';
import { validateLoginInput, validateRegisterInput } from '../src/validation/auth.js';

describe('account input validation', () => {
  it('normalizes the account name and email on registration', () => {
    const result = validateRegisterInput({
      displayName: '  Laura Marín  ',
      email: ' LAURA@EXAMPLE.COM ',
      password: 'a sufficiently long passphrase',
      confirmPassword: 'a sufficiently long passphrase',
      role: 'admin',
      organizationId: 'untrusted-org',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe('Laura Marín');
      expect(result.data.email).toBe('laura@example.com');
      expect(result.data).not.toHaveProperty('role');
      expect(result.data).not.toHaveProperty('organizationId');
    }
  });

  it('rejects a short display name, malformed email, short password, and mismatch', () => {
    const result = validateRegisterInput({
      displayName: 'A',
      email: 'not-an-email',
      password: 'short',
      confirmPassword: 'different',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toMatchObject({
        displayName: expect.any(String),
        email: expect.any(String),
        password: expect.any(String),
        confirmPassword: expect.any(String),
      });
    }
  });

  it('rejects non-object registration payloads', () => {
    expect(validateRegisterInput(null).success).toBe(false);
    expect(validateRegisterInput([]).success).toBe(false);
  });

  it('normalizes login email but preserves the password exactly', () => {
    const result = validateLoginInput({ email: ' USER@EXAMPLE.COM ', password: '  exact password  ' });

    expect(result).toEqual({ success: true, data: { email: 'user@example.com', password: '  exact password  ' } });
  });

  it('rejects login passwords that are missing or exceed the maximum length', () => {
    expect(validateLoginInput({ email: 'user@example.com', password: '' }).success).toBe(false);
    expect(validateLoginInput({ email: 'user@example.com', password: 'x'.repeat(129) }).success).toBe(false);
  });
});
