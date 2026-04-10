/**
 * @module franchise.routes
 *
 * Route definitions for franchise and logs endpoints.
 */

import { Router } from 'express';
import { FranchiseController } from '../controllers/FranchiseController';
import { HealthController } from '../controllers/HealthController';
import { rateLimiter } from '../middlewares/rateLimiter';

export function buildFranchiseRouter(
  franchiseCtrl: FranchiseController,
  healthCtrl: HealthController
): Router {
  const router = Router();

  /**
   * @openapi
   * /api/{franchise}/{version}:
   *   get:
   *     summary: Get character data for a franchise
   *     tags: [Franchise]
   *     parameters:
   *       - in: path
   *         name: franchise
   *         required: true
   *         schema:
   *           type: string
   *           enum: [pokemon, digimon]
   *       - in: path
   *         name: version
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: metadata
   *         required: true
   *         description: JSON object with "name" or "id"
   *         schema:
   *           type: string
   *       - in: query
   *         name: config
   *         required: true
   *         description: JSON object with "baseUrl" (required), "apiKey" and "headers" (optional)
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Character data
   *       400:
   *         description: Validation error
   *       404:
   *         description: Character not found
   *       429:
   *         description: Rate limit exceeded
   *       502:
   *         description: External API error
   */
  router.get(
    '/:franchise/:version',
    rateLimiter,
    franchiseCtrl.getCharacter
  );

  /**
   * @openapi
   * /api/logs:
   *   get:
   *     summary: Retrieve request logs
   *     tags: [Logs]
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: franchise
   *         schema:
   *           type: string
   *           enum: [pokemon, digimon]
   *     responses:
   *       200:
   *         description: List of log entries
   */
  router.get('/logs', healthCtrl.getLogs);

  return router;
}
