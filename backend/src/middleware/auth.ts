// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../types/user.js';
import { Role } from '../constants/roles.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'insecure-dev-secret';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware que extrae el JWT (Bearer) y adjunta `req.user`.
 * Si no hay token, se asume el rol Guest.
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = { id: 'guest', email: 'guest@anonymous', role: Role.Guest };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as User;
    req.user = payload;
    next();
  } catch (e) {
    console.warn('Invalid JWT', e);
    return _res.status(401).json({ error: 'Invalid token' });
  }
}

