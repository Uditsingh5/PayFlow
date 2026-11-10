import { NotFoundError } from '../../errors/app.error.js';
import { generateWebhookSecret, generateWebhookSignature } from './webhook.crypto.js';
import * as webhookRepo from './webhook.repo.js';
import type { CreateWebhookEndpointInput, WebhookDeliveryRecord, WebhookEndpointRecord } from './webhook.types.js';

export async function registerWebhookEndpoint(
  userId: string,
  input: CreateWebhookEndpointInput
): Promise<WebhookEndpointRecord> {
  const secret = generateWebhookSecret();
  return webhookRepo.createWebhookEndpoint(userId, input.url, secret);
}

export async function listWebhookEndpoints(userId: string): Promise<Omit<WebhookEndpointRecord, 'secret'>[]> {
  const endpoints = await webhookRepo.findEndpointsByUserId(userId);
  // Redact secrets in list view
  return endpoints.map(({ secret: _, ...safe }) => safe);
}

export async function deleteWebhookEndpoint(userId: string, endpointId: string): Promise<void> {
  const deleted = await webhookRepo.deleteEndpointById(endpointId, userId);
  if (!deleted) {
    throw new NotFoundError('Webhook endpoint not found');
  }
}

export async function deliverWebhookEvent(
  endpoint: WebhookEndpointRecord,
  eventType: string,
  payload: Record<string, unknown>
): Promise<WebhookDeliveryRecord> {
  const serialized = JSON.stringify(payload);
  const signature = generateWebhookSignature(serialized, endpoint.secret);

  const delivery = await webhookRepo.createWebhookDelivery(
    endpoint.id,
    eventType,
    payload,
    signature
  );

  let attempts = 0;
  const maxAttempts = 3;
  let lastError: string | null = null;
  let lastStatus: number | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PayFlow-Event': eventType,
          'X-PayFlow-Signature': signature,
          'X-PayFlow-Delivery-Id': delivery.id,
        },
        body: serialized,
        signal: AbortSignal.timeout(5000),
      });

      lastStatus = response.status;
      if (response.ok) {
        await webhookRepo.updateWebhookDelivery(delivery.id, 'success', lastStatus, attempts, null);
        delivery.status = 'success';
        delivery.response_status_code = lastStatus;
        delivery.attempts = attempts;
        return delivery;
      }
      lastError = `HTTP status ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
  }

  await webhookRepo.updateWebhookDelivery(delivery.id, 'failed', lastStatus, attempts, lastError);
  delivery.status = 'failed';
  delivery.response_status_code = lastStatus;
  delivery.attempts = attempts;
  delivery.last_error = lastError;
  return delivery;
}

