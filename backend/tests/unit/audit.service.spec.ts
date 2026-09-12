import { diffChanges, maskSensitive } from '@/modules/audit/audit.service';

describe('Trilha de auditoria', () => {
  it('mascara campos sensiveis em qualquer profundidade', () => {
    const masked = maskSensitive({
      email: 'user@example.com',
      password: 'segredo',
      nested: { refreshToken: 'abc', keep: 1 },
    });

    expect(masked).toEqual({
      email: 'user@example.com',
      password: '***',
      nested: { refreshToken: '***', keep: 1 },
    });
  });

  it('serializa datas para texto', () => {
    const masked = maskSensitive({ createdAt: new Date('2026-01-01T00:00:00.000Z') });
    expect(masked?.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('registra apenas os campos que mudaram', () => {
    const diff = diffChanges(
      { name: 'A', status: 'ACTIVE', updatedAt: 'x' },
      { name: 'B', status: 'ACTIVE', updatedAt: 'y' },
    );

    expect(diff).toEqual({ before: { name: 'A' }, after: { name: 'B' } });
  });

  it('devolve null quando nada mudou', () => {
    expect(diffChanges({ name: 'A' }, { name: 'A' })).toBeNull();
    expect(diffChanges(null, { name: 'A' })).toBeNull();
  });
});
