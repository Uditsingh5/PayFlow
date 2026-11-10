import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app.error.js';
import env from '../config/env.js';

interface PostgresDatabaseError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // 1. Known Operational AppErrors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: formattedErrors,
    });
    return;
  }

  // 3. PostgreSQL Unique Constraint Violations (23505)
  const pgError = err as PostgresDatabaseError;
  if (pgError.code === '23505') {
    let message = 'Duplicate key value violates unique constraint';
    if (pgError.constraint === 'uq_users_email' || pgError.detail?.includes('email')) {
      message = 'Email is already registered';
    }

    res.status(409).json({
      status: 'error',
      message,
    });
    return;
  }

  // 4. JWT Authentication Errors
  if (
    err instanceof Error &&
    (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
  ) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
    });
    return;
  }

  // 5. JSON Syntax Error from body-parser
  if (err instanceof SyntaxError && 'status' in err && (err as { status: unknown }).status === 400) {
    res.status(400).json({
      status: 'error',
      message: 'Malformed JSON in request body',
    });
    return;
  }

  // 6. Unhandled Internal Server Errors
  console.error('Unhandled server error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    ...(env.NODE_ENV === 'development' && err instanceof Error ? { detail: err.message } : {}),
  });
}

