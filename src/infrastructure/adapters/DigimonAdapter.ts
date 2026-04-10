/**
 * @module DigimonAdapter
 *
 * Infrastructure adapter that fetches Digimon data from digi-api.com and
 * normalizes it into the domain's {@link FranchiseCharacter} entity.
 *
 * Default API base URL (provided by caller in config.baseUrl):
 *   https://digi-api.com/api/v1
 *
 * Endpoint used:
 *   GET {baseUrl}/digimon/{name|id}
 *
 * digi-api.com response schema:
 * {
 *   id: number,
 *   name: string,
 *   skills: [{ skill: string, ... }],
 *   digivolutions: [{ digimon: string, ... }],
 *   priorEvolutions: [{ digimon: string, ... }]
 * }
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

// ─── Raw digi-api.com response shapes ────────────────────────────────────────

interface DigiApiSkill {
  id: number;
  skill: string;
  translation: string;
  description: string;
}

interface DigiApiEvolution {
  id: number;
  digimon: string;
  condition: string;
  image: string;
  url: string;
}

interface DigiApiDigimon {
  id: number;
  name: string;
  xAntibody: boolean;
  images: Array<{ href: string; transparent: boolean }>;
  levels: Array<{ id: number; level: string }>;
  types: Array<{ id: number; type: string }>;
  attributes: Array<{ id: number; attribute: string }>;
  fields: Array<{ id: number; field: string; image: string }>;
  releaseDate: string;
  descriptions: Array<{ origin: string; language: string; description: string }>;
  skills: DigiApiSkill[];
  digivolutions: DigiApiEvolution[];
  priorEvolutions: DigiApiEvolution[];
}

// digi-api.com sometimes wraps lists in a paginated envelope
interface DigiApiListResponse {
  content: Array<{ id: number; name: string; image: string; href: string }>;
  pageable: unknown;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class DigimonAdapter implements IFranchiseAdapter {
  async getCharacter(
    query: CharacterQuery,
    config: RequestConfig
  ): Promise<FranchiseCharacter> {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const headers = this.buildHeaders(config);

    let digimon: DigiApiDigimon;

    if (query.id !== undefined) {
      digimon = await this.fetchById(baseUrl, query.id, headers);
    } else if (query.name) {
      digimon = await this.fetchByName(baseUrl, query.name, headers);
    } else {
      throw new ExternalApiError('digimon', 'Either name or id must be provided');
    }

    return this.normalize(digimon);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

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

  private async fetchById(
    baseUrl: string,
    id: number,
    headers: Record<string, string>
  ): Promise<DigiApiDigimon> {
    try {
      const { data } = await axios.get<DigiApiDigimon>(
        `${baseUrl}/digimon/${id}`,
        { headers, timeout: 10_000 }
      );
      return data;
    } catch (err) {
      this.handleAxiosError(err, String(id));
    }
  }

  private async fetchByName(
    baseUrl: string,
    name: string,
    headers: Record<string, string>
  ): Promise<DigiApiDigimon> {
    try {
      // digi-api.com supports direct lookup by name
      const { data } = await axios.get<DigiApiDigimon>(
        `${baseUrl}/digimon/${encodeURIComponent(name)}`,
        { headers, timeout: 10_000 }
      );
      return data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        // Fallback: search in listing
        return this.searchByName(baseUrl, name, headers);
      }
      this.handleAxiosError(err, name);
    }
  }

  /**
   * Fallback search strategy: query the paginated list endpoint
   * and then fetch the full record for the matching entry.
   */
  private async searchByName(
    baseUrl: string,
    name: string,
    headers: Record<string, string>
  ): Promise<DigiApiDigimon> {
    try {
      const { data } = await axios.get<DigiApiListResponse>(
        `${baseUrl}/digimon`,
        {
          headers,
          params: { name: name.toLowerCase(), pageSize: 10 },
          timeout: 10_000,
        }
      );

      const match = data.content?.find(
        (d) => d.name.toLowerCase() === name.toLowerCase()
      );

      if (!match) {
        throw new CharacterNotFoundError(name, 'digimon');
      }

      const { data: fullDigimon } = await axios.get<DigiApiDigimon>(
        `${baseUrl}/digimon/${match.id}`,
        { headers, timeout: 10_000 }
      );
      return fullDigimon;
    } catch (err) {
      if (err instanceof CharacterNotFoundError) throw err;
      this.handleAxiosError(err, name);
    }
  }

  /** Map the raw digi-api.com response to our unified domain entity. */
  private normalize(digimon: DigiApiDigimon): FranchiseCharacter {
    return {
      name: digimon.name,
      // Digimon API doesn't provide weight — we return undefined
      weight: undefined,
      powers: digimon.skills.map((s) => s.skill),
      evolutions: digimon.digivolutions.map((e) => e.digimon),
    };
  }

  /** Map Axios errors to domain errors. */
  private handleAxiosError(err: unknown, identifier: string): never {
    if (err instanceof AxiosError) {
      if (err.response?.status === 404) {
        throw new CharacterNotFoundError(identifier, 'digimon');
      }
      throw new ExternalApiError(
        'digimon',
        err.response?.statusText ?? err.message
      );
    }
    throw new ExternalApiError('digimon', String(err));
  }
}
