import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/app.error.js';
import * as webhookService from './webhook.service.js';
import type { CreateWebhookEndpointInput } from './webhook.types.js';

export async function createEndpointHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const endpoint = await webhookService.registerWebhookEndpoint(
      req.user.id,
      req.body as CreateWebhookEndpointInput
    );

    res.status(201).json({
      status: 'success',
      message: 'Webhook endpoint registered successfully. Save the signing secret securely.',
      data: { endpoint },
    });
  } catch (error) {
    next(error);
  }
}

export async function listEndpointsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const endpoints = await webhookService.listWebhookEndpoints(req.user.id);

    res.status(200).json({
      status: 'success',
      data: { endpoints },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteEndpointHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const endpointId = req.params.id as string;
    await webhookService.deleteWebhookEndpoint(req.user.id, endpointId);

    res.status(200).json({
      status: 'success',
      message: 'Webhook endpoint removed successfully',
    });
  } catch (error) {
    next(error);
  }
}

