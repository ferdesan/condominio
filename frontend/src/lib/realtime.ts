/**
 * O contrato do canal de tempo real, espelhado de
 * `backend/src/realtime/realtime.service.ts` e `socket-server.ts`.
 *
 * **O canal e um acelerador, e nunca uma fonte.** A arquitetura de dados do
 * produto e "o servidor e a verdade, o cliente invalida": toda tela le por
 * `useQuery` e reage a invalidacao. Um evento aqui **invalida** a chave que ele
 * afeta; ele nao escreve no cache a partir do proprio payload. Aplicar o payload
 * criaria um segundo caminho de escrita, que divergiria do primeiro no primeiro
 * campo calculado pelo servidor — um saldo, uma contagem, um status derivado.
 *
 * Por isso os payloads sao declarados como `unknown`: nada aqui os le.
 */

import { API_URL } from './api';

/** Os nove eventos declarados pelo servidor. */
export const REALTIME_EVENTS = [
  'notification:new',
  'announcement:published',
  'reservation:updated',
  'correspondence:received',
  'visitor:arrived',
  'incident:updated',
  'charge:updated',
  'poll:updated',
  'dashboard:refresh',
] as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];

/** O caminho do servidor de sockets, fixado em `initSocketServer`. */
export const SOCKET_PATH = '/socket.io';

/**
 * A origem do canal, derivada da URL da API.
 *
 * O socket nao vive sob `/api/v1`: `initSocketServer` monta em `/socket.io`, na
 * raiz do servidor. Entao o que interessa de `API_URL` e a **origem**, e nao o
 * caminho.
 *
 * - `http://localhost:3333/api/v1` -> `http://localhost:3333`
 * - `/api/v1` (o padrao, atras de proxy) -> `undefined`, e o cliente usa a
 *   origem da propria pagina.
 *
 * As duas formas existem no projeto: `.env.example` da raiz traz a absoluta e o
 * do frontend traz a relativa.
 */
export function realtimeOrigin(apiUrl: string = API_URL): string | undefined {
  try {
    return new URL(apiUrl).origin;
  } catch {
    // URL relativa: `new URL` lanca sem base, e e exatamente o caso em que
    // queremos deixar o cliente resolver pela origem da pagina.
    return undefined;
  }
}
