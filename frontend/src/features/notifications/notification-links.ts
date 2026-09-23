/**
 * Resolucao do `actionUrl` de uma notificacao para um destino que a aplicacao
 * de fato tem.
 *
 * ## A decisao, e o motivo
 *
 * O servidor grava o caminho da tela de origem no momento do evento, e ele nao
 * conhece o roteador do cliente: as notificacoes de reserva gravam
 * `/reservas/{id}`, e **essa rota nao existe** — por ADR-004 os modulos vivem em
 * dialogo sobre a listagem, e so Condominios tem rota de detalhe. Seguir o link
 * cru levaria a uma tela em branco.
 *
 * A escolha padrao desta tela e **navegar para a listagem do modulo**:
 * sobe-se pelos segmentos do caminho ate encontrar um que esteja na navegacao,
 * e e para ele que o link aponta. Quando nenhum segmento corresponde a um item
 * do menu, o link **nao e oferecido** — e melhor nao prometer navegacao do que
 * entregar um 404.
 *
 * ## A excecao: `DETAIL_PREFIXES` (ADR-006)
 *
 * A subida unica e o padrao, mas nao serve para rotas de detalhe que precisam
 * preservar o id: truncar `/votacoes/{pollId}` em `/votacoes` cairia numa rota
 * inexistente. `DETAIL_PREFIXES` e a lista curta (uma linha por familia de
 * deep-link) de prefixes cujo caminho **com modulo + id** — dois segmentos ou
 * mais — e devolvido inteiro, antes da subida. Prefixo sem id e caminho fora
 * da lista continuam na regra antiga.
 *
 * Uma lista completa de rotas de detalhe ainda seria um segundo roteador e foi
 * descartada: cada rota nova exigiria lembrar de atualizá-la, e o sintoma de
 * esquecer seria tela em branco. Esta excecao e estreita, documentada, e o
 * esquecimento de uma nova familia de deep-link cai na subida (listagem ou
 * `null`), nunca em link quebrado.
 *
 * A fonte da verdade de `KNOWN_PATHS` e `routes/navigation.ts`, o mesmo lugar
 * de onde a sidebar e o roteador saem. Um modulo que ganhe tela passa a ser
 * destino aqui sem nenhuma mudanca neste arquivo.
 */

import { NAV_ITEMS } from '@/routes/navigation';

/** `/perfil` existe no roteador sem estar na navegacao lateral. */
const KNOWN_PATHS = new Set<string>([...NAV_ITEMS.map((item) => item.to), '/perfil']);

/**
 * Familias de deep-link que preservam o caminho completo (ADR-006).
 *
 * Uma entrada aqui faz `resolveActionUrl` devolver o path inteiro quando ele
 * bate com o prefixo (`path === prefixo` ou `path.startsWith(prefixo + '/')`)
 * **e** tem ao menos dois segmentos — modulo + id. Prefixo sem id e caminho
 * fora da lista seguem a subida por `KNOWN_PATHS`.
 */
const DETAIL_PREFIXES = ['/votacoes'];

/**
 * O destino navegavel de um `actionUrl`, ou `null` quando nao ha um.
 *
 * Caminhos absolutos (`http://...`) e relativos sao recusados: a central so
 * navega dentro da propria aplicacao, e um destino externo vindo de dado
 * gravado nao deve virar link sem que alguem tenha decidido isso.
 */
export function resolveActionUrl(actionUrl: string | null | undefined): string | null {
  if (!actionUrl || !actionUrl.startsWith('/')) return null;

  // A busca e o fragmento nao participam da correspondencia; o destino e o
  // modulo, e nao a posicao dentro dele.
  const [path] = actionUrl.split(/[?#]/);
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) return KNOWN_PATHS.has('/') ? '/' : null;

  // Excecao documentada no cabecalho: modulo + id preservam o caminho inteiro.
  for (const prefix of DETAIL_PREFIXES) {
    const matches = path === prefix || path.startsWith(`${prefix}/`);
    if (matches && segments.length >= 2) return path;
  }

  for (let depth = segments.length; depth > 0; depth -= 1) {
    const candidate = `/${segments.slice(0, depth).join('/')}`;
    if (KNOWN_PATHS.has(candidate)) return candidate;
  }

  return null;
}
