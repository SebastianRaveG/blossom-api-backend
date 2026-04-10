/**
 * Unit tests for GetFranchiseDataUseCase
 *
 * All external dependencies (adapter, logRepo) are mocked so these
 * tests run instantly with zero I/O.
 */

import { GetFranchiseDataUseCase } from '../../../src/application/usecases/GetFranchiseDataUseCase';
import type { IFranchiseAdapter }  from '../../../src/domain/ports/IFranchiseAdapter';
import type { ILogRepository }     from '../../../src/domain/ports/ILogRepository';
import type { FranchiseCharacter } from '../../../src/domain/entities/FranchiseCharacter';
import { InvalidFranchiseError }   from '../../../src/domain/errors/DomainError';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockCharacter: FranchiseCharacter = {
  name:       'pikachu',
  weight:     60,
  powers:     ['static', 'lightning-rod'],
  evolutions: ['pichu', 'raichu'],
};

const baseInput = {
  franchise:  'pokemon',
  version:    'v1',
  metadata:   { name: 'pikachu' },
  config:     { baseUrl: 'https://pokeapi.co/api/v2' },
  requestId:  'test-uuid',
};

function makeAdapter(): jest.Mocked<IFranchiseAdapter> {
  return { getCharacter: jest.fn().mockResolvedValue(mockCharacter) };
}

function makeLogRepo(): jest.Mocked<ILogRepository> {
  return {
    save:            jest.fn().mockResolvedValue(undefined),
    findAll:         jest.fn().mockResolvedValue([]),
    findByFranchise: jest.fn().mockResolvedValue([]),
    findByRequestId: jest.fn().mockResolvedValue(null),
    clear:           jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GetFranchiseDataUseCase', () => {
  let adapter:  jest.Mocked<IFranchiseAdapter>;
  let logRepo:  jest.Mocked<ILogRepository>;
  let useCase:  GetFranchiseDataUseCase;

  beforeEach(() => {
    adapter = makeAdapter();
    logRepo = makeLogRepo();
    useCase = new GetFranchiseDataUseCase(
      new Map([['pokemon', adapter]]),
      logRepo,
    );
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it('returns character data from adapter', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.character).toEqual(mockCharacter);
    expect(adapter.getCharacter).toHaveBeenCalledTimes(1);
  });

  it('logs a success entry after successful fetch', async () => {
    await useCase.execute(baseInput);

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'test-uuid',
        franchise: 'pokemon',
        version:   'v1',
        status:    'success',
      })
    );
  });

  it('returns responseTimeMs as a non-negative number', async () => {
    const result = await useCase.execute(baseInput);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  // ── Error cases ─────────────────────────────────────────────────────────

  it('throws InvalidFranchiseError for unknown franchise', async () => {
    await expect(
      useCase.execute({ ...baseInput, franchise: 'naruto' })
    ).rejects.toThrow(InvalidFranchiseError);
  });

  it('logs an error entry when franchise is invalid', async () => {
    await useCase.execute({ ...baseInput, franchise: 'naruto' }).catch(() => {});

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    );
  });

  it('re-throws adapter errors and logs them', async () => {
    const adapterError = new Error('API down');
    adapter.getCharacter.mockRejectedValueOnce(adapterError);

    await expect(useCase.execute(baseInput)).rejects.toThrow('API down');

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status:       'error',
        errorMessage: 'API down',
      })
    );
  });

  it('does not crash when log repo save fails', async () => {
    logRepo.save.mockRejectedValueOnce(new Error('DB offline'));
    await expect(useCase.execute(baseInput)).resolves.toBeDefined();
  });

  it('normalizes franchise to lowercase', async () => {
    const upper = new GetFranchiseDataUseCase(
      new Map([['pokemon', adapter]]),
      logRepo,
    );
    const result = await upper.execute({ ...baseInput, franchise: 'POKEMON' });
    expect(result.character).toEqual(mockCharacter);
  });
});
