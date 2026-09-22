/**
 * Rotulos de assembleias e votacoes, compartilhados pela listagem, os filtros,
 * os formularios e o painel de deliberacoes.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type {
  Assembly,
  AssemblyMode,
  AssemblyStatus,
  AssemblyType,
  Poll,
  PollStatus,
  PollVoterType,
  UnitVoteStatusValue,
} from '@/types/assembly';

/**
 * Os quatro estados da assembleia.
 *
 * Nenhum rotulo repete um cabecalho de coluna ("Assembleia", "Tipo", "Quando",
 * "Formato", "Situacao", "Presentes", "Acoes") nem o rotulo de um filtro — a
 * colisao que ja quebrou consultas por texto em telas anteriores.
 */
export const ASSEMBLY_STATUS_LABELS: Record<AssemblyStatus, string> = {
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em andamento',
  FINISHED: 'Encerrada',
  CANCELED: 'Cancelada',
};

export const ASSEMBLY_TYPE_LABELS: Record<AssemblyType, string> = {
  ORDINARY: 'Ordinária',
  EXTRAORDINARY: 'Extraordinária',
};

export const ASSEMBLY_MODE_LABELS: Record<AssemblyMode, string> = {
  IN_PERSON: 'Presencial',
  ONLINE: 'Online',
  HYBRID: 'Hibrida',
};

/**
 * Os quatro estados da votacao.
 *
 * "Rascunho" e o mesmo vocabulario de Comunicados de proposito: e o mesmo
 * conceito — existe, ainda nao circula.
 */
export const POLL_STATUS_LABELS: Record<PollStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberta',
  CLOSED: 'Apurada',
  CANCELED: 'Cancelada',
};

export const POLL_VOTER_LABELS: Record<PollVoterType, string> = {
  OWNERS: 'Somente proprietários',
  ALL_RESIDENTS: 'Todos os moradores',
};

/**
 * Os tres status de uma unidade na lista de gestao (ADR-003 / ADR-005).
 *
 * Nenhum rotulo repete um valor de `POLL_STATUS_LABELS` nem o cabecalho de
 * coluna/filtro "Situação": a colisao de vocabulario ja quebrou consulta por
 * texto em telas anteriores, e aqui as duas colunas convivem no mesmo dialogo.
 */
export const UNIT_VOTE_STATUS_LABELS: Record<UnitVoteStatusValue, string> = {
  VOTED: 'Já votou',
  PENDING: 'Pendente',
  NOT_ELIGIBLE: 'Não elegível',
};

/**
 * Dito quando o voto e registrado com sucesso (ADR-004 / US-003).
 *
 * A confirmacao vem antes da apuracao e permanece mesmo quando os resultados
 * nao sao legiveis — e por isso mora junto dos rotulos, nao dentro de um
 * componente.
 */
export const VOTE_CONFIRMATION = 'Voto registrado';

/** Dito quando a assembleia nao tem local — o que e normal numa online. */
export const NO_LOCATION = 'Sem local definido';

/** Dito quando a assembleia ainda nao tem ata publicada. */
export const NO_MINUTES = 'Ata não publicada';

/** Dito quando a assembleia nao tem segunda convocacao. */
export const NO_SECOND_CALL = 'Sem segunda convocação';

/** Dito quando a assembleia nao tem nenhuma deliberacao registrada. */
export const NO_POLLS = 'Nenhuma deliberação registrada nesta assembleia.';

/** Identifica a assembleia nos rotulos acessiveis das acoes de linha. */
export function assemblyLabel(assembly: Assembly): string {
  return assembly.title;
}

/** Identifica a votacao nos rotulos acessiveis das acoes do painel. */
export function pollLabel(poll: Poll): string {
  return poll.title;
}

/**
 * Como o peso de cada voto e contado.
 *
 * A diferenca muda o resultado, e nao so a apresentacao: ponderada, uma unidade
 * grande decide mais do que uma pequena. Dizer isso na tela evita que alguem
 * leia o percentual como "quantas pessoas".
 */
export function weightingLabel(weighted: boolean): string {
  return weighted ? 'Ponderado pela fração ideal' : 'Um voto por unidade';
}
