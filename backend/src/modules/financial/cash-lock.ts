import { AsyncLocalStorage } from 'node:async_hooks';
import type { DataSource } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { ConflictError } from '@/shared/errors';

/** Quanto uma operacao espera a outra antes de desistir, em segundos. */
const LOCK_WAIT_SECONDS = 15;

/** Travas que o fluxo assincrono atual ja segura: e o que torna a trava reentrante. */
const held = new AsyncLocalStorage<ReadonlySet<string>>();

function lockName(condominiumId: string): string {
  // GET_LOCK aceita ate 64 caracteres; o prefixo + UUID ocupa 50.
  return `condominio:caixa:${condominiumId}`;
}

/**
 * Serializa, por condominio, tudo o que mexe no caixa de um mes: fechar o mes,
 * registrar ou corrigir recebimento, liquidar, lancar, alterar, excluir ou
 * restaurar despesa.
 *
 * Sem isto, conferir "mes aberto" e gravar sao dois passos separados. Um
 * fechamento entre eles congela o balancete sem o lancamento, que grava depois
 * num mes ja fechado; o documento passa a afirmar um total que o banco nao tem.
 * Com a trava, quem chega segundo espera o primeiro terminar e so entao confere.
 *
 * **Por que trava nomeada (`GET_LOCK`), e nao `SELECT ... FOR UPDATE`.** A linha
 * do condominio e referenciada por chave estrangeira de unidades, blocos, avisos,
 * ocorrencias e outras tabelas: travada, ela seguraria essas insercoes durante um
 * fechamento. E a escrita das baixas passa pelo `BaseRepository`, em outra
 * conexao do pool, que nao herdaria uma trava de linha. A trava nomeada nao
 * prende linha nenhuma — e um semaforo do servidor, preso a uma conexao dedicada
 * enquanto `fn` roda, e solto no `finally` (ou pelo proprio MySQL, se a conexao
 * cair).
 *
 * **Reentrante.** `ExpenseService.pay` chama `update`, que tambem trava: sem
 * reentrada o fluxo esperaria a si mesmo ate o timeout. Varios condominios sao
 * travados em ordem fixa, para dois fluxos nunca se esperarem em cruz.
 *
 * No sql.js dos testes nao ha o que travar: a conexao e unica e as operacoes ja
 * rodam uma de cada vez.
 */
export async function withCashLock<T>(
  condominiumIds: string | null | undefined | Array<string | null | undefined>,
  fn: () => Promise<T>,
  dataSource: DataSource = AppDataSource,
): Promise<T> {
  const current = held.getStore() ?? new Set<string>();
  const names = [...new Set([condominiumIds].flat().filter((id): id is string => Boolean(id)))]
    .sort()
    .map(lockName)
    .filter((name) => !current.has(name));

  if (!names.length || dataSource.options.type !== 'mysql') return fn();

  const runner = dataSource.createQueryRunner();
  await runner.connect();
  const acquired: string[] = [];
  try {
    for (const name of names) {
      const [row] = (await runner.query('SELECT GET_LOCK(?, ?) AS ok', [
        name,
        LOCK_WAIT_SECONDS,
      ])) as Array<{ ok: number | string | null }>;
      if (Number(row?.ok) !== 1) {
        throw new ConflictError(
          'Outra operacao financeira deste condominio esta em andamento. Tente novamente.',
        );
      }
      acquired.push(name);
    }

    return await held.run(new Set([...current, ...acquired]), fn);
  } finally {
    for (const name of acquired.reverse()) {
      await runner.query('SELECT RELEASE_LOCK(?)', [name]).catch(() => undefined);
    }
    await runner.release();
  }
}
