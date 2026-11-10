import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { UnauthorizedError } from '../errors/app.error.js';
import { getCurrentUser } from '../modules/auth/auth.service.js';
import type { JWTPayload } from '../modules/auth/auth.types.js';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError('Authentication token required');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new UnauthorizedError('Malformed authorization header. Expected "Bearer <token>"');
    }

    const token = parts[1];

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    if (!payload.sub) {
      throw new UnauthorizedError('Invalid token payload');
    }

    const user = await getCurrentUser(payload.sub);
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}
