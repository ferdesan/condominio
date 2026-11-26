import { DEFAULT_TIME_ZONE, resolveTimeZone, wallClockSlot } from '@/shared/utils/date.util';

describe('wallClockSlot', () => {
  // 28/11/2026 (sabado) 10:00 as 20:20 em Brasilia = 13:00 as 23:20 UTC.
  const startsAt = new Date('2026-11-28T13:00:00.000Z');
  const endsAt = new Date('2026-11-28T23:20:00.000Z');

  it('le o intervalo no relogio de Brasilia, qualquer que seja o fuso do processo', () => {
    expect(wallClockSlot(startsAt, endsAt, 'America/Sao_Paulo')).toEqual({
      weekday: 6,
      startMinutes: 10 * 60,
      endMinutes: 20 * 60 + 20,
    });
  });

  it('o mesmo instante em UTC daria 13:00 as 23:20 — o bug que fazia o servidor recusar', () => {
    expect(wallClockSlot(startsAt, endsAt, 'UTC')).toEqual({
      weekday: 6,
      startMinutes: 13 * 60,
      endMinutes: 23 * 60 + 20,
    });
  });

  it('termino no dia seguinte passa de 1440 minutos', () => {
    // 22:00 as 00:00 em Brasilia.
    const slot = wallClockSlot(
      new Date('2026-11-29T01:00:00.000Z'),
      new Date('2026-11-29T03:00:00.000Z'),
      'America/Sao_Paulo',
    );
    expect(slot).toEqual({ weekday: 6, startMinutes: 22 * 60, endMinutes: 1440 });
  });

  it('o dia da semana e o do fuso, nao o do processo', () => {
    // 23:30 de sexta em Brasilia ja e sabado em Toquio.
    const start = new Date('2026-11-28T02:30:00.000Z');
    const end = new Date('2026-11-28T03:00:00.000Z');
    expect(wallClockSlot(start, end, 'America/Sao_Paulo').weekday).toBe(5);
    expect(wallClockSlot(start, end, 'Asia/Tokyo').weekday).toBe(6);
  });
});

describe('resolveTimeZone', () => {
  it('aceita um fuso IANA valido', () => {
    expect(resolveTimeZone('Europe/Lisbon')).toBe('Europe/Lisbon');
  });

  it('cai no padrao quando ausente ou invalido', () => {
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone('Marte/Olympus')).toBe(DEFAULT_TIME_ZONE);
  });
});
