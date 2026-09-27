import type { EntityManager } from 'typeorm';
import { lockCondominiumCash } from '@/modules/financial/closing-guard';

/**
 * A trava so tem efeito no MySQL; os testes de integracao rodam em sql.js, que
 * nao tem `FOR UPDATE`. Aqui se prova o que ela pede ao banco em cada caso.
 */
function fakeManager(type: string) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id: 'cond-1' }),
  };
  const manager = {
    connection: { options: { type } },
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
  return { manager: manager as unknown as EntityManager, qb, raw: manager };
}

describe('lockCondominiumCash', () => {
  it('trava a linha do condominio com pessimistic_write no MySQL', async () => {
    const { manager, qb } = fakeManager('mysql');

    await lockCondominiumCash(manager, 'cond-1');

    expect(qb.where).toHaveBeenCalledWith('condominium.id = :condominiumId', {
      condominiumId: 'cond-1',
    });
    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(qb.getOne).toHaveBeenCalled();
  });

  it('nao faz nada no sql.js, onde a conexao unica ja serializa', async () => {
    const { manager, raw } = fakeManager('sqljs');

    await lockCondominiumCash(manager, 'cond-1');

    expect(raw.createQueryBuilder).not.toHaveBeenCalled();
  });
});
