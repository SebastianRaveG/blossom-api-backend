/**
 * Unit tests for PokemonAdapter
 *
 * Mocks axios so no real HTTP calls are made.
 */

import axios from 'axios';
import { PokemonAdapter }           from '../../../src/infrastructure/adapters/PokemonAdapter';
import { CharacterNotFoundError }   from '../../../src/domain/errors/DomainError';
import { ExternalApiError }         from '../../../src/domain/errors/DomainError';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const config = { baseUrl: 'https://pokeapi.co/api/v2' };

// Minimal PokeAPI response stubs
const pokemonStub = {
  name:      'pikachu',
  weight:    60,
  abilities: [
    { ability: { name: 'static' },        is_hidden: false },
    { ability: { name: 'lightning-rod' }, is_hidden: true },
  ],
  types:   [{ type: { name: 'electric' } }],
  species: { url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
};

const speciesStub = {
  evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/10/' },
};

const evolutionChainStub = {
  chain: {
    species: { name: 'pichu' },
    evolves_to: [{
      species: { name: 'pikachu' },
      evolves_to: [{
        species:    { name: 'raichu' },
        evolves_to: [],
      }],
    }],
  },
};

describe('PokemonAdapter', () => {
  let adapter: PokemonAdapter;

  beforeEach(() => {
    adapter = new PokemonAdapter();
    jest.clearAllMocks();
  });

  it('fetches and normalizes a Pokémon by name', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: pokemonStub })
      .mockResolvedValueOnce({ data: speciesStub })
      .mockResolvedValueOnce({ data: evolutionChainStub });

    const character = await adapter.getCharacter({ name: 'pikachu' }, config);

    expect(character).toEqual({
      name:       'pikachu',
      weight:     60,
      powers:     ['static', 'lightning-rod'],
      evolutions: ['pichu', 'raichu'],    // excludes 'pikachu' itself
    });
  });

  it('fetches by numeric ID', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: pokemonStub })
      .mockResolvedValueOnce({ data: speciesStub })
      .mockResolvedValueOnce({ data: evolutionChainStub });

    const character = await adapter.getCharacter({ id: 25 }, config);
    expect(character.name).toBe('pikachu');

    // Should call `/pokemon/25`
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://pokeapi.co/api/v2/pokemon/25',
      expect.any(Object)
    );
  });

  it('throws CharacterNotFoundError when API returns 404', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404, statusText: 'Not Found' },
    });
    Object.setPrototypeOf(notFoundError, axios.AxiosError.prototype);

    mockedAxios.get.mockRejectedValueOnce(notFoundError);

    await expect(
      adapter.getCharacter({ name: 'doesnotexist' }, config)
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
  });

  it('throws ExternalApiError on non-404 API errors', async () => {
    const serverError = Object.assign(new Error('Server Error'), {
      isAxiosError: true,
      response: { status: 500, statusText: 'Internal Server Error' },
    });
    Object.setPrototypeOf(serverError, axios.AxiosError.prototype);

    mockedAxios.get.mockRejectedValueOnce(serverError);

    await expect(
      adapter.getCharacter({ name: 'pikachu' }, config)
    ).rejects.toBeInstanceOf(ExternalApiError);
  });

  it('returns empty evolutions array if evolution chain request fails', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: pokemonStub })
      .mockRejectedValueOnce(new Error('Evolution API down'));   // species call fails

    const character = await adapter.getCharacter({ name: 'pikachu' }, config);
    expect(character.evolutions).toEqual([]);
    expect(character.powers).toEqual(['static', 'lightning-rod']);
  });

  it('strips trailing slash from baseUrl', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: pokemonStub })
      .mockResolvedValueOnce({ data: speciesStub })
      .mockResolvedValueOnce({ data: evolutionChainStub });

    await adapter.getCharacter(
      { name: 'pikachu' },
      { baseUrl: 'https://pokeapi.co/api/v2/' }   // trailing slash
    );

    const url = mockedAxios.get.mock.calls[0][0];
    expect(url).not.toContain('//pokemon');
  });

  it('forwards apiKey as Authorization header', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: pokemonStub })
      .mockResolvedValueOnce({ data: speciesStub })
      .mockResolvedValueOnce({ data: evolutionChainStub });

    await adapter.getCharacter(
      { name: 'pikachu' },
      { baseUrl: 'https://pokeapi.co/api/v2', apiKey: 'secret-key' }
    );

    const headers = mockedAxios.get.mock.calls[0][1]?.headers;
    expect(headers?.Authorization).toBe('Bearer secret-key');
  });
});
