import type { AuthUser } from './middlewares/auth';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      user?: AuthUser;
    }
  }
}

export {};
