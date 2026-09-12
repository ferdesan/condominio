import type { Request } from 'express';
import { parseQueryOptions } from '@/shared/http/query-parser';

const makeRequest = (query: Record<string, unknown>): Request => ({ query }) as unknown as Request;

describe('Parser de query string', () => {
  it('aplica os padroes quando nada e informado', () => {
    const options = parseQueryOptions(makeRequest({}));

    expect(options).toMatchObject({ page: 1, perPage: 20, sortOrder: 'DESC', filters: {} });
    expect(options.search).toBeUndefined();
  });

  it('limita o tamanho da pagina para proteger o banco', () => {
    expect(parseQueryOptions(makeRequest({ perPage: '5000' })).perPage).toBe(200);
    expect(parseQueryOptions(makeRequest({ perPage: '-3' })).perPage).toBe(20);
    expect(parseQueryOptions(makeRequest({ page: 'abc' })).page).toBe(1);
  });

  it('aceita as variantes snake_case dos parametros', () => {
    const options = parseQueryOptions(
      makeRequest({ per_page: '30', sort_by: 'name', sort_order: 'asc', q: 'torre' }),
    );

    expect(options).toMatchObject({
      perPage: 30,
      sortBy: 'name',
      sortOrder: 'ASC',
      search: 'torre',
    });
  });

  it('transforma listas separadas por virgula em arrays de filtro', () => {
    const options = parseQueryOptions(makeRequest({ status: 'OPEN,IN_PROGRESS' }));

    expect(options.filters.status).toEqual(['OPEN', 'IN_PROGRESS']);
  });

  it('nao trata parametros reservados como filtro', () => {
    const options = parseQueryOptions(
      makeRequest({ page: '2', search: 'x', includeDeleted: 'true', condominiumId: 'abc' }),
    );

    expect(options.filters).toEqual({ condominiumId: 'abc' });
    expect(options.includeDeleted).toBe(true);
  });
});
