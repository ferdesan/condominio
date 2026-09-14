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
 * A escolha desta tela e **sempre navegar para a listagem do modulo**: sobe-se
 * pelos segmentos do caminho ate encontrar um que esteja na navegacao, e e para
 * ele que o link aponta. Quando nenhum segmento corresponde a um item do menu, o
 * link **nao e oferecido** — e melhor nao prometer navegacao do que entregar um
 * 404.
 *
 * A alternativa seria manter uma lista de rotas de detalhe conhecidas e usar o
 * caminho cru quando batesse. Ela foi descartada por duplicar o roteador num
 * segundo lugar: cada rota nova exigiria lembrar de atualizar esta lista, e o
 * sintoma de esquecer seria uma tela em branco — exatamente o que este modulo
 * existe para evitar. A regra unica custa a precisao do registro especifico e
 * nunca quebra.
 *
 * A fonte da verdade e `routes/navigation.ts`, o mesmo lugar de onde a sidebar e
 * o roteador saem. Um modulo que ganhe tela passa a ser destino aqui sem
 * nenhuma mudanca neste arquivo.
 */

import { NAV_ITEMS } from '@/routes/navigation';

/** `/perfil` existe no roteador sem estar na navegacao lateral. */
const KNOWN_PATHS = new Set<string>([...NAV_ITEMS.map((item) => item.to), '/perfil']);

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

  for (let depth = segments.length; depth > 0; depth -= 1) {
    const candidate = `/${segments.slice(0, depth).join('/')}`;
    if (KNOWN_PATHS.has(candidate)) return candidate;
  }

  return null;
}
