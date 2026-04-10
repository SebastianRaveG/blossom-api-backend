/**
 * @module IFranchiseAdapter
 *
 * Port (interface) that every franchise adapter must implement.
 * Following the Dependency Inversion Principle, the application layer
 * depends on this abstraction — NOT on any concrete HTTP client or API.
 */

import type { FranchiseCharacter, CharacterQuery, RequestConfig } from '../entities/FranchiseCharacter';

export interface IFranchiseAdapter {
  /**
   * Fetch and normalize a character from the external franchise API.
   *
   * @param query  - Name or ID of the character to look up
   * @param config - Caller-supplied API configuration (baseUrl, apiKey, headers)
   * @returns A normalized {@link FranchiseCharacter}
   * @throws {@link CharacterNotFoundError} when the character doesn't exist
   * @throws {@link ExternalApiError}       when the API returns an unexpected error
   */
  getCharacter(
    query: CharacterQuery,
    config: RequestConfig
  ): Promise<FranchiseCharacter>;
}
