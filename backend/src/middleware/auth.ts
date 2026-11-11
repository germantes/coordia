import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '../types/user.js';
import { Role } from '../constants/roles.js';
import type { AuthStore } from '../auth/store.js';

declare global {
  namespace Express {
    interface Request { user?: User; sessionId?: string }
  }
}

export function jwtSecret() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET es obligatorio en producción');
  return process.env.JWT_SECRET ?? 'insecure-dev-secret';
}

export function accessClaims(token: string) {
  const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string'
    || typeof payload.exp !== 'number') throw new Error('Token sin sesión');
  return { userId: payload.sub, sid: payload.sid };
}

export function authMiddleware(store: AuthStore) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      req.user = { id: 'guest', email: 'guest@anonymous', role: Role.Guest };
      return next();
    }
    let claims: ReturnType<typeof accessClaims>;
    try {
      const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization);
      if (!match) throw new Error('Cabecera inválida');
      claims = accessClaims(match[1]);
    } catch {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    try {
      const user = store.activeSession(claims.sid);
      if (!user || user.id !== claims.userId) return res.status(401).json({ error: 'Sesión inválida' });
      req.user = user;
      req.sessionId = claims.sid;
      return next();
    } catch {
      return res.status(503).json({ error: 'Servicio de sesiones no disponible' });
    }
  };
}
