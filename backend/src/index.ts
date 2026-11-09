// src/index.ts
import express, { Application } from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import { fileURLToPath } from 'url';
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

  // Manejo de errores genéricos
  app.use((_err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT ?? 4000;
  createServer().listen(PORT, () => console.log(`🚀 API listening on ${PORT}`));
}
