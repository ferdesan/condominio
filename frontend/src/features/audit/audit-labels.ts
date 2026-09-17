/**
 * Rotulos da trilha de auditoria, compartilhados pela listagem, os filtros e o
 * dialogo de detalhe.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type { AuditAction, AuditLog } from '@/types/audit';

/**
 * As dezessete acoes registradas pelo servidor.
 *
 * Nenhum rotulo repete um cabecalho de coluna ("Quando", "Autor", "Acao",
 * "Recurso", "Descricao", "Campos alterados") nem o rotulo de um filtro — a
 * colisao que ja quebrou consultas por texto em telas anteriores.
 */
export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Criacao',
  UPDATE: 'Alteracao',
  DELETE: 'Exclusao',
  RESTORE: 'Restauracao',
  LOGIN: 'Entrada no sistema',
  LOGOUT: 'Saida do sistema',
  LOGIN_FAILED: 'Falha de entrada',
  PASSWORD_CHANGED: 'Troca de senha',
  PERMISSION_DENIED: 'Permissao negada',
  EXPORT: 'Exportacao',
  IMPORT: 'Importacao',
  LGPD_DELETE_REQUEST: 'Pedido de exclusao LGPD',
  LGPD_DELETE: 'Exclusao LGPD executada',
  LGPD_DELETE_CANCEL: 'Pedido de exclusao cancelado',
  LGPD_EXPORT: 'Exportacao de dados pessoais',
  LGPD_CONSENT_GRANTED: 'Consentimento concedido',
  LGPD_CONSENT_REVOKED: 'Consentimento revogado',
};

/**
 * Espelha `backend/src/shared/constants/resources.ts`, mais os dois nomes que
 * nao vem daquela lista: `auth`, gravado pelo modulo de autenticacao, e
 * `unknown`, que o middleware de autorizacao usa quando nao consegue deduzir o
 * recurso da permissao negada.
 *
 * Nao e uma whitelist: `resource` e `varchar(60)` livre no servidor, entao a
 * tela precisa saber exibir um nome que nao esteja aqui — e por isso toda
 * leitura passa por `resourceLabel`.
 */
export const RESOURCE_LABELS: Record<string, string> = {
  auth: 'Autenticacao',
  tenant: 'Administradora',
  user: 'Usuario',
  role: 'Papel de acesso',
  condominium: 'Condominio',
  block: 'Bloco',
  unit: 'Unidade',
  resident: 'Morador',
  dependent: 'Dependente',
  employee: 'Funcionario',
  visitor: 'Visitante',
  'service-provider': 'Prestador',
  vehicle: 'Veiculo',
  correspondence: 'Correspondencia',
  'common-area': 'Area comum',
  reservation: 'Reserva',
  'financial-category': 'Categoria financeira',
  charge: 'Cobranca',
  payment: 'Pagamento',
  expense: 'Despesa',
  assembly: 'Assembleia',
  poll: 'Enquete',
  vote: 'Voto',
  announcement: 'Comunicado',
  incident: 'Ocorrencia',
  maintenance: 'Manutencao',
  document: 'Documento',
  dashboard: 'Painel',
  'audit-log': 'Trilha de auditoria',
  notification: 'Notificacao',
  unknown: 'Recurso nao identificado',
};

/** Nome do recurso por extenso; o proprio identificador quando nao ha traducao. */
export function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource;
}

/**
 * Dito quando a entrada nao tem autor.
 *
 * `userId` e `userName` sao nulos quando quem agiu foi o proprio servidor —
 * jobs agendados, carga inicial. Um traco aqui deixaria parecer que o dado se
 * perdeu, quando na verdade nao havia pessoa nenhuma.
 */
export const SYSTEM_ACTOR = 'Sistema';

/** Dito quando a alteracao nao mexeu em nenhum campo rastreado. */
export const NO_FIELDS_CHANGED = 'Nenhum campo alterado';

/** Dito no lugar de um valor ausente dentro do antes/depois. */
export const ABSENT_VALUE = 'vazio';

/** Dito quando a acao nao tem registro alvo e portanto nao tem historico. */
export const NO_RESOURCE_TARGET =
  'Esta acao nao aponta para um registro especifico, entao nao ha historico a consultar.';

/**
 * Os campos que mudaram, na ordem em que o servidor os gravou.
 *
 * A uniao dos dois lados, e nao so de `after`: uma propriedade removida aparece
 * no antes e some do depois, e continua sendo uma mudanca.
 */
export function changedFields(entry: AuditLog): string[] {
  const before = Object.keys(entry.changes?.before ?? {});
  const after = Object.keys(entry.changes?.after ?? {});
  return [...new Set([...before, ...after])];
}

/**
 * Um valor do antes/depois em texto.
 *
 * Objetos e listas viram JSON: sao raros na trilha — `diffChanges` guarda
 * propriedades, nao entidades —, e exibi-los cru e melhor do que esconder que
 * mudaram. `null` e `undefined` viram a mesma palavra, porque a diferenca entre
 * "apagado" e "nunca preenchido" nao sobrevive ao `simple-json` do servidor.
 */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return ABSENT_VALUE;
  if (typeof value === 'boolean') return value ? 'sim' : 'nao';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Identifica a entrada nos rotulos acessiveis das acoes de linha. */
export function auditEntryLabel(entry: AuditLog): string {
  const target = entry.resourceId ? ` ${entry.resourceId}` : '';
  return `${ACTION_LABELS[entry.action]} em ${resourceLabel(entry.resource)}${target}`;
}
