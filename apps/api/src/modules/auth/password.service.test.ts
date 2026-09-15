import { beforeAll, describe, expect, it } from 'vitest';
import { AppConfigService } from '../../common/config/app-config.service';
import { testEnvWith } from '../../testing/test-env';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeAll(async () => {
    service = new PasswordService(
      new AppConfigService(testEnvWith({ ARGON2_MEMORY_COST: '8192', ARGON2_TIME_COST: '2' })),
    );
    await service.onModuleInit();
  });

  it('hashes with argon2id and verifies the original secret', async () => {
    const hash = await service.hash('faithful8church');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await service.verify(hash, 'faithful8church')).toBe(true);
  });

  it('rejects an incorrect secret', async () => {
    const hash = await service.hash('faithful8church');
    expect(await service.verify(hash, 'faithful8churcH')).toBe(false);
  });

  it('produces a different hash for the same input due to salting', async () => {
    const first = await service.hash('faithful8church');
    const second = await service.hash('faithful8church');
    expect(first).not.toBe(second);
    expect(await service.verify(first, 'faithful8church')).toBe(true);
    expect(await service.verify(second, 'faithful8church')).toBe(true);
  });

  it('returns false instead of throwing for malformed hashes', async () => {
    expect(await service.verify('not-a-hash', 'faithful8church')).toBe(false);
  });

  it('performs a dummy verification path without revealing input validity', async () => {
    await expect(service.verifyAgainstDummy('some-candidate')).resolves.toBeUndefined();
  });
});
