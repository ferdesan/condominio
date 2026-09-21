import { mysqlOptions } from '@/config/data-source';

describe('configuracao do MySQL', () => {
  it('devolve coluna DATE como texto, para o dia nao recuar com o fuso', () => {
    // Sem isto, o mysql2 monta um Date na meia-noite UTC para uma coluna DATE
    // e o TypeORM o converte de volta com getters locais: em America/Sao_Paulo
    // um vencimento 2026-09-10 chegava a tela como 09/09. Ver o comentario em
    // data-source.ts. Esta expectativa existe para que a opcao nao seja
    // removida como se fosse supérflua.
    expect(mysqlOptions).toMatchObject({ type: 'mysql', dateStrings: ['DATE'] });
  });

  it('grava e le datetime em UTC', () => {
    expect(mysqlOptions).toMatchObject({ timezone: 'Z' });
  });
});
