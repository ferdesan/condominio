import { describe, expect, it } from 'vitest';
import { MAX_PER_PAGE, toQueryParams, toSortOrder } from './query-params';

describe('toQueryParams', () => {
  it('UT-001: emite exatamente as quatro chaves informadas e nenhuma outra', () => {
    const query = toQueryParams({ page: 2, perPage: 20, sortBy: 'name', sortOrder: 'ASC' });

    expect(query).toEqual({ page: 2, perPage: 20, sortBy: 'name', sortOrder: 'ASC' });
    expect(Object.keys(query).sort()).toEqual(['page', 'perPage', 'sortBy', 'sortOrder']);
  });

  it('UT-005: omite filtro com valor vazio e preserva o valor "0"', () => {
    const query = toQueryParams({
      page: 1,
      perPage: 20,
      filters: { city: '', floor: '0' },
    });

    expect(query).not.toHaveProperty('city');
    expect(query.floor).toBe('0');
  });

  it('UT-006: serializa filtro em array como lista separada por virgula', () => {
    const query = toQueryParams({
      page: 1,
      perPage: 20,
      filters: { status: ['VACANT', 'OCCUPIED'] },
    });

    expect(query.status).toBe('VACANT,OCCUPIED');
  });

  it('UT-007: limita perPage ao maximo aceito pelo servidor', () => {
    expect(toQueryParams({ page: 1, perPage: 500 }).perPage).toBe(MAX_PER_PAGE);
    expect(MAX_PER_PAGE).toBe(200);
  });
});

describe('toSortOrder', () => {
  it('traduz o vocabulario da tabela para o da API', () => {
    expect(toSortOrder('asc')).toBe('ASC');
    expect(toSortOrder('desc')).toBe('DESC');
    expect(toSortOrder(undefined)).toBeUndefined();
  });
});
