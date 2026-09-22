import { selectProxyVoterIdentity } from '@/modules/assemblies/services/poll.service';

describe('Identidade do voto proxy', () => {
  it('UT-140 devolve identidade do residente quando a votacao nao e secreta', () => {
    const result = selectProxyVoterIdentity(false, { userId: 'user-1', name: 'Ana Silva' });

    expect(result).toEqual({ voterId: 'user-1', voterName: 'Ana Silva' });
  });

  it('UT-140 forca null de identidade quando a votacao e secreta', () => {
    const result = selectProxyVoterIdentity(true, { userId: 'user-1', name: 'Ana Silva' });

    expect(result).toEqual({ voterId: null, voterName: null });
  });

  it('UT-140 devolve nulls quando nao ha residente ativo na unidade', () => {
    const result = selectProxyVoterIdentity(false, null);

    expect(result).toEqual({ voterId: null, voterName: null });
  });
});
