/**
 * Espelho cliente de `backend/src/modules/announcements/announcement.schema.ts`.
 *
 * Mesma convencao dos demais formularios: os campos de texto entram e saem como
 * string, entao `z.infer` basta e o `useForm` precisa de um generico so. A
 * conversao para o corpo da requisicao acontece em `toAnnouncementPayload`.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell. `status`
 * tambem nao: o comunicado nasce rascunho e quem o move sao as acoes de linha,
 * que tem rota propria.
 */

import { z } from 'zod';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_CATEGORIES,
  type Announcement,
} from '@/types/announcement';

/** Teto do conteudo no servidor. Bem acima do padrao do `Textarea`, que e 2000. */
export const CONTENT_MAX_LENGTH = 20_000;

const announcementFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Informe o título do comunicado.')
    .max(180, 'Use no máximo 180 caracteres.'),
  content: z
    .string()
    .trim()
    .min(3, 'Informe o conteudo do comunicado.')
    .max(CONTENT_MAX_LENGTH, `Use no máximo ${CONTENT_MAX_LENGTH} caracteres.`),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES),
  /** So tem sentido — e so e enviado — quando o publico-alvo e `BLOCKS`. */
  targetBlockIds: z.array(z.string()),
  pinned: z.boolean(),
});

/**
 * A unica regra do servidor duplicada aqui.
 *
 * `assertAudience` a recusa como `BusinessRuleError`, isto e, 409 sem caminho de
 * campo — e uma mensagem geral de formulario nao diz qual controle consertar.
 * Dita no campo, ela tem conserto obvio. Sem isso, escolher "Blocos
 * especificos" seria um beco: a opcao existe no contrato e nao teria como ser
 * usada com sucesso.
 */
export const announcementSchema = announcementFields.refine(
  (values) => values.audience !== 'BLOCKS' || values.targetBlockIds.length > 0,
  {
    path: ['targetBlockIds'],
    message: 'Selecione ao menos um bloco para o público-alvo escolhido.',
  },
);

export type AnnouncementFormValues = z.infer<typeof announcementFields>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const ANNOUNCEMENT_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(announcementFields.shape),
);

/** Os padroes sao os do servidor: geral, para todos, nao fixado. */
export function announcementFormDefaults(): AnnouncementFormValues {
  return {
    title: '',
    content: '',
    category: 'GENERAL',
    audience: 'ALL',
    targetBlockIds: [],
    pinned: false,
  };
}

/**
 * Corpo aceito por `POST /announcements`; a atualizacao e o parcial dele.
 *
 * `status` fica de fora de proposito: criar produz um rascunho, e mover o
 * comunicado pelo ciclo e das rotas `/publish` e `/archive`. Mandar `status`
 * daqui criaria um segundo caminho para a mesma transicao, sem as verificacoes
 * que o servico faz naquelas rotas.
 */
export type AnnouncementPayload = {
  condominiumId: string;
  title: string;
  content: string;
  category: AnnouncementFormValues['category'];
  audience: AnnouncementFormValues['audience'];
  /** `null` fora de `BLOCKS`: trocar de publico-alvo precisa apagar a lista antiga. */
  targetBlockIds: string[] | null;
  pinned: boolean;
};

export function toAnnouncementPayload(
  values: AnnouncementFormValues,
  condominiumId: string,
): AnnouncementPayload {
  return {
    condominiumId,
    title: values.title,
    content: values.content,
    category: values.category,
    audience: values.audience,
    targetBlockIds: values.audience === 'BLOCKS' ? values.targetBlockIds : null,
    pinned: values.pinned,
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira vazio. */
export function toAnnouncementFormValues(announcement: Announcement): AnnouncementFormValues {
  return {
    title: announcement.title,
    content: announcement.content,
    category: announcement.category,
    audience: announcement.audience,
    targetBlockIds: announcement.targetBlockIds ?? [],
    pinned: announcement.pinned,
  };
}
