import type { DataSource } from 'typeorm';
import { withCashLock } from '@/modules/financial/cash-lock';
import { ConflictError } from '@/shared/errors';

/**
 * A trava so tem efeito no MySQL; os testes de integracao rodam em sql.js, que
 * nao tem `GET_LOCK`. Aqui se prova, com um DataSource falso, o que ela pede ao
 * banco — e a prova de concorrencia de verdade roda contra um MySQL real.
 */
function fakeDataSource(type: string, lockResult: number | null = 1) {
  const queries: Array<[string, unknown[]]> = [];
  const runners: Array<{ released: boolean }> = [];
  const dataSource = {
    options: { type },
    createQueryRunner: jest.fn(() => {
      const state = { released: false };
      runners.push(state);
      return {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn(async (sql: string, params: unknown[]) => {
          queries.push([sql, params]);
          return sql.includes('GET_LOCK') ? [{ ok: lockResult }] : [{}];
        }),
        release: jest.fn(async () => {
          state.released = true;
        }),
      };
    }),
  };
  return { dataSource: dataSource as unknown as DataSource, raw: dataSource, queries, runners };
}

const lockSql = (queries: Array<[string, unknown[]]>, kind: 'GET' | 'RELEASE') =>
  queries.filter(([sql]) => sql.includes(`${kind}_LOCK`)).map(([, params]) => params[0]);

describe('withCashLock', () => {
  it('pega a trava nomeada do condominio, roda e solta', async () => {
    const { dataSource, queries, runners } = fakeDataSource('mysql');

    const result = await withCashLock('cond-1', async () => 'feito', dataSource);

    expect(result).toBe('feito');
    expect(lockSql(queries, 'GET')).toEqual(['condominio:caixa:cond-1']);
    expect(lockSql(queries, 'RELEASE')).toEqual(['condominio:caixa:cond-1']);
    expect(runners[0].released).toBe(true);
  });

  it('solta a trava mesmo quando a operacao falha', async () => {
    const { dataSource, queries, runners } = fakeDataSource('mysql');

    await expect(
      withCashLock('cond-1', async () => Promise.reject(new Error('boom')), dataSource),
    ).rejects.toThrow('boom');

    expect(lockSql(queries, 'RELEASE')).toEqual(['condominio:caixa:cond-1']);
    expect(runners[0].released).toBe(true);
  });

  it('e reentrante: um fluxo que ja segura a trava nao a pede de novo', async () => {
    const { dataSource, queries, raw } = fakeDataSource('mysql');

    await withCashLock(
      'cond-1',
      () => withCashLock('cond-1', async () => 'interno', dataSource),
      dataSource,
    );

    expect(lockSql(queries, 'GET')).toEqual(['condominio:caixa:cond-1']);
    expect(raw.createQueryRunner).toHaveBeenCalledTimes(1);
  });

  it('trava varios condominios em ordem fixa e ignora vazios e repetidos', async () => {
    const { dataSource, queries } = fakeDataSource('mysql');

    await withCashLock(['cond-b', null, 'cond-a', 'cond-b', undefined], async () => 1, dataSource);

    expect(lockSql(queries, 'GET')).toEqual(['condominio:caixa:cond-a', 'condominio:caixa:cond-b']);
    expect(lockSql(queries, 'RELEASE')).toEqual([
      'condominio:caixa:cond-b',
      'condominio:caixa:cond-a',
    ]);
  });

  it('recusa com 409 quando a espera esgota, sem rodar a operacao', async () => {
    const { dataSource, runners } = fakeDataSource('mysql', 0);
    const fn = jest.fn();

    await expect(withCashLock('cond-1', fn, dataSource)).rejects.toBeInstanceOf(ConflictError);
    expect(fn).not.toHaveBeenCalled();
    expect(runners[0].released).toBe(true);
  });

  it('nao faz nada no sql.js, onde a conexao unica ja serializa', async () => {
    const { dataSource, raw } = fakeDataSource('sqljs');

    await expect(withCashLock('cond-1', async () => 'ok', dataSource)).resolves.toBe('ok');
    expect(raw.createQueryRunner).not.toHaveBeenCalled();
  });
});
