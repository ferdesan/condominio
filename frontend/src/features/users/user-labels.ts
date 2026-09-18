/**
 * Rotulos de usuario, compartilhados pela listagem, os filtros e o formulario.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type { UserStatus } from '@/types/user';

/**
 * Os quatro estados da conta.
 *
 * Nenhum repete um cabecalho de coluna ("Nome", "E-mail", "Telefone", "Papel",
 * "Condominios", "Unidade", "Status") nem o rotulo de um filtro — a colisao que
 * ja quebrou consultas por texto em telas anteriores.
 */
export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  BLOCKED: 'Bloqueado',
  PENDING: 'Pendente',
};

/**
 * Dito quando o usuario nao tem nenhum condominio vinculado.
 *
 * Lista vazia significa acesso a todos do tenant, e nao a nenhum: e como perfis
 * administrativos sao cadastrados, e e a leitura que o proprio servidor faz em
 * `recipientsService.usersOfCondominium`. Exibir um traco aqui diria o oposto do
 * que o registro significa.
 */
export const ALL_CONDOMINIUMS = 'Todos os condomínios';

/** Dito quando o papel nao veio na resposta — a relacao e eager, entao e raro. */
export const NO_ROLE = 'Papel não definido';

/** Dito quando a conta nao esta ligada a nenhuma unidade (nao e morador). */
export const NO_UNIT = 'Sem unidade';

/** Dito quando ha unidade, mas o registro referido nao esta na lista carregada. */
export const UNIT_UNAVAILABLE = 'Unidade indisponível';
