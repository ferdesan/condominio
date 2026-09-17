import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const DOCUMENT_CATEGORIES = [
  'CONVENTION',
  'REGULATION',
  'MINUTES',
  'CONTRACT',
  'FINANCIAL',
  'REPORT',
  'INSURANCE',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Quem enxerga o documento no portal. */
export const DOCUMENT_VISIBILITIES = ['PUBLIC', 'RESIDENTS', 'OWNERS', 'STAFF', 'ADMIN'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

@Entity('documents')
@Index(['tenantId', 'condominiumId', 'category'])
export class DocumentFile extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'OTHER' })
  category: DocumentCategory;

  @Column({ type: 'varchar', length: 20, default: 'RESIDENTS' })
  visibility: DocumentVisibility;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  /**
   * Layout do armazenamento, com o id do tenant embutido. Nunca sai numa
   * resposta: `select: false` mantem a coluna fora de toda leitura da
   * `BaseRepository`, e as duas leituras internas que precisam dela pedem
   * explicitamente, por `DocumentRepository.findStoredPath` (ADR-001).
   */
  @Column({ name: 'file_path', type: 'varchar', length: 255, select: false })
  filePath: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes: number;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'uploaded_by_id', type: 'varchar', length: 36, nullable: true })
  uploadedById?: string | null;

  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt?: string | null;

  @Column({ name: 'downloads_count', type: 'int', default: 0 })
  downloadsCount: number;

  @Column({ type: 'simple-json', nullable: true })
  tags?: string[] | null;
}
