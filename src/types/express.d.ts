import type { UserResponse } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserResponse;
    }
  }
}

export {};

