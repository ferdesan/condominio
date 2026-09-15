import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiDelete,
  apiGet,
  apiGetPaginated,
  apiPost,
  ApiError,
  tokenStorage,
} from './api';

/**
 * O transporte e testado contra um adaptador de HTTP falso, e nao contra um
 * duble do proprio modulo: sao justamente os interceptadores — injecao do
 * bearer, refresh, expiracao de sessao e normalizacao de erro — que precisam
 * rodar de verdade aqui (ADR-010).
 */

type Reply = { status: number; data?: unknown };
type Handler = (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>;

/** O adaptador e responsavel por decidir sucesso ou falha; o axios nao revalida. */
function settle(config: InternalAxiosRequestConfig, replied: Reply): Promise<AxiosResponse> {
  const response = {
    data: replied.data,
    status: replied.status,
    statusText: String(replied.status),
    headers: {},
    config,
  } as AxiosResponse;

  if (replied.status >= 200 && replied.status < 300) return Promise.resolve(response);
  return Promise.reject(
    new AxiosError(
      `Request failed with status code ${replied.status}`,
      String(replied.status),
      config,
      {},
      response,
    ),
  );
}

function adapterFrom(handler: Handler) {
  return async (config: InternalAxiosRequestConfig) => settle(config, await handler(config));
}

function authorizationOf(config: InternalAxiosRequestConfig): string | undefined {
  const headers = config.headers as unknown as {
    get?: (name: string) => unknown;
    Authorization?: unknown;
  };
  const value = headers.get?.('Authorization') ?? headers.Authorization;
  return value === undefined || value === null ? undefined : String(value);
}

const realApiAdapter = api.defaults.adapter;
const realAxiosAdapter = axios.defaults.adapter;

/** Requisicoes comuns passam pela instancia `api`. */
function onRequest(handler: Handler): void {
  api.defaults.adapter = adapterFrom(handler);
}

/** O refresh usa o axios global, entao tem adaptador proprio. */
function onRefresh(handler: Handler): void {
  axios.defaults.adapter = adapterFrom(handler);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  api.defaults.adapter = realApiAdapter;
  axios.defaults.adapter = realAxiosAdapter;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('normalizacao de erros', () => {
  it('UT-041: 422 vira ApiError com status, code e details preservados', async () => {
    const details = [{ field: 'document', message: 'Documento invalido.' }];
    onRequest(() => ({
      status: 422,
      data: { error: { code: 'VALIDATION_ERROR', message: 'Dados invalidos.', details } },
    }));

    const error = await apiPost('/condominiums', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).code).toBe('VALIDATION_ERROR');
    expect((error as ApiError).details).toEqual(details);
    expect((error as ApiError).fieldErrors).toEqual({ document: 'Documento invalido.' });
  });

  it('UT-045: 409 vira ApiError com status 409 e details indefinido', async () => {
    onRequest(() => ({
      status: 409,
      data: { error: { code: 'CONFLICT', message: 'Ja existe uma unidade com este numero.' } },
    }));

    const error = await apiPost('/units', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).details).toBeUndefined();
    expect((error as ApiError).fieldErrors).toEqual({});
  });

  it('UT-049: falha de rede sem resposta vira ApiError com status nao-HTTP', async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
    };

    const error = await apiGet('/units').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect((error as ApiError).message).toBe('Network Error');
  });

  it('UT-050: 500 preserva a mensagem do servidor em vez de uma generica', async () => {
    onRequest(() => ({
      status: 500,
      data: { error: { code: 'INTERNAL_ERROR', message: 'Falha ao gravar no banco.' } },
    }));

    const error = await apiGet('/units').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).message).toBe('Falha ao gravar no banco.');
  });
});

describe('desembrulho do envelope', () => {
  it('UT-042: apiDelete em 204 sem corpo resolve sem tentar interpretar payload', async () => {
    onRequest(() => ({ status: 204, data: undefined }));

    await expect(apiDelete('/units/unit-1')).resolves.toBeUndefined();
  });

  it('UT-043: apiGet devolve o conteudo de data', async () => {
    const unit = { id: 'unit-1', number: '101' };
    onRequest(() => ({ status: 200, data: { success: true, data: unit } }));

    await expect(apiGet('/units/unit-1')).resolves.toEqual(unit);
  });

  it('UT-044: apiGetPaginated devolve data e meta, com meta padrao quando omitido', async () => {
    const rows = [{ id: 'unit-1' }, { id: 'unit-2' }];
    const meta = {
      page: 2,
      perPage: 20,
      total: 42,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    };

    onRequest(() => ({ status: 200, data: { success: true, data: rows, meta } }));
    await expect(apiGetPaginated('/units')).resolves.toEqual({ data: rows, meta });

    onRequest(() => ({ status: 200, data: { success: true, data: rows } }));
    await expect(apiGetPaginated('/units')).resolves.toEqual({
      data: rows,
      meta: {
        page: 1,
        perPage: 2,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });
  });

  it('UT-052: apiPost devolve a entidade criada e nao trata 201 como erro', async () => {
    const created = { id: 'unit-9', number: '901' };
    onRequest(() => ({ status: 201, data: { success: true, data: created } }));

    await expect(apiPost('/units', { number: '901' })).resolves.toEqual(created);
  });
});

describe('autenticacao', () => {
  it('UT-048: a requisicao leva o bearer guardado no storage', async () => {
    tokenStorage.set('access-1', 'refresh-1');
    let seen: string | undefined;
    onRequest((config) => {
      seen = authorizationOf(config);
      return { status: 200, data: { success: true, data: null } };
    });

    await apiGet('/units');

    expect(seen).toBe('Bearer access-1');
  });

  it('UT-046: uma rajada de tres 401 dispara exatamente um refresh', async () => {
    tokenStorage.set('stale', 'refresh-1');
    let refreshCalls = 0;
    let dataCalls = 0;

    onRequest((config) => {
      dataCalls += 1;
      return authorizationOf(config) === 'Bearer fresh'
        ? { status: 200, data: { success: true, data: { ok: true } } }
        : { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Token expirado.' } } };
    });

    onRefresh(async () => {
      refreshCalls += 1;
      // Um round-trip real nao resolve no mesmo tick: e o que faz as tres
      // requisicoes compartilharem a mesma promessa.
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        status: 200,
        data: { success: true, data: { tokens: { accessToken: 'fresh', refreshToken: 'r2' } } },
      };
    });

    const results = await Promise.all([apiGet('/units'), apiGet('/units'), apiGet('/units')]);

    expect(refreshCalls).toBe(1);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    // Tres originais que falharam mais tres reexecucoes.
    expect(dataCalls).toBe(6);
  });

  it('UT-051: apos o refresh a requisicao e reexecutada uma vez, nao duas', async () => {
    tokenStorage.set('stale', 'refresh-1');
    const attempts: Array<string | undefined> = [];

    onRequest((config) => {
      const authorization = authorizationOf(config);
      attempts.push(authorization);
      return authorization === 'Bearer fresh'
        ? { status: 200, data: { success: true, data: { ok: true } } }
        : { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Token expirado.' } } };
    });

    onRefresh(() => ({
      status: 200,
      data: { success: true, data: { tokens: { accessToken: 'fresh', refreshToken: 'r2' } } },
    }));

    await expect(apiGet('/units')).resolves.toEqual({ ok: true });

    expect(attempts).toEqual(['Bearer stale', 'Bearer fresh']);
    expect(attempts).toHaveLength(2);
  });

  it('UT-047: um refresh malsucedido dispara auth:session-expired exatamente uma vez', async () => {
    tokenStorage.set('stale', 'refresh-1');
    const onExpired = vi.fn();
    window.addEventListener('auth:session-expired', onExpired);

    onRequest(() => ({
      status: 401,
      data: { error: { code: 'UNAUTHORIZED', message: 'Token expirado.' } },
    }));
    onRefresh(() => ({
      status: 401,
      data: { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh invalido.' } },
    }));

    await expect(apiGet('/units')).rejects.toBeInstanceOf(ApiError);

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(tokenStorage.accessToken).toBeNull();

    window.removeEventListener('auth:session-expired', onExpired);
  });
});

describe('corpo multipart', () => {
  /**
   * O envio de documento e a unica rota multipart do sistema, e o defeito mora
   * antes do transporte: o `transformRequest` do axios serializa um `FormData`
   * para JSON sempre que o cabecalho anuncia `application/json` — e a instancia
   * `api` anuncia, para todas as outras rotas. O que chega no servidor e um
   * corpo JSON, o multer nao encontra arquivo e a resposta e
   * `400 Envie o arquivo no campo "file".`
   */
  function documentoComArquivo(): FormData {
    const body = new FormData();
    body.append('file', new File(['conteudo'], 'ata.pdf', { type: 'application/pdf' }));
    body.append('title', 'Ata da assembleia');
    return body;
  }

  function capturaCorpo(): () => unknown {
    let sent: unknown;
    onRequest((config) => {
      sent = config.data;
      return { status: 201, data: { data: { id: 'doc-1' } } };
    });
    return () => sent;
  }

  it('UT-101: multipart declarado entrega o FormData intacto ao transporte', async () => {
    const corpo = capturaCorpo();

    await apiPost('/documents', documentoComArquivo(), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    expect(corpo()).toBeInstanceOf(FormData);
    expect((corpo() as FormData).get('title')).toBe('Ata da assembleia');
  });

  it('UT-102: sem o cabecalho o axios serializa o FormData para JSON', async () => {
    const corpo = capturaCorpo();

    await apiPost('/documents', documentoComArquivo());

    // Nao e preferencia de estilo: e exatamente o que quebra o upload. Este caso
    // existe para que uma atualizacao do axios que mude essa conversao apareca
    // aqui, e nao numa tela.
    expect(typeof corpo()).toBe('string');
  });
});
