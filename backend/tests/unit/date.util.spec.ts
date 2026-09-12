import {
  addByRecurrence,
  currentReferenceMonth,
  daysBetween,
  isOverdue,
  overlaps,
  toIsoDate,
} from '@/shared/utils/date.util';

describe('Utilitarios de data', () => {
  it('detecta vencimento considerando o fim do dia', () => {
    expect(isOverdue('2020-01-01')).toBe(true);
    expect(isOverdue('2100-01-01')).toBe(false);

    const today = new Date();
    expect(isOverdue(toIsoDate(today), today)).toBe(false);
  });

  it('identifica sobreposicao de intervalos', () => {
    const base = new Date('2026-03-10T10:00:00Z');
    const end = new Date('2026-03-10T12:00:00Z');

    expect(overlaps(base, end, new Date('2026-03-10T11:00:00Z'), new Date('2026-03-10T13:00:00Z'))).toBe(true);
    // Intervalos encostados nao se sobrepoem.
    expect(overlaps(base, end, end, new Date('2026-03-10T14:00:00Z'))).toBe(false);
    expect(overlaps(base, end, new Date('2026-03-11T10:00:00Z'), new Date('2026-03-11T12:00:00Z'))).toBe(false);
  });

  it('calcula a proxima execucao conforme a recorrencia', () => {
    expect(addByRecurrence('2026-01-15', 'MONTHLY')).toBe('2026-02-15');
    expect(addByRecurrence('2026-01-15', 'QUARTERLY')).toBe('2026-04-15');
    expect(addByRecurrence('2026-01-15', 'SEMIANNUAL')).toBe('2026-07-15');
    expect(addByRecurrence('2026-01-15', 'ANNUAL')).toBe('2027-01-15');
    expect(addByRecurrence('2026-01-15', 'NONE')).toBeNull();
  });

  it('conta dias entre datas', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
  });

  it('formata a competencia corrente como AAAA-MM', () => {
    expect(currentReferenceMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
