/**
 * Rotulos e agrupamento das permissoes.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 *
 * **Os nomes aqui sao de apresentacao, e o catalogo continua vindo do
 * servidor.** Este arquivo nao declara quais permissoes existem — ele traduz as
 * que chegarem. Um recurso novo no backend aparece na tela com o proprio
 * identificador tecnico ate ganhar uma linha aqui, o que e visivelmente
 * incompleto e nunca silenciosamente ausente.
 */

/** As cinco acoes de `shared/constants/resources.ts`, na ordem em que sao lidas. */
export const ACTION_ORDER = ['read', 'create', 'update', 'delete', 'manage'] as const;
export type PermissionAction = (typeof ACTION_ORDER)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  read: 'Ver',
  create: 'Criar',
  update: 'Editar',
  delete: 'Excluir',
  manage: 'Gerenciar',
};

/** Dito sob a coluna "Gerenciar", que resolve as quatro anteriores. */
export const MANAGE_NOTE = 'Gerenciar já inclui ver, criar, editar e excluir daquele recurso.';

const RESOURCE_LABELS: Record<string, string> = {
  tenant: 'Administradora',
  user: 'Usuários',
  role: 'Papéis de acesso',
  condominium: 'Condomínios',
  block: 'Blocos e torres',
  unit: 'Unidades',
  resident: 'Moradores',
  dependent: 'Dependentes',
  employee: 'Funcionários',
  visitor: 'Visitantes',
  'service-provider': 'Prestadores',
  vehicle: 'Veículos',
  correspondence: 'Correspondências',
  'common-area': 'Áreas comuns',
  reservation: 'Reservas',
  'financial-category': 'Plano de contas',
  charge: 'Cobranças',
  payment: 'Pagamentos',
  expense: 'Despesas',
  assembly: 'Assembleias',
  poll: 'Votações',
  vote: 'Votos',
  announcement: 'Comunicados',
  incident: 'Ocorrências',
  maintenance: 'Manutenções',
  document: 'Documentos',
  dashboard: 'Painel',
  'dashboard-activity': 'Atividade recente do painel',
  'audit-log': 'Auditoria',
  notification: 'Notificações',
};

export function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource;
}

/**
 * As secoes da matriz, na ordem em que a tela as apresenta.
 *
 * O catalogo do servidor e uma lista plana de cento e quarenta e cinco entradas
 * `recurso:acao`, mais o curinga. Despeja-la como uma coluna de caixas de
 * selecao nao e uma interface — agrupar por assunto e o que torna a matriz
 * legivel, e a ordem espelha a da barra lateral para que quem conhece o menu
 * encontre o recurso onde espera.
 *
 * Um recurso que o servidor passe a expor e nao esteja em nenhum grupo cai em
 * "Outros", visivel. O que **nao** pode acontecer e ele sumir da tela.
 */
export const PERMISSION_GROUPS: Array<{ title: string; resources: string[] }> = [
  { title: 'Estrutura', resources: ['condominium', 'block', 'unit'] },
  { title: 'Pessoas', resources: ['resident', 'dependent', 'employee', 'service-provider'] },
  { title: 'Portaria', resources: ['visitor', 'vehicle', 'correspondence'] },
  {
    title: 'Convivência',
    resources: ['common-area', 'reservation', 'assembly', 'poll', 'vote', 'announcement'],
  },
  {
    title: 'Financeiro',
    resources: ['financial-category', 'charge', 'payment', 'expense'],
  },
  { title: 'Operação', resources: ['incident', 'maintenance', 'document'] },
  { title: 'Administração', resources: ['tenant', 'user', 'role', 'audit-log'] },
  { title: 'Sistema', resources: ['dashboard', 'dashboard-activity', 'notification'] },
];

/** Dito na tarja de um papel semeado pelo sistema. */
export const SYSTEM_ROLE = 'Sistema';
/** Dito na tarja de um papel criado pela administradora. */
export const CUSTOM_ROLE = 'Personalizado';

/**
 * Dito quando um papel do sistema e aberto para edicao.
 *
 * A segunda frase e o que faltava: `beforeUpdate` recusa a mudanca com 409 e a
 * mensagem do servidor ensina a saida — "crie um papel personalizado" —, mas ela
 * nunca chega a ninguem, porque o formulario desabilita a matriz e o envio nem
 * acontece. Sem isto a tela dizia o que nao da, e nao o que fazer.
 */
export const SYSTEM_ROLE_LOCKED =
  'Papel do sistema: nome e permissões sao fixos. So a descrição pode mudar. Para um papel com outras permissões, use Duplicar na listagem.';

/** Dito ao duplicar: o que veio junto, e o que nao veio. */
export const DUPLICATE_INTRO =
  'As permissões do papel de origem já vêm marcadas. Dê um nome ao novo papel e ajuste o que precisar.';

/** Dito ao lado do campo de nome. */
export const NAME_UPPERCASED = 'Gravado em maiusculas pelo servidor.';
