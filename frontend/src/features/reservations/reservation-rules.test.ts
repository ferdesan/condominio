import { describe, expect, it } from 'vitest';
import { makeCommonArea } from '@/test/fixtures';
import type { CommonArea } from '@/types/api';
import {
  buildReservationSchema,
  checkReservationRules,
  decisionSchema,
  DECISION_REASON_MAX,
  type ReservationFormValues,
} from './reservation-rules';

/**
 * Instante de referencia de todos os casos: terca, 10/03/2026, meio-dia, hora
 * local — o mesmo fuso em que o formulario e o servidor comparam a janela de
 * funcionamento (ADR-011).
 */
const NOW = new Date('2026-03-10T12:00:00');

/**
 * Area sem nenhuma restricao ligada, para isolar uma regra por vez. Cada caso
 * religa so o parametro que esta medindo.
 */
function permissiveArea(overrides: Partial<CommonArea> = {}): CommonArea {
  return makeCommonArea({
    opensAt: '00:00',
    closesAt: '00:00',
    availableWeekdays: null,
    minHours: 0,
    maxHours: 0,
    capacity: 0,
    advanceBookingDays: 365,
    minIntervalDays: 0,
    ...overrides,
  });
}

function values(
  startsAt: string,
  endsAt: string,
  guestsCount = '0',
): Pick<ReservationFormValues, 'startsAt' | 'endsAt' | 'guestsCount'> {
  return { startsAt, endsAt, guestsCount };
}

/** So as mensagens, que e o que o usuario ve. */
function messages(
  input: Pick<ReservationFormValues, 'startsAt' | 'endsAt' | 'guestsCount'>,
  area: CommonArea | null,
): string[] {
  return checkReservationRules(input, area, NOW).map((issue) => issue.message);
}

describe('Regras locais de reserva', () => {
  it('UT-059: uma reserva dentro de todas as restrições da área passa sem apontamentos', () => {
    // Sabado, 18h as 22h: 4h de duracao, dentro de 08:00-22:00, 30 de 50
    // convidados, quatro dias a frente de um limite de 60.
    const area = makeCommonArea();
    const issues = checkReservationRules(
      values('2026-03-14T18:00', '2026-03-14T22:00', '30'),
      area,
      NOW,
    );

    expect(issues).toEqual([]);
  });

  it('UT-060: término igual ao início falha no campo endsAt; um minuto depois passa', () => {
    const area = permissiveArea();

    const equal = checkReservationRules(values('2026-03-14T18:00', '2026-03-14T18:00'), area, NOW);
    expect(equal).toEqual([
      { field: 'endsAt', message: 'O término deve ser posterior ao início.' },
    ]);

    expect(
      checkReservationRules(values('2026-03-14T18:00', '2026-03-14T18:01'), area, NOW),
    ).toEqual([]);
  });

  it('UT-061: início um minuto no passado falha; um minuto a frente passa', () => {
    const area = permissiveArea();

    expect(messages(values('2026-03-10T11:59', '2026-03-10T13:00'), area)).toEqual([
      'Não e possível reservar uma data no passado.',
    ]);

    expect(messages(values('2026-03-10T12:01', '2026-03-10T13:00'), area)).toEqual([]);
  });

  it('UT-062: com advanceBookingDays 30, exatamente 30 dias a frente passa e 31 falha', () => {
    const area = permissiveArea({ advanceBookingDays: 30 });

    expect(messages(values('2026-04-09T12:00', '2026-04-09T13:00'), area)).toEqual([]);

    expect(messages(values('2026-04-10T12:00', '2026-04-10T13:00'), area)).toEqual([
      'Reservas podem ser feitas com no máximo 30 dias de antecedência.',
    ]);
  });

  it('UT-063: com minHours 2, exatamente 2h passa e 1h59 falha', () => {
    const area = permissiveArea({ minHours: 2 });

    expect(messages(values('2026-03-14T18:00', '2026-03-14T20:00'), area)).toEqual([]);

    expect(messages(values('2026-03-14T18:00', '2026-03-14T19:59'), area)).toEqual([
      'A reserva mínima para esta área e de 2h.',
    ]);
  });

  it('UT-064: com maxHours 6, exatamente 6h passa e 6h01 falha', () => {
    const area = permissiveArea({ maxHours: 6 });

    expect(messages(values('2026-03-14T12:00', '2026-03-14T18:00'), area)).toEqual([]);

    expect(messages(values('2026-03-14T12:00', '2026-03-14T18:01'), area)).toEqual([
      'A reserva máxima para esta área e de 6h.',
    ]);
  });

  it('UT-065: com availableWeekdays [0,6], sábado passa e quarta falha', () => {
    const area = permissiveArea({ availableWeekdays: [0, 6] });

    // 14/03/2026 e sabado; 11/03/2026 e quarta.
    expect(messages(values('2026-03-14T18:00', '2026-03-14T20:00'), area)).toEqual([]);

    expect(messages(values('2026-03-11T18:00', '2026-03-11T20:00'), area)).toEqual([
      'A área comum não esta disponível neste dia da semana.',
    ]);
  });

  it('UT-066: com janela 08:00-22:00, 08:00 as 22:00 passa; 07:59 e 22:01 falham', () => {
    const area = permissiveArea({ opensAt: '08:00', closesAt: '22:00' });
    const window = 'Reservas permitidas somente entre 08:00 e 22:00.';

    expect(messages(values('2026-03-14T08:00', '2026-03-14T22:00'), area)).toEqual([]);

    expect(messages(values('2026-03-14T07:59', '2026-03-14T22:00'), area)).toEqual([window]);

    expect(messages(values('2026-03-14T08:00', '2026-03-14T22:01'), area)).toEqual([window]);
  });

  it('UT-067: com capacity 50, 50 convidados passam e 51 falham; capacity 0 não limita', () => {
    const area = permissiveArea({ capacity: 50 });

    expect(messages(values('2026-03-14T18:00', '2026-03-14T20:00', '50'), area)).toEqual([]);

    expect(messages(values('2026-03-14T18:00', '2026-03-14T20:00', '51'), area)).toEqual([
      'A área comporta no máximo 50 pessoas.',
    ]);

    const unlimited = permissiveArea({ capacity: 0 });
    expect(messages(values('2026-03-14T18:00', '2026-03-14T20:00', '9999'), unlimited)).toEqual([]);
  });

  it('UT-068: motivo de decisao com 255 caracteres passa e com 256 falha', () => {
    expect(decisionSchema.safeParse({ reason: 'a'.repeat(DECISION_REASON_MAX) }).success).toBe(
      true,
    );

    const tooLong = decisionSchema.safeParse({ reason: 'a'.repeat(DECISION_REASON_MAX + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe('Use no máximo 255 caracteres.');
  });

  it('UT-069: closesAt 00:00 vale como fim do dia, entao terminar as 23:59 passa', () => {
    const area = permissiveArea({ opensAt: '08:00', closesAt: '00:00' });

    expect(messages(values('2026-03-14T18:00', '2026-03-14T23:59'), area)).toEqual([]);
  });

  it('UT-070: sem área escolhida, so o término-depois-do-início e conferido', () => {
    // Mesmo no passado, fora de qualquer janela e com convidados demais: sem
    // area nao ha parametro para decidir nenhuma dessas regras.
    expect(messages(values('2020-01-01T03:00', '2020-01-01T05:00', '9999'), null)).toEqual([]);

    expect(messages(values('2026-03-14T18:00', '2026-03-14T17:00'), null)).toEqual([
      'O término deve ser posterior ao início.',
    ]);
  });

  it('UT-071: trocar a área re-deriva as regras e reavalia a mesma reserva', () => {
    // Quarta-feira, valida para uma area sem restricao de dia.
    const booking = values('2026-03-11T18:00', '2026-03-11T20:00');

    const weekdayFree = permissiveArea();
    expect(messages(booking, weekdayFree)).toEqual([]);

    const weekendOnly = permissiveArea({ availableWeekdays: [0, 6] });
    expect(messages(booking, weekendOnly)).toEqual([
      'A área comum não esta disponível neste dia da semana.',
    ]);

    // O mesmo pela via do schema, que e como o formulario consome as regras.
    const form: ReservationFormValues = {
      commonAreaId: 'area-1',
      unitId: 'unit-1',
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      guestsCount: '0',
      notes: '',
    };
    expect(buildReservationSchema(weekdayFree, () => NOW).safeParse(form).success).toBe(true);
    expect(buildReservationSchema(weekendOnly, () => NOW).safeParse(form).success).toBe(false);
  });

  it('UT-072: availableWeekdays nulo libera todos os dias da semana', () => {
    const area = permissiveArea({ availableWeekdays: null });

    // Um dia de cada, da semana de 15 a 21 de marco de 2026 (domingo a sabado).
    // Toda ela no futuro, para que a regra de data passada nao interfira.
    const week = [
      '2026-03-15',
      '2026-03-16',
      '2026-03-17',
      '2026-03-18',
      '2026-03-19',
      '2026-03-20',
      '2026-03-21',
    ];

    for (const day of week) {
      expect(messages(values(`${day}T18:00`, `${day}T20:00`), area)).toEqual([]);
    }
  });

  it('UT-073: minHours 0 e maxHours 0 não impoem limite de duração', () => {
    const area = permissiveArea({ minHours: 0, maxHours: 0 });

    // Um minuto e doze horas passam igualmente.
    expect(messages(values('2026-03-14T18:00', '2026-03-14T18:01'), area)).toEqual([]);
    expect(messages(values('2026-03-14T08:00', '2026-03-14T20:00'), area)).toEqual([]);
  });

  it('UT-074: sobreposição e intervalo mínimo não sao avaliados localmente', () => {
    // A area cobra um intervalo de 30 dias entre reservas da mesma unidade, e
    // ja existe uma reserva conhecida exatamente neste horario. Nenhuma das
    // duas coisas e decidivel aqui (ADR-011): o envio passa e quem recusa e o
    // servidor.
    const area = permissiveArea({ minIntervalDays: 30 });
    const conflicting = values('2026-03-14T18:00', '2026-03-14T20:00');

    expect(checkReservationRules(conflicting, area, NOW)).toEqual([]);
  });

  it('UT-075: reserva que cruza a meia-noite e avaliada pelo dia e pela janela do início', () => {
    // Sabado 22:00 ate domingo 00:00, numa area que so abre aos sabados e
    // fecha a meia-noite. O domingo do termino nao reprova a reserva.
    const area = permissiveArea({
      opensAt: '08:00',
      closesAt: '00:00',
      availableWeekdays: [6],
    });

    expect(messages(values('2026-03-14T22:00', '2026-03-15T00:00'), area)).toEqual([]);

    // Passar da meia-noite excede a janela: o termino conta a partir do inicio
    // do dia em que a reserva comecou.
    expect(messages(values('2026-03-14T22:00', '2026-03-15T01:00'), area)).toEqual([
      'Reservas permitidas somente entre 08:00 e 00:00.',
    ]);
  });
});
