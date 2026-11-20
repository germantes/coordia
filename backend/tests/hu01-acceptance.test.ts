import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthStore } from '../src/auth/store.js';
import { hashPassword } from '../src/auth/password.js';
import { createServer } from '../src/index.js';
import { ReportStore } from '../src/models/report.js';
import { Role } from '../src/constants/roles.js';
import type { User } from '../src/types/user.js';

// Login admite 5 peticiones por correo normalizado y 30 por IP en 15 minutos,
// y el contador incluye los intentos rechazados. Las comparaciones de 401 se
// quedan por debajo de esa ventana: el sexto intento ya no es un 401, es un 429
// genérico que no debe confundirse con la respuesta de credenciales.

let store: AuthStore;
let reportStore: ReportStore;
let server: Server;
let base: string;

const password = '  frase secreta larga  ';

beforeEach(async () => {
  // El segundo argumento evita el ReportStore de fichero .data/reports.sqlite,
  // compartido con otros tests y origen del "database is locked".
  store = new AuthStore(':memory:');
  reportStore = new ReportStore(':memory:');
  server = createServer(store, reportStore).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  reportStore.close();
  store.close();
});

function post(path: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function seedAccount(email: string, organizationId?: string) {
  const user: User = {
    id: crypto.randomUUID(),
    displayName: 'Laura',
    email,
    role: Role.Guest,
    ...(organizationId ? { organizationId } : {}),
  };
  expect(store.addAccount(user, await hashPassword(password))).toBe(true);
  return user;
}

const registerPasswordError = 'La contraseña debe tener entre 12 y 128 caracteres y no puede estar formada solo por espacios. Se conserva tal como se escribió; no se recorta.';
const loginPasswordError = 'Introduce una contraseña de hasta 128 caracteres que no esté formada solo por espacios. No se recorta.';

describe('HU-01 acceptance: register and log in', () => {
  it('CA-1 registers a valid account and logs in with those credentials', async () => {
    const created = await post('register', {
      displayName: '  Germán Torres  ',
      email: '  German@Example.Test ',
      password,
      confirmPassword: password,
      role: 'admin',
      organizationId: 'forjado',
      passwordHash: 'no-debe-copiarse',
      id: 'forjado',
    });
    const createdBody = await created.json() as Record<string, unknown>;

    expect(created.status).toBe(201);
    expect(Object.keys(createdBody).sort()).toEqual(['displayName', 'email', 'id']);
    expect(createdBody).toMatchObject({ displayName: 'Germán Torres', email: 'german@example.test' });
    expect(created.headers.get('set-cookie')).toBeNull();

    const stored = store.account('german@example.test');
    expect(stored?.user).toMatchObject({
      role: Role.Guest,
      displayName: 'Germán Torres',
      email: 'german@example.test',
    });
    expect(stored?.user.organizationId).toBeUndefined();
    expect(stored?.user.id).not.toBe('forjado');

    const login = await post('login', { email: 'German@Example.Test', password });
    const session = await login.json() as Record<string, unknown>;
    expect(login.status).toBe(200);
    expect(Object.keys(session).sort()).toEqual(['accessToken', 'expiresIn', 'tokenType']);
    expect(session).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(session.accessToken).toEqual(expect.any(String));
    expect(login.headers.get('set-cookie')).toMatch(/coordia\.refreshToken=.+;.*HttpOnly/i);

    // La contraseña no se recorta: la variante sin los espacios no es la misma credencial.
    const trimmed = await post('login', { email: 'german@example.test', password: password.trim() });
    expect(trimmed.status).toBe(401);
    expect(await trimmed.json()).toEqual({ error: 'Credenciales inválidas' });
  });

  it('CA-2 rejects an existing identifier and reports the conflict', async () => {
    const payload = {
      displayName: 'Laura',
      email: 'Laura@Example.Test',
      password,
      confirmPassword: password,
    };
    const first = await post('register', payload);
    expect(first.status).toBe(201);

    const duplicate = await post('register', { ...payload, displayName: 'Otra persona', email: ' laura@example.test ' });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: 'El correo ya está registrado' });

    const login = await post('login', { email: 'laura@example.test', password });
    expect(login.status).toBe(200);
    expect(store.account('laura@example.test')?.user.displayName).toBe('Laura');
  });

  it('CA-3 returns the same response for a wrong password and an unknown user', async () => {
    await seedAccount('laura@example.test');
    const wrong = await post('login', { email: ' Laura@Example.Test ', password: 'clave-incorrecta' });
    const unknown = await post('login', { email: 'nadie@example.test', password: 'clave-incorrecta' });
    const wrongBody = await wrong.json();
    const unknownBody = await unknown.json();

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(wrong.status);
    expect(wrongBody).toEqual(unknownBody);
    expect(wrongBody).toEqual({ error: 'Credenciales inválidas' });
    expect(wrong.headers.get('set-cookie')).toBeNull();
    expect(unknown.headers.get('set-cookie')).toBeNull();
  });

  it('CA-3 keeps a generic response when the per-email attempt limit is reached', async () => {
    await seedAccount('laura@example.test');
    const variants = [
      'laura@example.test',
      'Laura@Example.Test',
      '  LAURA@example.test  ',
      'laura@EXAMPLE.test',
      ' Laura@example.test ',
    ];

    async function exhaust(emailVariants: string[]) {
      const failures = [];
      for (const email of emailVariants) {
        const response = await post('login', { email, password: 'clave-incorrecta' });
        failures.push({ status: response.status, body: await response.json() });
      }
      const blocked = await post('login', { email: emailVariants[0], password: 'clave-incorrecta' });
      return { failures, status: blocked.status, body: await blocked.json(), retryAfter: blocked.headers.get('retry-after') };
    }

    const existing = await exhaust(variants);
    const unknown = await exhaust(variants.map((email) => email.replace('laura', 'nadie').replace('LAURA', 'NADIE').replace('Laura', 'Nadie')));

    for (const result of [existing, unknown]) {
      expect(result.failures).toEqual(variants.map(() => ({ status: 401, body: { error: 'Credenciales inválidas' } })));
      expect(result.status).toBe(429);
      expect(Number(result.retryAfter)).toBeGreaterThan(0);
    }
    expect(existing.body).toEqual(unknown.body);
    expect(existing.body).toEqual({ error: 'Demasiados intentos. Inténtalo más tarde.' });
  });

  it('CA-4 rejects the access token and the refresh cookie after logout', async () => {
    await seedAccount('laura@example.test', 'org-malaga');
    const login = await post('login', { email: 'laura@example.test', password });
    expect(login.status).toBe(200);
    const token = (await login.json() as { accessToken: string }).accessToken;
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const headers = { Authorization: `Bearer ${token}` };

    expect((await fetch(`${base}/api/reports/mi`, { headers })).status).toBe(200);
    expect((await post('logout', {}, headers)).status).toBe(204);

    const reusedToken = await fetch(`${base}/api/reports/mi`, { headers });
    expect(reusedToken.status).toBe(401);
    expect(await reusedToken.json()).toEqual({ error: 'Sesión inválida' });

    const reusedCookie = await post('refresh', {}, { Cookie: cookie });
    expect(reusedCookie.status).toBe(401);
    expect(await reusedCookie.json()).toEqual({ error: 'Sesión inválida' });
    expect((await fetch(`${base}/api/reports/mi`, { headers })).status).toBe(401);
  });

  it('CA-4 revokes a session opened by a publicly registered account', async () => {
    const registered = await post('register', {
      displayName: 'Ana Ruiz',
      email: 'ana@example.test',
      password,
      confirmPassword: password,
    });
    expect(registered.status).toBe(201);
    const login = await post('login', { email: 'ana@example.test', password });
    const token = (await login.json() as { accessToken: string }).accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // El registro público no asigna organismo: la sesión es válida, pero los reportes responden 403.
    const whileActive = await fetch(`${base}/api/reports/mi`, { headers });
    expect(whileActive.status).toBe(403);
    expect(await whileActive.json()).toEqual({ error: 'El usuario no tiene un organismo asignado' });

    expect((await post('logout', {}, headers)).status).toBe(204);
    const afterLogout = await fetch(`${base}/api/reports/mi`, { headers });
    expect(afterLogout.status).toBe(401);
    expect(await afterLogout.json()).toEqual({ error: 'Sesión inválida' });
  });
});

describe('HU-01 acceptance: input validation', () => {
  it('rejects empty and invalid registration fields', async () => {
    const empty = await post('register', {});
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({
      error: 'Datos de cuenta inválidos',
      fields: {
        displayName: 'El nombre debe tener entre 2 y 80 caracteres.',
        email: 'Introduce un correo electrónico válido.',
        password: registerPasswordError,
        confirmPassword: 'Las contraseñas no coinciden.',
      },
    });

    const blank = await post('register', { displayName: '   ', email: '   ', password: '   ', confirmPassword: '   ' });
    expect(blank.status).toBe(400);
    const blankBody = await blank.json() as { fields: Record<string, string> };
    expect(blankBody.fields.displayName).toBe('El nombre debe tener entre 2 y 80 caracteres.');
    expect(blankBody.fields.email).toBe('Introduce un correo electrónico válido.');
    expect(blankBody.fields.password).toBe(registerPasswordError);
    expect(blankBody.fields.confirmPassword).toBeUndefined();

    const spaces = ' '.repeat(12);
    const onlySpaces = await post('register', {
      displayName: 'Laura',
      email: 'laura-espacios@example.test',
      password: spaces,
      confirmPassword: spaces,
    });
    expect(onlySpaces.status).toBe(400);
    expect(await onlySpaces.json()).toEqual({
      error: 'Datos de cuenta inválidos',
      fields: { password: registerPasswordError },
    });

    const mismatched = await post('register', {
      displayName: 'Laura',
      email: 'correo-no-valido',
      password,
      confirmPassword: 'otra frase distinta',
    });
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toEqual({
      error: 'Datos de cuenta inválidos',
      fields: {
        email: 'Introduce un correo electrónico válido.',
        confirmPassword: 'Las contraseñas no coinciden.',
      },
    });

    const longPassword = 'x'.repeat(129);
    const tooLong = await post('register', {
      displayName: 'á'.repeat(81),
      email: `${'a'.repeat(250)}@x.co`,
      password: longPassword,
      confirmPassword: longPassword,
    });
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toEqual({
      error: 'Datos de cuenta inválidos',
      fields: {
        displayName: 'El nombre debe tener entre 2 y 80 caracteres.',
        email: 'Introduce un correo electrónico válido.',
        password: registerPasswordError,
      },
    });
  });

  it('rejects registration payloads that are not a JSON object', async () => {
    // express.json() solo admite objeto o array. null llega como JSON inválido
    // y no alcanza la validación de cuenta; un array sí, y se rechaza ahí.
    const nil = await post('register', null);
    expect(nil.status).toBe(400);
    expect(await nil.json()).toEqual({ error: 'JSON inválido' });

    const list = await post('register', []);
    expect(list.status).toBe(400);
    expect(await list.json()).toEqual({
      error: 'Datos de cuenta inválidos',
      fields: { displayName: 'Introduce los datos de la cuenta.' },
    });

    const malformed = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'JSON inválido' });
  });

  it('rejects empty and invalid login fields with the same error whether or not the account exists', async () => {
    await seedAccount('laura@example.test');
    const invalidEmail = { error: 'Datos de acceso inválidos', fields: { email: 'Introduce un correo electrónico válido.' } };

    const missing = await post('login', {});
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({
      error: 'Datos de acceso inválidos',
      fields: {
        email: 'Introduce un correo electrónico válido.',
        password: loginPasswordError,
      },
    });

    const existingSpaces = await post('login', { email: 'laura@example.test', password: ' '.repeat(12) });
    const unknownSpaces = await post('login', { email: 'nadie@example.test', password: ' '.repeat(12) });
    expect(existingSpaces.status).toBe(400);
    expect(unknownSpaces.status).toBe(400);
    expect(await existingSpaces.json()).toEqual(await unknownSpaces.json());
    expect(await post('login', { email: 'laura@example.test', password: '' }).then(async (response) => {
      expect(response.status).toBe(400);
      return response.json();
    })).toEqual({ error: 'Datos de acceso inválidos', fields: { password: loginPasswordError } });

    const unknownEmail = await post('login', { email: 'no-es-correo', password: '' });
    const existingBadEmail = await post('login', { email: 'laura example.test', password: 'clave-incorrecta' });
    expect(unknownEmail.status).toBe(400);
    expect(await unknownEmail.json()).toEqual({
      error: 'Datos de acceso inválidos',
      fields: {
        email: 'Introduce un correo electrónico válido.',
        password: loginPasswordError,
      },
    });
    expect(existingBadEmail.status).toBe(400);
    expect(await existingBadEmail.json()).toEqual(invalidEmail);

    const tooLong = await post('login', { email: 'laura@example.test', password: 'x'.repeat(129) });
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toEqual({ error: 'Datos de acceso inválidos', fields: { password: loginPasswordError } });
  });
});
