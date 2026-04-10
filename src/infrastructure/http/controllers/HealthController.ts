/**
 * @module HealthController
 *
 * Health-check and observability endpoints.
 *
 * GET /health         — liveness probe (always 200 if the server is up)
 * GET /api/logs       — paginated request logs (PLUS feature)
 */

import type { Request, Response, NextFunction } from 'express';
import type { ILogRepository } from '../../../domain/ports/ILogRepository';
import type { FranchiseName } from '../../../domain/entities/FranchiseCharacter';

export class HealthController {
  constructor(
    private readonly logRepo: ILogRepository,
    private readonly startTime: Date = new Date()
  ) {}

  /** GET /health */
  check = (_req: Request, res: Response): void => {
    res.status(200).json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      uptime:    `${Math.floor((Date.now() - this.startTime.getTime()) / 1_000)}s`,
      version:   process.env.npm_package_version ?? '1.0.0',
    });
  };

  /** GET /api/logs */
  getLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawLimit  = Number(req.query.limit);
      const limit     = Math.min(rawLimit > 0 ? rawLimit : 50, 200);
      const franchise = req.query.franchise as FranchiseName | undefined;

      const logs = franchise
        ? await this.logRepo.findByFranchise(franchise, limit)
        : await this.logRepo.findAll(limit);

      res.status(200).json({
        total: logs.length,
        limit,
        logs,
      });
    } catch (err) {
      next(err);
    }
  };
}
