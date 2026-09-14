/**
 * Espelha `backend/src/modules/announcements/announcement.entity.ts` e o
 * contrato de `announcement.schema.ts`.
 *
 * Arquivo proprio pelo mesmo motivo de `visitor.ts` e `correspondence.ts`:
 * `api.ts` e compartilhado entre as tasks deste tier e ja foi ponto de quebra.
 */

export const ANNOUNCEMENT_CATEGORIES = [
  'GENERAL',
  'URGENT',
  'MAINTENANCE',
  'FINANCIAL',
  'EVENT',
  'ASSEMBLY',
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

/**
 * O ciclo editorial. Nasce rascunho, e publicado, e depois arquivado — e o
 * servidor recusa publicar o que ja esta publicado ou arquivado
 * (`announcement.service.ts::publish`).
 */
export const ANNOUNCEMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_AUDIENCES = ['ALL', 'OWNERS', 'TENANTS', 'STAFF', 'BLOCKS'] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export type Announcement = {
  id: string;
  condominiumId: string;
  title: string;
  /** Texto longo: a coluna e `text`, com teto de 20000 caracteres no schema. */
  content: string;
  category: AnnouncementCategory;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  /** Exigido pelo servidor quando `audience = BLOCKS`, e so entao. */
  targetBlockIds: string[] | null;
  pinned: boolean;
  /** O servidor grava no momento da publicacao; nulo enquanto rascunho. */
  publishedAt: string | null;
  expiresAt: string | null;
  /** Preenchidos pelo servidor a partir de quem cadastrou. */
  authorId: string | null;
  authorName: string | null;
  attachmentUrl: string | null;
  readsCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
