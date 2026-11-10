import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/app.error.js';
import * as ledgerService from './ledger.service.js';

export async function getAccountLedgerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const accountId = req.params.accountId as string;
    const entries = await ledgerService.getAccountLedgerEntries(req.user.id, accountId);

    res.status(200).json({
      status: 'success',
      data: { entries },
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyAccountAuditHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const accountId = req.params.accountId as string;
    const audit = await ledgerService.verifyAccountIntegrity(req.user.id, accountId);

    res.status(200).json({
      status: 'success',
      data: { audit },
    });
  } catch (error) {
    next(error);
  }
}

