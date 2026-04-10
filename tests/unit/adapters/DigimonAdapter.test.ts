/**
 * Unit tests for DigimonAdapter
 */

import axios from 'axios';
import { DigimonAdapter }          from '../../../src/infrastructure/adapters/DigimonAdapter';
import { CharacterNotFoundError }  from '../../../src/domain/errors/DomainError';
import { ExternalApiError }        from '../../../src/domain/errors/DomainError';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const config = { baseUrl: 'https://digi-api.com/api/v1' };

const digimonStub = {
  id:   1,
  name: 'Agumon',
  xAntibody: false,
  images: [],
  levels:     [{ id: 3, level: 'Rookie' }],
  types:      [{ id: 1, type: 'Vaccine' }],
  attributes: [],
  fields:     [],
  releaseDate: '1999-01-01',
  descriptions: [],
  skills: [
    { id: 1, skill: 'Pepper Breath',   translation: 'Baby Flame', description: 'Shoots a fireball' },
    { id: 2, skill: 'Claw Attack',     translation: 'Sharp Claw', description: 'Scratches' },
  ],
  digivolutions: [
    { id: 2, digimon: 'Greymon',   condition: 'Level', image: '', url: '' },
    { id: 3, digimon: 'MetalGreymon', condition: 'Level', image: '', url: '' },
  ],
  priorEvolutions: [
    { id: 4, digimon: 'Koromon', condition: '', image: '', url: '' },
  ],
};

describe('DigimonAdapter', () => {
  let adapter: DigimonAdapter;

  beforeEach(() => {
    adapter = new DigimonAdapter();
    jest.clearAllMocks();
  });

  it('fetches and normalizes a Digimon by name', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: digimonStub });

    const character = await adapter.getCharacter({ name: 'Agumon' }, config);

    expect(character).toEqual({
      name:       'Agumon',
      weight:     undefined,
      powers:     ['Pepper Breath', 'Claw Attack'],
      evolutions: ['Greymon', 'MetalGreymon'],
    });
  });

  it('fetches a Digimon by numeric ID', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: digimonStub });

    const character = await adapter.getCharacter({ id: 1 }, config);
    expect(character.name).toBe('Agumon');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://digi-api.com/api/v1/digimon/1',
      expect.any(Object)
    );
  });

  it('throws CharacterNotFoundError when API returns 404', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404, statusText: 'Not Found' },
    });
    Object.setPrototypeOf(notFoundError, axios.AxiosError.prototype);

    mockedAxios.get.mockRejectedValue(notFoundError);

    await expect(
      adapter.getCharacter({ name: 'FakeMon' }, config)
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
  });

  it('throws ExternalApiError on 500 errors', async () => {
    const serverError = Object.assign(new Error('Server Error'), {
      isAxiosError: true,
      response: { status: 500, statusText: 'Internal Server Error' },
    });
    Object.setPrototypeOf(serverError, axios.AxiosError.prototype);

    mockedAxios.get.mockRejectedValue(serverError);

    await expect(
      adapter.getCharacter({ id: 9999 }, config)
    ).rejects.toBeInstanceOf(ExternalApiError);
  });

  it('normalizes evolutions list correctly', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: digimonStub });
    const character = await adapter.getCharacter({ name: 'Agumon' }, config);
    expect(character.evolutions).toHaveLength(2);
    expect(character.evolutions[0]).toBe('Greymon');
  });

  it('returns empty powers and evolutions for a Digimon with no skills', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { ...digimonStub, skills: [], digivolutions: [] },
    });
    const character = await adapter.getCharacter({ name: 'Agumon' }, config);
    expect(character.powers).toEqual([]);
    expect(character.evolutions).toEqual([]);
  });
});
