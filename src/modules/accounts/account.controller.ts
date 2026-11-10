import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/app.error.js';
import * as accountService from './account.service.js';
import type { CreateAccountInput } from './account.types.js';

export async function createAccountHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const account = await accountService.createAccount(
      req.user.id,
      req.body as CreateAccountInput
    );

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      data: { account },
    });
  } catch (error) {
    next(error);
  }
}

export async function listAccountsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const accounts = await accountService.getAccountsForUser(req.user.id);

    res.status(200).json({
      status: 'success',
      data: { accounts },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAccountHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const accountId = req.params.id as string;
    const account = await accountService.getAccountById(req.user.id, accountId);

    res.status(200).json({
      status: 'success',
      data: { account },
    });
  } catch (error) {
    next(error);
  }
}

