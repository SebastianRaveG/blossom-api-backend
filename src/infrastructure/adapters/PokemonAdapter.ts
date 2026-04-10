/**
 * @module PokemonAdapter
 *
 * Infrastructure adapter that fetches Pokémon data from PokeAPI and normalizes
 * it into the domain's {@link FranchiseCharacter} entity.
 *
 * PokeAPI call chain:
 *  1. GET {baseUrl}/pokemon/{name|id}          → basic data + species URL
 *  2. GET {speciesUrl}                          → evolution-chain URL
 *  3. GET {evolutionChainUrl}                   → full evolution tree (parsed)
 *
 * The caller-supplied `config.baseUrl` is used for step 1.
 * Steps 2 & 3 use the absolute URLs returned by PokeAPI itself.
 */

import axios, { AxiosError } from 'axios';
import type { IFranchiseAdapter } from '../../domain/ports/IFranchiseAdapter';
import type {
  FranchiseCharacter,
  CharacterQuery,
  RequestConfig,
} from '../../domain/entities/FranchiseCharacter';
import {
  CharacterNotFoundError,
  ExternalApiError,
} from '../../domain/errors/DomainError';

// ─── Raw PokeAPI response shapes ──────────────────────────────────────────────

interface PokeApiPokemon {
  name: string;
  weight: number;                    // hectograms
  abilities: Array<{
    ability: { name: string };
    is_hidden: boolean;
  }>;
  types: Array<{
    type: { name: string };
  }>;
  species: { url: string };
}

interface PokeApiSpecies {
  evolution_chain: { url: string };
}

interface EvolutionChainLink {
  species: { name: string };
  evolves_to: EvolutionChainLink[];
}

interface PokeApiEvolutionChain {
  chain: EvolutionChainLink;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class PokemonAdapter implements IFranchiseAdapter {
  async getCharacter(
    query: CharacterQuery,
    config: RequestConfig
  ): Promise<FranchiseCharacter> {
    const identifier = (query.name?.toLowerCase() ?? query.id) as string | number;
    const baseUrl = config.baseUrl.replace(/\/$/, ''); // strip trailing slash

    const headers = this.buildHeaders(config);

    // ── Step 1: Fetch basic Pokémon data ────────────────────────────────────
    const pokemon = await this.fetchPokemon(baseUrl, identifier, headers);

    // ── Step 2: Fetch species to get evolution chain URL ─────────────────────
    // Step 3: Fetch evolution chain and flatten it
    const evolutions = await this.fetchEvolutions(pokemon.species.url, headers);

    // ── Normalize to domain entity ───────────────────────────────────────────
    return {
      name: pokemon.name,
      weight: pokemon.weight,
      powers: pokemon.abilities.map((a) => a.ability.name),
      evolutions: evolutions.filter((name) => name !== pokemon.name),
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildHeaders(config: RequestConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(config.headers ?? {}),
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    return headers;
  }

  private async fetchPokemon(
    baseUrl: string,
    identifier: string | number,
    headers: Record<string, string>
  ): Promise<PokeApiPokemon> {
    try {
      const { data } = await axios.get<PokeApiPokemon>(
        `${baseUrl}/pokemon/${identifier}`,
        { headers, timeout: 10_000 }
      );
      return data;
    } catch (err) {
      this.handleAxiosError(err, String(identifier), 'pokemon');
    }
  }

  private async fetchEvolutions(
    speciesUrl: string,
    headers: Record<string, string>
  ): Promise<string[]> {
    try {
      // Step 2: species endpoint → evolution chain URL
      const { data: species } = await axios.get<PokeApiSpecies>(speciesUrl, {
        headers,
        timeout: 10_000,
      });

      // Step 3: evolution chain endpoint
      const { data: evoChain } = await axios.get<PokeApiEvolutionChain>(
        species.evolution_chain.url,
        { headers, timeout: 10_000 }
      );

      return this.flattenChain(evoChain.chain);
    } catch {
      // Evolution data is "nice to have" — don't fail the whole request
      return [];
    }
  }

  /**
   * Recursively flatten the PokeAPI evolution chain tree into a list of names.
   * We follow the first branch at each level (primary evolution path).
   */
  private flattenChain(link: EvolutionChainLink): string[] {
    const names: string[] = [link.species.name];
    if (link.evolves_to.length > 0) {
      names.push(...this.flattenChain(link.evolves_to[0]));
    }
    return names;
  }

  /** Map Axios errors to domain errors. */
  private handleAxiosError(
    err: unknown,
    identifier: string,
    franchise: string
  ): never {
    if (err instanceof AxiosError) {
      if (err.response?.status === 404) {
        throw new CharacterNotFoundError(identifier, franchise);
      }
      throw new ExternalApiError(
        franchise,
        err.response?.statusText ?? err.message
      );
    }
    throw new ExternalApiError(franchise, String(err));
  }
}
