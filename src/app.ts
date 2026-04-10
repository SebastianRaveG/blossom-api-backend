/**
 * @module app
 *
 * Express application factory.
 *
 * This file wires together ALL layers of the application:
 *  - Domain entities and ports (interfaces)
 *  - Application use cases
 *  - Infrastructure implementations (adapters, DB, cache)
 *  - HTTP layer (controllers, middlewares, routes)
 *
 * Keeping this in a separate factory function (instead of module-level side
 * effects) makes the app fully testable — tests can call `createApp()` with
 * a test database or mock adapters without touching a real SQLite file.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

// ── Config ────────────────────────────────────────────────────────────────────
import { env } from './config/env';

// ── Domain ────────────────────────────────────────────────────────────────────
import type { FranchiseName } from './domain/entities/FranchiseCharacter';
import type { IFranchiseAdapter } from './domain/ports/IFranchiseAdapter';

// ── Application ───────────────────────────────────────────────────────────────
import { GetFranchiseDataUseCase } from './application/usecases/GetFranchiseDataUseCase';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { PokemonAdapter }               from './infrastructure/adapters/PokemonAdapter';
import { DigimonAdapter }               from './infrastructure/adapters/DigimonAdapter';
import { SQLiteLogRepository }          from './infrastructure/database/SQLiteLogRepository';
import { FranchiseController }          from './infrastructure/http/controllers/FranchiseController';
import { HealthController }             from './infrastructure/http/controllers/HealthController';
import { buildFranchiseRouter }         from './infrastructure/http/routes/franchise.routes';
import { requestIdMiddleware }          from './infrastructure/http/middlewares/requestId.middleware';
import { errorHandler }                 from './infrastructure/http/middlewares/errorHandler.middleware';
import { swaggerSpec }                  from './infrastructure/docs/swagger';

export interface AppDependencies {
  dbPath?: string;
}

export function createApp(deps: AppDependencies = {}): {
  app: express.Application;
  logRepo: SQLiteLogRepository;
} {
  const dbPath = deps.dbPath ?? env.DB_PATH;

  // ── Infrastructure instances ──────────────────────────────────────────────
  const logRepo = new SQLiteLogRepository(dbPath);

  // ── Franchise adapter registry ────────────────────────────────────────────
  const adapters = new Map<FranchiseName, IFranchiseAdapter>([
    ['pokemon', new PokemonAdapter()],
    ['digimon', new DigimonAdapter()],
  ]);

  // ── Use case ──────────────────────────────────────────────────────────────
  const useCase = new GetFranchiseDataUseCase(adapters, logRepo);

  // ── Controllers ───────────────────────────────────────────────────────────
  const franchiseCtrl = new FranchiseController(useCase);
  const healthCtrl    = new HealthController(logRepo);

  // ── Express app ───────────────────────────────────────────────────────────
  const app = express();

  // ── Global middlewares ────────────────────────────────────────────────────
  app.use(helmet());                    // Security headers
  app.use(cors());                      // CORS (all origins — tighten for prod)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestIdMiddleware);         // Assign X-Request-ID to every request

  if (env.NODE_ENV !== 'test') {
    // Concise request logging in dev, JSON in prod
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // ── Routes ────────────────────────────────────────────────────────────────
  app.get('/health', healthCtrl.check);

  // Swagger UI (PLUS: interactive API documentation)
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Blossom API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );

  // Serve the raw OpenAPI JSON spec
  app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

  // Franchise API routes
  app.use('/api', buildFranchiseRouter(franchiseCtrl, healthCtrl));

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  });

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler);

  return { app, logRepo };
}
