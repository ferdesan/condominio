/**
 * Camada de dados da tela de areas comuns: so a fabrica do ADR-008, sem
 * endpoint proprio.
 *
 * Mexer numa area muda o comportamento do formulario de reservas, que deriva as
 * regras do registro em tempo de execucao (ADR-011). O cache de reservas guarda
 * a area embutida em cada linha, entao editar uma aqui invalida as duas
 * colecoes — sem isso, a tela de reservas seguiria validando pelos parametros
 * antigos ate o proximo refetch.
 */

import { createResourceHooks } from '@/lib/crud';
import type { CommonArea } from '@/types/api';
import type { CommonAreaPayload } from './common-area-schema';

export const COMMON_AREAS_KEY = ['common-areas'] as const;
export const RESERVATIONS_KEY = ['reservations'] as const;

export const commonAreaHooks = createResourceHooks<
  CommonArea,
  CommonAreaPayload,
  Partial<CommonAreaPayload>
>('common-areas', { extraInvalidate: [RESERVATIONS_KEY] });
