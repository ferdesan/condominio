import { describeMailError, parseSender } from '@/shared/mail/mailer';

describe('parseSender', () => {
  it.each([
    ['Condominios <contato@ferdesan.com.br>', 'Condominios'],
    ['"Condominios" <contato@ferdesan.com.br>', 'Condominios'],
    // Formato que chegou em producao depois que o deploy comeu os `<>`.
    ['Condominios contato@ferdesan.com.br', 'Condominios'],
    ['<contato@ferdesan.com.br>', 'App'],
    ['contato@ferdesan.com.br', 'App'],
  ])('separa nome e endereco de %s', (raw, name) => {
    expect(parseSender(raw, 'App')).toEqual({ name, address: 'contato@ferdesan.com.br' });
  });
});

describe('describeMailError', () => {
  it('prefere codigo e resposta do servidor SMTP', () => {
    const error = Object.assign(new Error('Can\'t send mail'), {
      code: 'EENVELOPE',
      responseCode: 553,
      response: '553 5.7.1 Sender address rejected',
    });
    expect(describeMailError(error)).toBe('EENVELOPE | 553 | 553 5.7.1 Sender address rejected');
  });

  it('cai para a mensagem quando nao ha resposta', () => {
    expect(describeMailError(new Error('Greeting never received'))).toBe('Greeting never received');
  });
});
