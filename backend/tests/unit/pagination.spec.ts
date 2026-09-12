import { buildPaginationMeta, paginated } from '@/shared/types/pagination';

describe('Metadados de paginacao', () => {
  it('calcula o total de paginas e os indicadores de navegacao', () => {
    expect(buildPaginationMeta(137, 1, 20)).toEqual({
      page: 1,
      perPage: 20,
      total: 137,
      totalPages: 7,
      hasNext: true,
      hasPrevious: false,
    });

    expect(buildPaginationMeta(137, 7, 20)).toMatchObject({ hasNext: false, hasPrevious: true });
  });

  it('lida com colecoes vazias', () => {
    const result = paginated([], 0, 1, 20);

    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({ total: 0, totalPages: 0, hasNext: false });
  });
});
