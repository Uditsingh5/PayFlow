import type { NextFunction, Request, Response } from 'express';
import { generateReconciliationReport } from './reconciliation.service.js';

export async function getReconciliationReportHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const report = await generateReconciliationReport();
    res.status(200).json({
      status: 'success',
      data: { report },
    });
  } catch (error) {
    next(error);
  }
}
