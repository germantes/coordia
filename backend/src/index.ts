import express, { type Application, type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import reportsRouter from './routes/reports.js';
import administrationRouter from './routes/administration.js';
import { AuthStore } from './auth/store.js';
import { authRouter } from './routes/auth.js';
import { jwtSecret } from './middleware/auth.js';

/** Crea y configura la aplicación Express. */
export function createServer(store = new AuthStore(process.env.AUTH_DB_PATH ?? '.data/auth.sqlite')): Application {
  jwtSecret();
  const app = express();

  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use('/api/auth', authRouter(store));
  app.use(authMiddleware(store));
  app.use('/api/reports', reportsRouter);
  app.use('/api', administrationRouter(store));

  const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'JSON inválido' });
    }

    console.error('Unhandled API error', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  };
  app.use(errorHandler);

  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4000);
  createServer().listen(port, () => console.log(`🚀 API listening on ${port}`));
}
