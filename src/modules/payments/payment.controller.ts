import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/app.error.js';
import * as paymentService from './payment.service.js';
import type { CreatePaymentInput, DepositFundsInput } from './payment.types.js';

export async function createPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const payment = await paymentService.processPayment(
      req.user.id,
      req.body as CreatePaymentInput
    );

    res.status(201).json({
      status: 'success',
      message: 'Payment processed successfully',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const paymentId = req.params.id as string;
    const payment = await paymentService.getPaymentById(req.user.id, paymentId);

    res.status(200).json({
      status: 'success',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
}

export async function refundPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const paymentId = req.params.id as string;
    const payment = await paymentService.refundPayment(req.user.id, paymentId);

    res.status(200).json({
      status: 'success',
      message: 'Payment refunded successfully',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
}

export async function depositFundsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const accountId = req.params.id as string;
    const account = await paymentService.depositFunds(
      req.user.id,
      accountId,
      req.body as DepositFundsInput
    );

    res.status(200).json({
      status: 'success',
      message: 'Funds deposited successfully',
      data: { account },
    });
  } catch (error) {
    next(error);
  }
}

