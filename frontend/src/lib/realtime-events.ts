/**
 * De que evento sai que invalidacao.
 *
 * Modulo proprio, e sem React: e a parte testavel do canal, e o ponto onde uma
 * mudanca no servidor precisa ser refletida a mao.
 *
 * As chaves sao **prefixos** de um segmento so, iguais aos `<RECURSO>_KEY` que
 * cada feature exporta. `invalidateQueries({ queryKey: [prefixo] })` alcanca
 * toda consulta que comece por ele — listagem, detalhe, contadores e resumos —,
 * que e o que se quer: o evento diz "este recurso mudou", e nao "esta linha
 * mudou".
 */

/** Chave do painel. Ele monta as consultas com literal, sem constante exportada. */
const DASHBOARD = 'dashboard';

/**
 * O mapa. Um evento pode tocar mais de um recurso.
 *
 * **O painel entra em cinco deles, e nao em todos.** So onde um numero dele
 * realmente muda: visitantes dentro, ocorrencias abertas, reservas pendentes,
 * correspondencias a retirar e a posicao financeira. Comunicado publicado e
 * notificacao nova nao movem nenhum indicador, e votacao tampouco — o painel
 * conta assembleias proximas, e nao votacoes.
 *
 * Invalidar uma chave que ninguem observa e barato: o React Query apenas marca
 * como obsoleta, e a busca so acontece quando alguma tela voltar a olhar.
 */
export const EVENT_INVALIDATIONS: Record<string, readonly string[]> = {
  'notification:new': ['notifications'],
  'announcement:published': ['announcements'],
  'reservation:updated': ['reservations', DASHBOARD],
  'correspondence:received': ['correspondences', DASHBOARD],
  'visitor:arrived': ['visitors', DASHBOARD],
  'incident:updated': ['incidents', DASHBOARD],
  'charge:updated': ['financial/charges', DASHBOARD],
  'poll:updated': ['polls'],

  /*
   * `dashboard:refresh` **nao esta aqui, e nao e esquecimento.**
   *
   * Ele e declarado no union de `RealtimeEvent` e **nenhum servico o emite** —
   * `grep` por ele no backend encontra so a propria declaracao. Mapea-lo seria
   * escrever, testar e manter um caminho que nunca executa. Quando alguem
   * passar a emiti-lo, a linha entra aqui com `[DASHBOARD]`.
   */
};

/**
 * Os prefixos que um evento invalida. Evento desconhecido nao invalida nada.
 *
 * Nao lanca de proposito: o servidor pode ganhar um evento novo antes deste
 * frontend, e um evento a mais nao pode derrubar o canal inteiro.
 */
export function invalidationsFor(event: string): readonly string[] {
  return EVENT_INVALIDATIONS[event] ?? [];
}

/**
 * Sobre `visitor:arrived`, que esta mapeado e quase nunca chegara aqui.
 *
 * `visitorService.checkIn` o emite com `emitToUnit(visitor.unitId, ...)`, e o
 * servidor so poe um socket na sala de uma unidade quando a conta tem
 * `unitId` — ou seja, quando e de morador. Um administrador ou porteiro nunca
 * entra nessa sala e, portanto, nunca recebe este evento.
 *
 * O mapeamento fica assim mesmo: ele esta correto, custa uma linha, e vale no
 * dia em que existir o portal do morador ou o servidor passar a emitir tambem
 * para o condominio. O que nao se deve e **esperar** que ele chegue neste
 * frontend — por isso a observacao esta escrita, e nao suposta.
 */
export const UNIT_SCOPED_EVENTS: readonly string[] = ['visitor:arrived'];
