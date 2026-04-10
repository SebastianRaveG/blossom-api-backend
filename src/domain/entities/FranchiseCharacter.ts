/**
 * @module FranchiseCharacter
 *
 * Core domain entity representing a character retrieved from any franchise.
 * This is the unified output format regardless of whether the source is
 * Pokémon or Digimon — the domain layer is agnostic of external APIs.
 */

/**
 * Supported franchise identifiers.
 * Adding a new franchise only requires a new adapter in the infrastructure layer.
 */
export type FranchiseName = 'pokemon' | 'digimon';

/**
 * The unified character entity returned by all franchise adapters.
 *
 * @property name       - Character name (always lowercase for consistency)
 * @property weight     - Weight in hectograms (Pokémon) or undefined (Digimon)
 * @property powers     - List of abilities, moves, or skills
 * @property evolutions - List of evolution/digivolution target names
 */
export interface FranchiseCharacter {
  name: string;
  weight?: number;
  powers: string[];
  evolutions: string[];
}

/**
 * Query parameters to identify a character.
 * Exactly one of `name` or `id` must be provided.
 */
export interface CharacterQuery {
  name?: string;
  id?: number;
}

/**
 * Configuration passed by the caller for each request.
 * Allows dynamic API targets without changing server code.
 */
export interface RequestConfig {
  /** Base URL for the external franchise API (e.g. https://pokeapi.co/api/v2) */
  baseUrl: string;
  /** Optional API key sent as a Bearer token or custom header */
  apiKey?: string;
  /** Optional extra headers to forward to the external API */
  headers?: Record<string, string>;
}
