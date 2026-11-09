import express, { type Application, type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import reportsRouter from './routes/reports.js';
import administrationRouter from './routes/administration.js';

/** Crea y configura la aplicación Express. */
export function createServer(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/reports', reportsRouter);
  app.use('/api', administrationRouter);

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
