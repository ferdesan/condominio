import type Redis from 'ioredis';
import type { Options } from 'express-rate-limit';
import { ResilientStore } from '@/middlewares/rate-limit.middleware';

/** Redis minimo: responde SCRIPT LOAD e EVALSHA como o servidor real. */
class FakeRedis {
  status = 'connecting';
  commands: string[] = [];
  failure: Error | null = null;
  private hits = 0;

  async call(...args: unknown[]): Promise<unknown> {
    const command = String(args[0]).toUpperCase();
    this.commands.push(command);
    if (this.failure) throw this.failure;
    if (command === 'SCRIPT') return 'sha-fake';
    if (command === 'EVALSHA') {
      this.hits += 1;
      return [this.hits, 60_000];
    }
    return null;
  }
}

const options = { windowMs: 60_000 } as Options;

function build(): { store: ResilientStore; redis: FakeRedis } {
  const redis = new FakeRedis();
  const store = new ResilientStore('rl:test:', redis as unknown as Redis);
  store.init(options);
  return { store, redis };
}

describe('Store de rate limit resiliente', () => {
  let active: ResilientStore | null = null;

  afterEach(() => {
    active?.shutdown();
    active = null;
  });

  it('conta em memoria e nao toca no Redis enquanto a conexao nao esta pronta', async () => {
    const { store, redis } = build();
    active = store;

    // MemoryStore devolve o registro por referencia, entao o valor e lido na hora.
    const first = (await store.increment('ip-1')).totalHits;
    const second = (await store.increment('ip-1')).totalHits;

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(redis.commands).toHaveLength(0);
  });

  it('usa o Redis assim que a conexao fica pronta', async () => {
    const { store, redis } = build();
    active = store;
    redis.status = 'ready';

    const result = await store.increment('ip-1');

    expect(result.totalHits).toBe(1);
    expect(redis.commands).toContain('SCRIPT');
    expect(redis.commands).toContain('EVALSHA');
  });

  it('degrada para memoria quando um comando do Redis falha, sem propagar erro', async () => {
    const { store, redis } = build();
    active = store;
    redis.status = 'ready';
    redis.failure = new Error("Stream isn't writeable and enableOfflineQueue options is false");

    await expect(store.increment('ip-1')).resolves.toEqual(
      expect.objectContaining({ totalHits: 1 }),
    );
  });

  it('volta para memoria quando a conexao cai depois de ter funcionado', async () => {
    const { store, redis } = build();
    active = store;
    redis.status = 'ready';
    await store.increment('ip-1');

    redis.status = 'end';
    const afterDrop = await store.increment('ip-1');

    // Contador da memoria comeca do zero: a quota do Redis nao e herdada.
    expect(afterDrop.totalHits).toBe(1);
  });

  it('expoe o prefixo exigido pela interface Store', () => {
    const { store } = build();
    active = store;
    expect(store.prefix).toBe('rl:test:');
  });
});
