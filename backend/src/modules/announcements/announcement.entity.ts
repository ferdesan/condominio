import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const ANNOUNCEMENT_CATEGORIES = [
  'GENERAL',
  'URGENT',
  'MAINTENANCE',
  'FINANCIAL',
  'EVENT',
  'ASSEMBLY',
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_AUDIENCES = ['ALL', 'OWNERS', 'TENANTS', 'STAFF', 'BLOCKS'] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

/** Comunicado publicado pela administracao para os moradores. */
@Entity('announcements')
@Index(['tenantId', 'condominiumId', 'status'])
export class Announcement extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: 'GENERAL' })
  category: AnnouncementCategory;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: AnnouncementStatus;

  @Column({ type: 'varchar', length: 20, default: 'ALL' })
  audience: AnnouncementAudience;

  /** Blocos alvo quando `audience = BLOCKS`. */
  @Column({ name: 'target_block_ids', type: 'simple-json', nullable: true })
  targetBlockIds?: string[] | null;

  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'author_id', type: 'varchar', length: 36, nullable: true })
  authorId?: string | null;

  @Column({ name: 'author_name', type: 'varchar', length: 150, nullable: true })
  authorName?: string | null;

  @Column({ name: 'attachment_url', type: 'varchar', length: 255, nullable: true })
  attachmentUrl?: string | null;

  @Column({ name: 'reads_count', type: 'int', default: 0 })
  readsCount: number;
}
