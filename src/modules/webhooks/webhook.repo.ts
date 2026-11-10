import { pool } from '../../db/pool.js';
import type { WebhookDeliveryRecord, WebhookEndpointRecord } from './webhook.types.js';

export async function createWebhookEndpoint(
  userId: string,
  url: string,
  secret: string
): Promise<WebhookEndpointRecord> {
  const query = `
    INSERT INTO webhook_endpoints (user_id, url, secret, status)
    VALUES ($1, $2, $3, 'active')
    RETURNING id, user_id, url, secret, status, created_at, updated_at;
  `;
  const result = await pool.query<WebhookEndpointRecord>(query, [userId, url, secret]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create webhook endpoint');
  }
  return row;
}

export async function findEndpointsByUserId(userId: string): Promise<WebhookEndpointRecord[]> {
  const query = `
    SELECT id, user_id, url, secret, status, created_at, updated_at
    FROM webhook_endpoints
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await pool.query<WebhookEndpointRecord>(query, [userId]);
  return result.rows;
}

export async function findEndpointById(id: string): Promise<WebhookEndpointRecord | null> {
  const query = `
    SELECT id, user_id, url, secret, status, created_at, updated_at
    FROM webhook_endpoints
    WHERE id = $1
    LIMIT 1;
  `;
  const result = await pool.query<WebhookEndpointRecord>(query, [id]);
  return result.rows[0] ?? null;
}

export async function deleteEndpointById(id: string, userId: string): Promise<boolean> {
  const query = `
    DELETE FROM webhook_endpoints
    WHERE id = $1 AND user_id = $2;
  `;
  const result = await pool.query(query, [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function createWebhookDelivery(
  endpointId: string,
  eventType: string,
  payload: Record<string, unknown>,
  signature: string
): Promise<WebhookDeliveryRecord> {
  const query = `
    INSERT INTO webhook_deliveries (
      webhook_endpoint_id, event_type, payload, signature, status, attempts
    )
    VALUES ($1, $2, $3, $4, 'pending', 0)
    RETURNING id, webhook_endpoint_id, event_type, payload, signature, response_status_code,
              status, attempts, last_error, created_at, delivered_at;
  `;
  const result = await pool.query<WebhookDeliveryRecord>(query, [
    endpointId,
    eventType,
    JSON.stringify(payload),
    signature,
  ]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create webhook delivery');
  }
  return row;
}

export async function updateWebhookDelivery(
  id: string,
  status: 'success' | 'failed',
  responseStatusCode: number | null,
  attempts: number,
  lastError: string | null
): Promise<void> {
  const query = `
    UPDATE webhook_deliveries
    SET status = $1, response_status_code = $2, attempts = $3, last_error = $4,
        delivered_at = CASE WHEN $1 = 'success' THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = $5;
  `;
  await pool.query(query, [status, responseStatusCode, attempts, lastError, id]);
}

