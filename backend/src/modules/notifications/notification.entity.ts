import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const NOTIFICATION_TYPES = [
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR',
  'ANNOUNCEMENT',
  'CHARGE',
  'RESERVATION',
  'CORRESPONDENCE',
  'INCIDENT',
  'ASSEMBLY',
  'VISITOR',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Notificacao in-app entregue em tempo real via Socket.IO. */
@Entity('notifications')
@Index(['tenantId', 'userId', 'readAt'])
export class Notification extends TenantScopedEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'condominium_id', type: 'varchar', length: 36, nullable: true })
  condominiumId?: string | null;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  message: string;

  @Column({ type: 'varchar', length: 20, default: 'INFO' })
  type: NotificationType;

  @Column({ type: 'varchar', length: 60, nullable: true })
  resource?: string | null;

  @Column({ name: 'resource_id', type: 'varchar', length: 36, nullable: true })
  resourceId?: string | null;

  @Column({ name: 'action_url', type: 'varchar', length: 255, nullable: true })
  actionUrl?: string | null;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt?: Date | null;
}
