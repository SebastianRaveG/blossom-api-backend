/**
 * @module FranchiseController
 *
 * HTTP controller for the main franchise endpoint.
 * Responsibilities:
 *  1. Extract and validate path/query params
 *  2. Invoke the use case
 *  3. Shape the HTTP response
 *
 * It knows about HTTP (Request/Response) but knows NOTHING about
 * SQLite, axios, or any other infrastructure detail.
 */

import type { Request, Response, NextFunction } from 'express';
import { GetFranchiseDataUseCase } from '../../../application/usecases/GetFranchiseDataUseCase';
import { parseQueryParams } from '../validators/queryParams.validator';

export class FranchiseController {
  constructor(
    private readonly useCase: GetFranchiseDataUseCase
  ) {}

  /**
   * GET /api/:franchise/:version
   *
   * Query params:
   *  - metadata (required) JSON: { name?: string, id?: number }
   *  - config   (required) JSON: { baseUrl: string, apiKey?: string, headers?: object }
   */
  getCharacter = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { franchise, version } = req.params;

      // Validate query params (throws ValidationError on failure)
      const { metadata, config } = parseQueryParams(
        req.query as Record<string, unknown>
      );

      const result = await this.useCase.execute({
        franchise,
        version,
        metadata,
        config,
        requestId: req.requestId,
      });

      res
        .status(200)
        .set('X-Response-Time-Ms', String(result.responseTimeMs))
        .json(result.character);
    } catch (err) {
      next(err);
    }
  };
}
