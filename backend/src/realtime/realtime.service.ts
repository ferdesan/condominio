import type { Server as SocketServer } from 'socket.io';
import { logger } from '@/config/logger';

export const ROOM = {
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  user: (userId: string) => `user:${userId}`,
  condominium: (condominiumId: string) => `condominium:${condominiumId}`,
  unit: (unitId: string) => `unit:${unitId}`,
} as const;

export type RealtimeEvent =
  | 'notification:new'
  | 'announcement:published'
  | 'reservation:updated'
  | 'correspondence:received'
  | 'visitor:arrived'
  | 'incident:updated'
  | 'charge:updated'
  | 'poll:updated'
  | 'dashboard:refresh';

/**
 * Fachada sobre o Socket.IO. Os servicos de dominio dependem apenas desta
 * interface — quando o servidor de sockets nao esta inicializado (testes,
 * workers), as emissoes viram no-op em vez de quebrar a operacao.
 */
export class RealtimeService {
  private io: SocketServer | null = null;

  register(io: SocketServer): void {
    this.io = io;
  }

  isEnabled(): boolean {
    return this.io !== null;
  }

  emitToUser(userId: string, event: RealtimeEvent, payload: unknown): void {
    this.emit(ROOM.user(userId), event, payload);
  }

  emitToTenant(tenantId: string, event: RealtimeEvent, payload: unknown): void {
    this.emit(ROOM.tenant(tenantId), event, payload);
  }

  emitToCondominium(condominiumId: string, event: RealtimeEvent, payload: unknown): void {
    this.emit(ROOM.condominium(condominiumId), event, payload);
  }

  emitToUnit(unitId: string, event: RealtimeEvent, payload: unknown): void {
    this.emit(ROOM.unit(unitId), event, payload);
  }

  private emit(room: string, event: RealtimeEvent, payload: unknown): void {
    if (!this.io) return;
    try {
      this.io.to(room).emit(event, payload);
    } catch (error) {
      logger.warn(`Realtime emit failed (${event}): ${(error as Error).message}`);
    }
  }
}

export const realtimeService = new RealtimeService();
