import { describe, expect, it } from 'vitest';
import { makeAvailabilityEntry } from '@/test/fixtures';
import type { AvailabilityEntry } from '@/types/api';
import {
  buildMonthGrid,
  MISSING_AREA_LABEL,
  MISSING_UNIT_LABEL,
  monthRange,
  toCalendarEntry,
  type CalendarDay,
} from './calendar-grid';

/**
 * Instante local -> ISO com fuso, que e a forma em que o servidor devolve.
 * Construir assim mantem os casos estaveis em qualquer fuso: o mesmo horario
 * local entra e sai, independentemente de onde o teste roda.
 */
function at(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function entry(overrides: Partial<AvailabilityEntry> = {}): AvailabilityEntry {
  return makeAvailabilityEntry({
    startsAt: at(2026, 3, 14, 18),
    endsAt: at(2026, 3, 14, 22),
    ...overrides,
  });
}

/** Todos os dias da grade, em ordem. */
function flatten(weeks: CalendarDay[][]): CalendarDay[] {
  return weeks.flat();
}

function dayOf(weeks: CalendarDay[][], day: number): CalendarDay {
  const found = flatten(weeks).find(
    (cell) => cell.inMonth && cell.date.getDate() === day,
  );
  if (!found) throw new Error(`Dia ${day} ausente da grade`);
  return found;
}

describe('Composicao do calendario', () => {
  it('UT-076: um mes que comeca numa quarta rende semanas de 7 dias com as bordas marcadas', () => {
    // Abril de 2026 comeca numa quarta-feira e tem 30 dias.
    //
    // Nota sobre o contrato: `_tests.md` descreve este caso como "6 semanas x 7
    // dias". Nao existe mes comecando na quarta que precise de seis semanas —
    // com a semana comecando no domingo sao 3 dias de folga mais 30 ou 31 do
    // mes, no maximo 34 celulas, que cabem em cinco semanas. O numero literal
    // tambem contradiz UT-080, que exige "exatamente 5 semanas" para um mes de
    // 31 dias comecando no domingo; das duas leituras so a de UT-080 fecha a
    // conta. A grade e minima, e o que este caso verifica e a forma: semanas de
    // sete dias e as bordas corretamente marcadas como fora do mes.
    const grid = buildMonthGrid(new Date(2026, 3, 1));

    expect(grid.weeks).toHaveLength(5);
    for (const week of grid.weeks) expect(week).toHaveLength(7);

    const days = flatten(grid.weeks);
    expect(days).toHaveLength(35);

    // Tres dias de folga na frente: 29, 30 e 31 de marco.
    const leading = days.slice(0, 3);
    expect(leading.every((cell) => !cell.inMonth)).toBe(true);
    expect(leading.map((cell) => cell.date.getDate())).toEqual([29, 30, 31]);

    // A grade comeca num domingo e o mes comeca na quarta.
    expect(days[0].date.getDay()).toBe(0);
    expect(days[3].inMonth).toBe(true);
    expect(days[3].date.getDate()).toBe(1);
    expect(days[3].date.getDay()).toBe(3);

    // Dois dias de folga no fim: 1 e 2 de maio.
    const trailing = days.slice(-2);
    expect(trailing.every((cell) => !cell.inMonth)).toBe(true);
    expect(trailing.map((cell) => cell.date.getDate())).toEqual([1, 2]);

    expect(days.filter((cell) => cell.inMonth)).toHaveLength(30);
  });

  it('UT-077: um mes sem entradas rende a grade cheia com todos os dias vazios', () => {
    const grid = buildMonthGrid(new Date(2026, 2, 1), []);
    const days = flatten(grid.weeks);

    expect(days).toHaveLength(35);
    expect(days.filter((cell) => cell.inMonth)).toHaveLength(31);
    for (const cell of days) {
      expect(cell.entries).toEqual([]);
      expect(cell.total).toBe(0);
      expect(cell.hiddenCount).toBe(0);
    }
  });

  it('UT-078: um dia acima do teto informa o teto e quantas sobraram', () => {
    const entries = Array.from({ length: 5 }, (_, index) =>
      entry({
        id: `reservation-${index + 1}`,
        startsAt: at(2026, 3, 14, 8 + index),
        endsAt: at(2026, 3, 14, 9 + index),
      }),
    );

    const grid = buildMonthGrid(new Date(2026, 2, 1), entries, { maxEntriesPerDay: 3 });
    const cell = dayOf(grid.weeks, 14);

    expect(cell.entries).toHaveLength(3);
    expect(cell.hiddenCount).toBe(2);
    expect(cell.total).toBe(5);
  });

  it('UT-079: uma entrada das 23:00 a 01:00 do dia seguinte aparece nos dois dias', () => {
    const crossing = entry({
      id: 'crossing',
      startsAt: at(2026, 3, 14, 23),
      endsAt: at(2026, 3, 15, 1),
    });

    const grid = buildMonthGrid(new Date(2026, 2, 1), [crossing]);

    expect(dayOf(grid.weeks, 14).entries.map((item) => item.id)).toEqual(['crossing']);
    expect(dayOf(grid.weeks, 15).entries.map((item) => item.id)).toEqual(['crossing']);

    // Terminar exatamente a meia-noite nao ocupa o dia seguinte: aquele
    // instante e o primeiro do proximo dia, e nao um minuto dele.
    const untilMidnight = entry({
      id: 'until-midnight',
      startsAt: at(2026, 3, 20, 22),
      endsAt: at(2026, 3, 21, 0),
    });
    const second = buildMonthGrid(new Date(2026, 2, 1), [untilMidnight]);

    expect(dayOf(second.weeks, 20).entries.map((item) => item.id)).toEqual(['until-midnight']);
    expect(dayOf(second.weeks, 21).entries).toEqual([]);
  });

  it('UT-080: fevereiro bissexto tem 29 dias; um mes de 31 dias iniciando no domingo tem 5 semanas', () => {
    // Fevereiro de 2024 comeca numa quinta e tem 29 dias.
    const leap = buildMonthGrid(new Date(2024, 1, 1));
    const leapDays = flatten(leap.weeks).filter((cell) => cell.inMonth);

    expect(leapDays).toHaveLength(29);
    expect(leapDays.at(-1)?.date.getDate()).toBe(29);
    // Fevereiro nao bissexto, para contraste.
    expect(
      flatten(buildMonthGrid(new Date(2026, 1, 1)).weeks).filter((cell) => cell.inMonth),
    ).toHaveLength(28);

    // Marco de 2026 comeca num domingo e tem 31 dias.
    const march = buildMonthGrid(new Date(2026, 2, 1));
    expect(march.weeks).toHaveLength(5);
    expect(flatten(march.weeks)[0].date.getDate()).toBe(1);
    expect(flatten(march.weeks).filter((cell) => cell.inMonth)).toHaveLength(31);

    // Um mes de 30 dias, para fechar a faixa de 28 a 31.
    expect(
      flatten(buildMonthGrid(new Date(2026, 3, 1)).weeks).filter((cell) => cell.inMonth),
    ).toHaveLength(30);
  });

  it('UT-081: as entradas sao agrupadas por dia preservando a ordem de inicio', () => {
    const entries = [
      entry({ id: 'noite', startsAt: at(2026, 3, 14, 20), endsAt: at(2026, 3, 14, 22) }),
      entry({ id: 'manha', startsAt: at(2026, 3, 14, 9), endsAt: at(2026, 3, 14, 11) }),
      entry({ id: 'tarde', startsAt: at(2026, 3, 14, 14), endsAt: at(2026, 3, 14, 16) }),
      entry({ id: 'outro-dia', startsAt: at(2026, 3, 20, 10), endsAt: at(2026, 3, 20, 12) }),
    ];

    const grid = buildMonthGrid(new Date(2026, 2, 1), entries, { maxEntriesPerDay: 10 });

    expect(dayOf(grid.weeks, 14).entries.map((item) => item.id)).toEqual([
      'manha',
      'tarde',
      'noite',
    ]);
    expect(dayOf(grid.weeks, 20).entries.map((item) => item.id)).toEqual(['outro-dia']);
  });

  it('UT-082: a projecao vira uma entrada com area, unidade, faixa de horario e status', () => {
    const mapped = toCalendarEntry(
      makeAvailabilityEntry({
        id: 'reservation-9',
        commonAreaId: 'area-2',
        commonAreaName: 'Churrasqueira',
        unitId: 'unit-4',
        unitNumber: '204',
        startsAt: at(2026, 3, 14, 18),
        endsAt: at(2026, 3, 14, 22, 30),
        status: 'CONFIRMED',
        requestedByName: 'Carlos Pereira',
      }),
    );

    expect(mapped).toMatchObject({
      id: 'reservation-9',
      commonAreaId: 'area-2',
      areaLabel: 'Churrasqueira',
      unitLabel: '204',
      status: 'CONFIRMED',
      requestedByName: 'Carlos Pereira',
      timeLabel: '18:00 - 22:30',
    });
    expect(mapped.startsAt).toBeInstanceOf(Date);
    expect(mapped.endsAt).toBeInstanceOf(Date);
  });

  it('UT-083: area sem nome recebe um rotulo em vez da palavra null', () => {
    const mapped = toCalendarEntry(
      makeAvailabilityEntry({ commonAreaName: null, unitNumber: null }),
    );

    expect(mapped.areaLabel).toBe(MISSING_AREA_LABEL);
    expect(mapped.areaLabel).not.toMatch(/null/i);
    expect(mapped.unitLabel).toBe(MISSING_UNIT_LABEL);
    expect(mapped.unitLabel).not.toMatch(/null/i);
  });

  it('UT-084: monthRange cobre do primeiro ao ultimo instante do mes', () => {
    const { from, to } = monthRange(new Date(2026, 2, 18, 13, 45));

    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(2);
    expect(from.getDate()).toBe(1);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(from.getSeconds()).toBe(0);
    expect(from.getMilliseconds()).toBe(0);

    expect(to.getMonth()).toBe(2);
    expect(to.getDate()).toBe(31);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
    expect(to.getSeconds()).toBe(59);
    expect(to.getMilliseconds()).toBe(999);
  });

  it('UT-085: a grade de marco nao e afetada por entradas de abril', () => {
    const entries = [
      entry({ id: 'marco', startsAt: at(2026, 3, 14, 18), endsAt: at(2026, 3, 14, 22) }),
      entry({ id: 'abril-1', startsAt: at(2026, 4, 1, 18), endsAt: at(2026, 4, 1, 22) }),
      entry({ id: 'abril-2', startsAt: at(2026, 4, 2, 18), endsAt: at(2026, 4, 2, 22) }),
    ];

    const grid = buildMonthGrid(new Date(2026, 2, 1), entries);
    const placed = flatten(grid.weeks).flatMap((cell) => cell.entries.map((item) => item.id));

    expect(placed).toEqual(['marco']);

    // Os dias de abril aparecem na grade como contexto, mas vazios.
    const april = flatten(grid.weeks).filter((cell) => !cell.inMonth);
    expect(april.every((cell) => cell.entries.length === 0)).toBe(true);
  });
});
