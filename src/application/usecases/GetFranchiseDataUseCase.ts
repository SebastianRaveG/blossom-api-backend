/**
 * @module GetFranchiseDataUseCase
 *
 * The single application use case: given a franchise name, version, character
 * query and API config — return the unified character data.
 *
 * Responsibilities:
 *  1. Validate the franchise name against registered adapters
 *  2. Delegate to the correct franchise adapter
 *  3. Log every request (success or failure) to the repository
 *
 * This class has ZERO knowledge of HTTP, SQLite, or any external API.
 * It only depends on the two port interfaces defined in the domain layer.
 */

import type { IFranchiseAdapter } from '../../domain/ports/IFranchiseAdapter';
import type { ILogRepository } from '../../domain/ports/ILogRepository';
import type {
  FranchiseCharacter,
  CharacterQuery,
  RequestConfig,
  FranchiseName,
} from '../../domain/entities/FranchiseCharacter';
import { InvalidFranchiseError } from '../../domain/errors/DomainError';

export type { IFranchiseAdapter } from '../../domain/ports/IFranchiseAdapter';
export type { ILogRepository } from '../../domain/ports/ILogRepository';

export interface GetFranchiseDataInput {
  franchise: string;
  version: string;
  metadata: CharacterQuery;
  config: RequestConfig;
  requestId: string;
}

export interface GetFranchiseDataOutput {
  character: FranchiseCharacter;
  responseTimeMs: number;
}

export class GetFranchiseDataUseCase {
  /**
   * @param adapters - Map of franchise name → adapter (e.g. "pokemon" → PokemonAdapter)
   * @param logRepo  - Log repository for persisting request records
   */
  constructor(
    private readonly adapters: Map<FranchiseName, IFranchiseAdapter>,
    private readonly logRepo: ILogRepository,
  ) {}

  async execute(input: GetFranchiseDataInput): Promise<GetFranchiseDataOutput> {
    const startTime = Date.now();

    // ── 1. Validate franchise ──────────────────────────────────────────────
    const franchise = input.franchise.toLowerCase() as FranchiseName;
    const adapter = this.adapters.get(franchise);

    if (!adapter) {
      const err = new InvalidFranchiseError(input.franchise);
      await this.saveLog({
        requestId: input.requestId,
        franchise,
        version: input.version,
        metadata: JSON.stringify(input.metadata),
        status: 'error',
        responseTimeMs: Date.now() - startTime,
        errorMessage: err.message,
      });
      throw err;
    }

    // ── 2. Fetch from external API ─────────────────────────────────────────
    try {
      const character = await adapter.getCharacter(input.metadata, input.config);
      const responseTimeMs = Date.now() - startTime;

      // ── 3. Log success ─────────────────────────────────────────────────
      await this.saveLog({
        requestId: input.requestId,
        franchise,
        version: input.version,
        metadata: JSON.stringify(input.metadata),
        status: 'success',
        responseTimeMs,
      });

      return { character, responseTimeMs };
    } catch (error) {
      await this.saveLog({
        requestId: input.requestId,
        franchise,
        version: input.version,
        metadata: JSON.stringify(input.metadata),
        status: 'error',
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Fire-and-forget log persistence — errors are swallowed to avoid
   *  masking the real response error from the caller. */
  private async saveLog(
    entry: Omit<Parameters<ILogRepository['save']>[0], 'timestamp'>
  ): Promise<void> {
    try {
      await this.logRepo.save({
        ...entry,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Log errors must NEVER surface to the user
    }
  }
}

export type { FranchiseCharacter, CharacterQuery, RequestConfig, FranchiseName } from '../../domain/entities/FranchiseCharacter';
