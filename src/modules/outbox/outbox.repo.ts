import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { OutboxEventRecord } from './outbox.types.js';

export async function createOutboxEvent(
  client: PoolClient,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<OutboxEventRecord> {
  const query = `
    INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
    VALUES ($1, $2, $3, $4, 'pending')
    RETURNING id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, error_message, created_at, processed_at;
  `;
  const result = await client.query<OutboxEventRecord>(query, [
    aggregateType,
    aggregateId,
    eventType,
    JSON.stringify(payload),
  ]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create outbox event');
  }
  return row;
}

export async function fetchPendingOutboxEvents(batchSize = 20): Promise<OutboxEventRecord[]> {
  const query = `
    SELECT id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, error_message, created_at, processed_at
    FROM outbox_events
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT $1
    FOR UPDATE SKIP LOCKED;
  `;
  const result = await pool.query<OutboxEventRecord>(query, [batchSize]);
  return result.rows;
}

export async function markOutboxEventPublished(id: string): Promise<void> {
  const query = `
    UPDATE outbox_events
    SET status = 'published', processed_at = CURRENT_TIMESTAMP
    WHERE id = $1;
  `;
  await pool.query(query, [id]);
}

export async function markOutboxEventFailed(id: string, errorMessage: string): Promise<void> {
  const query = `
    UPDATE outbox_events
    SET status = CASE WHEN retry_count >= 5 THEN 'failed' ELSE 'pending' END,
        retry_count = retry_count + 1,
        error_message = $2,
        processed_at = CURRENT_TIMESTAMP
    WHERE id = $1;
  `;
  await pool.query(query, [id, errorMessage]);
}

