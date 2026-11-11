import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AuthStore } from '../auth/store.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { accessClaims, jwtSecret } from '../middleware/auth.js';
import { validateLoginInput, validateRegisterInput } from '../validation/auth.js';
import { Role } from '../constants/roles.js';
import type { User } from '../types/user.js';

const cookieName = 'coordia.refreshToken';
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/auth' };

export function issueAccessToken(sid: string, user: User) {
  return jwt.sign({ sid, role: user.role, organizationId: user.organizationId }, jwtSecret(), {
    subject: user.id, expiresIn: '15m', algorithm: 'HS256',
  });
}

function refreshCookie(req: Request) {
  const entry = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return entry?.slice(cookieName.length + 1) ?? '';
}

export function authRouter(store: AuthStore) {
  const router = Router();
  const route = (handler: (req: Request, res: Response) => Promise<unknown> | unknown) =>
    (req: Request, res: Response, next: NextFunction) => { Promise.resolve().then(() => handler(req, res)).catch(next); };
  const limited = (operation: string, maximum: number) => (req: Request, res: Response, next: NextFunction) => {
    try {
      const buckets = [{ key: `${operation}:ip:${req.ip}`, maximum }];
      if (operation === 'login') {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        buckets.push({ key: `login:email:${email}`, maximum: 5 });
      }
      const retry = store.limit(buckets);
      if (retry) return res.set('Retry-After', String(retry)).status(429).json({ error: 'Demasiados intentos. Inténtalo más tarde.' });
      return next();
    } catch {
      return res.status(503).json({ error: 'Servicio de autenticación no disponible' });
    }
  };
  const deliver = (res: Response, session: { sid: string; user: User; refreshToken: string; expiresAt: number }) => {
    const accessToken = issueAccessToken(session.sid, session.user);
    res.cookie(cookieName, session.refreshToken, { ...cookieOptions, maxAge: session.expiresAt - Date.now() });
    return res.json({ accessToken, tokenType: 'Bearer', expiresIn: 900 });
  };
  let dummyHash: Promise<string> | undefined;

  router.post('/register', limited('register', 5), route(async (req, res) => {
    const result = validateRegisterInput(req.body);
    if (!result.success) return res.status(400).json({ error: 'Datos de cuenta inválidos', fields: result.errors });
    const { displayName, email, password } = result.data;
    const user: User & { createdAt: string } = {
      id: randomUUID(), displayName, email, role: Role.Guest, createdAt: new Date().toISOString(),
    };
    const passwordHash = await hashPassword(password);
    if (!store.addAccount(user, passwordHash)) return res.status(409).json({ error: 'El correo ya está registrado' });
    return res.status(201).json({ id: user.id, displayName, email });
  }));

  router.post('/login', limited('login', 30), route(async (req, res) => {
    const result = validateLoginInput(req.body);
    if (!result.success) return res.status(400).json({ error: 'Datos de acceso inválidos', fields: result.errors });
    const account = store.account(result.data.email);
    dummyHash ??= hashPassword('verification-only-passphrase');
    const valid = await verifyPassword(result.data.password, account?.passwordHash ?? await dummyHash);
    if (!account || !valid) return res.status(401).json({ error: 'Credenciales inválidas' });
    return deliver(res, store.createSession(account.user));
  }));

  router.post('/refresh', limited('refresh', 60), route((req, res) => {
    const session = store.rotate(refreshCookie(req));
    if (session === 'limited') return res.set('Retry-After', '900').status(429).json({ error: 'Demasiados intentos. Inténtalo más tarde.' });
    if (!session) return res.status(401).json({ error: 'Sesión inválida' });
    return deliver(res, session);
  }));

  router.post('/logout', route((req, res) => {
    let claims: ReturnType<typeof accessClaims>;
    try {
      const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
      if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });
      claims = accessClaims(match[1]);
    } catch {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    store.revoke(claims.sid, claims.userId);
    res.clearCookie(cookieName, cookieOptions);
    return res.status(204).send();
  }));

  router.use((_error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(503).json({ error: 'Servicio de autenticación no disponible' });
  });
  return router;
}
