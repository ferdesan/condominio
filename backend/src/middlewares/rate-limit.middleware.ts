import type Redis from 'ioredis';
import rateLimit, {
  MemoryStore,
  type ClientRateLimitInfo,
  type IncrementResponse,
  type Options,
  type Store,
} from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { env, isTest } from '@/config/env';
import { getRedis } from '@/config/redis';
import { logger } from '@/config/logger';

/**
 * Store que compartilha a quota entre replicas via Redis e degrada para o store
 * em memoria quando o Redis nao esta disponivel.
 *
 * O `RedisStore` dispara `SCRIPT LOAD` ja no construtor e guarda as promises em
 * `incrementScriptSha` / `getScriptSha`. Com `enableOfflineQueue: false` essas
 * promises rejeitam de imediato quando o Redis esta fora e, por serem criadas
 * fora de qualquer `await`, derrubam o processo no boot. Por isso o store so e
 * instanciado com a conexao em `ready` e e descartado assim que ela cai, de
 * modo que a reconexao recarregue os scripts do zero.
 */
export class ResilientStore implements Store {
  private readonly memory = new MemoryStore();
  private redisStore: RedisStore | null = null;
  private options: Options | null = null;
  private usingRedis = false;

  constructor(
    /** Exposto pela interface `Store`: alimenta a checagem de dupla contagem. */
    readonly prefix: string,
    private readonly redis: Redis,
  ) {}

  init(options: Options): void {
    this.options = options;
    this.memory.init(options);
  }

  /** Store a ser usado agora; alterna conforme a saude da conexao. */
  private active(): Store {
    if (this.redis.status !== 'ready') {
      this.dropRedis('conexao indisponivel');
      return this.memory;
    }

    if (!this.redisStore) {
      const store = new RedisStore({
        prefix: this.prefix,
        sendCommand: (...args: string[]) =>
          this.redis.call(args[0], ...args.slice(1)) as Promise<never>,
      });

      // As promises de SHA precisam de um catch: sem ele, uma queda do Redis
      // entre o `ready` e o SCRIPT LOAD viraria unhandled rejection.
      const onScriptFailure = (error: Error): undefined => {
        this.dropRedis(error.message);
        return undefined;
      };
      void store.incrementScriptSha.catch(onScriptFailure);
      void store.getScriptSha.catch(onScriptFailure);

      if (this.options) store.init(this.options);
      this.redisStore = store;
      this.usingRedis = true;
      logger.info(`Rate limit usando Redis (${this.prefix})`);
    }

    return this.redisStore;
  }

  private dropRedis(reason: string): void {
    this.redisStore = null;
    if (this.usingRedis) {
      this.usingRedis = false;
      logger.warn(`Rate limit degradado para memoria (${this.prefix}): ${reason}`);
    }
  }

  /** Executa no Redis e cai para a memoria se o comando falhar. */
  private async run<T>(op: (store: Store) => Promise<T> | T): Promise<T> {
    const store = this.active();
    if (store === this.memory) return op(this.memory);

    try {
      return await op(store);
    } catch (error) {
      this.dropRedis((error as Error).message);
      return op(this.memory);
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    return this.run((store) => store.increment(key));
  }

  async decrement(key: string): Promise<void> {
    await this.run((store) => store.decrement(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.run((store) => store.resetKey(key));
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    return this.run((store) => store.get?.(key));
  }

  async resetAll(): Promise<void> {
    await this.run((store) => store.resetAll?.());
  }

  shutdown(): void {
    this.memory.shutdown();
    this.redisStore = null;
  }
}

/** Sem Redis configurado, o express-rate-limit usa o MemoryStore padrao. */
function buildStore(prefix: string): Store | undefined {
  const redis = getRedis();
  if (!redis) return undefined;
  return new ResilientStore(prefix, redis);
}

function createLimiter(options: Partial<Options> & { prefix: string }) {
  const { prefix, ...rest } = options;
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest,
    store: buildStore(prefix),
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Muitas requisicoes. Tente novamente em instantes.',
      },
    },
    ...rest,
  });
}

export const globalRateLimiter = createLimiter({ prefix: 'rl:global:' });

/** Tighter budget for credential endpoints (brute force mitigation). */
export const authRateLimiter = createLimiter({
  prefix: 'rl:auth:',
  limit: env.AUTH_RATE_LIMIT_MAX,
  windowMs: 15 * 60 * 1000,
  skipSuccessfulRequests: true,
});

export const writeRateLimiter = createLimiter({
  prefix: 'rl:write:',
  limit: Math.max(30, Math.floor(env.RATE_LIMIT_MAX / 3)),
});
