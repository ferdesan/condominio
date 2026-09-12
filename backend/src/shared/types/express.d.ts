import type { AuthContext } from './auth-context';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id propagated to logs and audit records. */
      requestId: string;
      /** Present only after the `authenticate` middleware. */
      auth?: AuthContext;
    }
  }
}

export {};
