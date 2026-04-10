/**
 * Unit tests for query parameter validation
 */

import { parseQueryParams } from '../../../src/infrastructure/http/validators/queryParams.validator';
import { ValidationError }  from '../../../src/domain/errors/DomainError';

describe('parseQueryParams', () => {

  const validConfig   = JSON.stringify({ baseUrl: 'https://pokeapi.co/api/v2' });
  const validMetaName = JSON.stringify({ name: 'pikachu' });
  const validMetaId   = JSON.stringify({ id: 25 });

  // ── Happy paths ──────────────────────────────────────────────────────────

  it('parses metadata with name and config with baseUrl', () => {
    const result = parseQueryParams({
      metadata: validMetaName,
      config:   validConfig,
    });

    expect(result.metadata).toEqual({ name: 'pikachu' });
    expect(result.config).toEqual({ baseUrl: 'https://pokeapi.co/api/v2' });
  });

  it('parses metadata with numeric id', () => {
    const result = parseQueryParams({ metadata: validMetaId, config: validConfig });
    expect(result.metadata.id).toBe(25);
  });

  it('parses config with apiKey and headers', () => {
    const config = JSON.stringify({
      baseUrl: 'https://api.example.com',
      apiKey:  'secret',
      headers: { 'X-Custom': 'value' },
    });
    const result = parseQueryParams({ metadata: validMetaName, config });
    expect(result.config.apiKey).toBe('secret');
    expect(result.config.headers?.['X-Custom']).toBe('value');
  });

  // ── Missing parameters ────────────────────────────────────────────────────

  it('throws ValidationError when metadata is missing', () => {
    expect(() =>
      parseQueryParams({ config: validConfig })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when config is missing', () => {
    expect(() =>
      parseQueryParams({ metadata: validMetaName })
    ).toThrow(ValidationError);
  });

  // ── Invalid JSON ──────────────────────────────────────────────────────────

  it('throws ValidationError for invalid JSON in metadata', () => {
    expect(() =>
      parseQueryParams({ metadata: 'not-json', config: validConfig })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for invalid JSON in config', () => {
    expect(() =>
      parseQueryParams({ metadata: validMetaName, config: '{bad json' })
    ).toThrow(ValidationError);
  });

  // ── Schema violations ─────────────────────────────────────────────────────

  it('throws ValidationError when metadata has neither name nor id', () => {
    expect(() =>
      parseQueryParams({
        metadata: JSON.stringify({}),
        config:   validConfig,
      })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when config.baseUrl is not a valid URL', () => {
    expect(() =>
      parseQueryParams({
        metadata: validMetaName,
        config:   JSON.stringify({ baseUrl: 'not-a-url' }),
      })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when config.baseUrl is missing', () => {
    expect(() =>
      parseQueryParams({
        metadata: validMetaName,
        config:   JSON.stringify({ apiKey: 'key' }),
      })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when metadata.name is an empty string', () => {
    expect(() =>
      parseQueryParams({
        metadata: JSON.stringify({ name: '' }),
        config:   validConfig,
      })
    ).toThrow(ValidationError);
  });
});
