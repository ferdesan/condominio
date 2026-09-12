import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { corsOrigins } from '@/config/env';
import { logger } from '@/config/logger';
import { authContextService } from '@/modules/auth/auth-context.service';
import { tokenService } from '@/modules/auth/token.service';
import type { AuthContext } from '@/shared/types/auth-context';
import { realtimeService, ROOM } from './realtime.service';

type AuthenticatedSocket = Socket & { auth?: AuthContext };

/**
 * Canal de tempo real. A mesma credencial do REST e exigida no handshake e o
 * cliente so entra nas salas do proprio tenant/condominios — nao ha topico
 * publico onde um morador possa escutar dados de outro condominio.
 */
export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 25_000,
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        next(new Error('UNAUTHORIZED'));
        return;
      }

      const payload = tokenService.verifyAccessToken(token);
      socket.auth = await authContextService.resolve(payload.tid, payload.sub, payload.sid);
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const auth = socket.auth;
    if (!auth) {
      socket.disconnect(true);
      return;
    }

    socket.join(ROOM.tenant(auth.tenantId));
    socket.join(ROOM.user(auth.userId));
    auth.condominiumIds.forEach((condominiumId) => socket.join(ROOM.condominium(condominiumId)));
    if (auth.unitId) socket.join(ROOM.unit(auth.unitId));

    logger.debug(`Socket connected: ${socket.id} (user ${auth.userId})`);

    /** Permite ao cliente acompanhar um condominio especifico que ja possua acesso. */
    socket.on('subscribe:condominium', (condominiumId: string) => {
      const allowed = auth.isSuperAdmin || !auth.condominiumIds.length || auth.condominiumIds.includes(condominiumId);
      if (allowed) socket.join(ROOM.condominium(condominiumId));
    });

    socket.on('unsubscribe:condominium', (condominiumId: string) => {
      socket.leave(ROOM.condominium(condominiumId));
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  realtimeService.register(io);
  logger.info('Socket.IO server initialised');

  return io;
}
