/**
 * Integration tests for the franchise API endpoint.
 *
 * Uses supertest to make real HTTP requests through the full Express stack.
 * Mocks axios to avoid actual network calls to PokeAPI / DigiAPI.
 * Uses an in-memory SQLite path to avoid touching production data.
 */

import request from 'supertest';
import axios   from 'axios';
import path    from 'path';
import fs      from 'fs';
import { createApp } from '../../../src/app';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ─── Stubs ─────────────────────────────────────────────────────────────────────

const pokemonStub = {
  name:      'bulbasaur',
  weight:    69,
  abilities: [{ ability: { name: 'overgrow' }, is_hidden: false }],
  types:     [{ type: { name: 'grass' } }],
  species:   { url: 'https://pokeapi.co/api/v2/pokemon-species/1/' },
};
const speciesStub      = { evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' } };
const evoChainStub     = {
  chain: {
    species:    { name: 'bulbasaur' },
    evolves_to: [{
      species:    { name: 'ivysaur' },
      evolves_to: [{ species: { name: 'venusaur' }, evolves_to: [] }],
    }],
  },
};

const digimonStub = {
  id: 2, name: 'Gabumon', xAntibody: false,
  images: [], levels: [], types: [], attributes: [], fields: [],
  releaseDate: '', descriptions: [],
  skills:        [{ id: 1, skill: 'Blue Blaster', translation: '', description: '' }],
  digivolutions: [{ id: 3, digimon: 'Garurumon', condition: '', image: '', url: '' }],
  priorEvolutions: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DB_PATH = path.join('/tmp', `blossom-test-${Date.now()}.db`);

let app: ReturnType<typeof createApp>['app'];
let logRepo: ReturnType<typeof createApp>['logRepo'];

const META_POKEMON = encodeURIComponent(JSON.stringify({ name: 'bulbasaur' }));
const META_DIGI    = encodeURIComponent(JSON.stringify({ name: 'Gabumon' }));
const CONFIG_POKE  = encodeURIComponent(JSON.stringify({ baseUrl: 'https://pokeapi.co/api/v2' }));
const CONFIG_DIGI  = encodeURIComponent(JSON.stringify({ baseUrl: 'https://digi-api.com/api/v1' }));

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(() => {
  const result = createApp({ dbPath: DB_PATH });
  app     = result.app;
  logRepo = result.logRepo;
});

afterAll(() => {
  logRepo.close();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/:franchise/:version', () => {

  // ── Pokémon ───────────────────────────────────────────────────────────────

  describe('Pokémon franchise', () => {
    beforeEach(() => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: pokemonStub })
        .mockResolvedValueOnce({ data: speciesStub })
        .mockResolvedValueOnce({ data: evoChainStub });
    });

    it('returns 200 with normalized character data', async () => {
      const res = await request(app)
        .get(`/api/pokemon/v1?metadata=${META_POKEMON}&config=${CONFIG_POKE}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name:   'bulbasaur',
        weight: 69,
        powers: ['overgrow'],
      });
      expect(Array.isArray(res.body.evolutions)).toBe(true);
    });

    it('sets X-Request-ID header on response', async () => {
      const res = await request(app)
        .get(`/api/pokemon/v1?metadata=${META_POKEMON}&config=${CONFIG_POKE}`);

      expect(res.headers['x-request-id']).toBeDefined();
    });

  });

  // ── Digimon ───────────────────────────────────────────────────────────────

  describe('Digimon franchise', () => {
    it('returns 200 with normalized Digimon data', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: digimonStub });

      const res = await request(app)
        .get(`/api/digimon/v1?metadata=${META_DIGI}&config=${CONFIG_DIGI}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name:       'Gabumon',
        powers:     ['Blue Blaster'],
        evolutions: ['Garurumon'],
      });
      expect(res.body.weight).toBeUndefined();
    });
  });

  // ── Validation errors ─────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 when metadata param is missing', async () => {
      const res = await request(app)
        .get(`/api/pokemon/v1?config=${CONFIG_POKE}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when config param is missing', async () => {
      const res = await request(app)
        .get(`/api/pokemon/v1?metadata=${META_POKEMON}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for malformed JSON in metadata', async () => {
      const res = await request(app)
        .get(`/api/pokemon/v1?metadata=not-json&config=${CONFIG_POKE}`);

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid baseUrl in config', async () => {
      const badConfig = encodeURIComponent(JSON.stringify({ baseUrl: 'not-a-url' }));
      const res = await request(app)
        .get(`/api/pokemon/v1?metadata=${META_POKEMON}&config=${badConfig}`);

      expect(res.status).toBe(400);
    });
  });

  // ── Unknown franchise ─────────────────────────────────────────────────────

  it('returns 400 for unsupported franchise', async () => {
    const res = await request(app)
      .get(`/api/naruto/v1?metadata=${META_POKEMON}&config=${CONFIG_POKE}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FRANCHISE');
  });

  // ── 404 from external API ────────────────────────────────────────────────

  it('returns 404 when character is not found in external API', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404, statusText: 'Not Found' },
    });
    Object.setPrototypeOf(notFoundError, axios.AxiosError.prototype);
    mockedAxios.get.mockRejectedValueOnce(notFoundError);

    const badMeta = encodeURIComponent(JSON.stringify({ name: 'fakemon' }));
    const res     = await request(app)
      .get(`/api/pokemon/v1?metadata=${badMeta}&config=${CONFIG_POKE}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CHARACTER_NOT_FOUND');
  });
});

// ─── Health & Logs ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeDefined();
  });
});

describe('GET /api/logs', () => {
  it('returns log entries after a request', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: pokemonStub })
      .mockResolvedValueOnce({ data: speciesStub })
      .mockResolvedValueOnce({ data: evoChainStub });

    await request(app)
      .get(`/api/pokemon/v1?metadata=${META_POKEMON}&config=${CONFIG_POKE}`);

    const res = await request(app).get('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThan(0);
    expect(res.body.logs[0]).toHaveProperty('requestId');
    expect(res.body.logs[0]).toHaveProperty('franchise', 'pokemon');
  });

  it('supports filtering logs by franchise', async () => {
    const res = await request(app).get('/api/logs?franchise=pokemon');
    expect(res.status).toBe(200);
    res.body.logs.forEach((log: { franchise: string }) => {
      expect(log.franchise).toBe('pokemon');
    });
  });
});

describe('GET /docs', () => {
  it('serves Swagger UI', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
  });
});
