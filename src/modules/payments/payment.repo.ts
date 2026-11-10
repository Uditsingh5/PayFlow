import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { PaymentRecord } from './payment.types.js';

export async function findPaymentById(paymentId: string): Promise<PaymentRecord | null> {
  const query = `
    SELECT id, source_account_id, destination_account_id, amount, currency,
           status, idempotency_key, failure_reason, metadata, created_at, updated_at
    FROM payments
    WHERE id = $1
    LIMIT 1;
  `;
  const result = await pool.query<PaymentRecord>(query, [paymentId]);
  return result.rows[0] ?? null;
}

export async function findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
  const query = `
    SELECT id, source_account_id, destination_account_id, amount, currency,
           status, idempotency_key, failure_reason, metadata, created_at, updated_at
    FROM payments
    WHERE idempotency_key = $1
    LIMIT 1;
  `;
  const result = await pool.query<PaymentRecord>(query, [key]);
  return result.rows[0] ?? null;
}

export async function createPaymentRecord(
  client: PoolClient,
  data: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    currency: string;
    status: PaymentRecord['status'];
    idempotencyKey?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
  }
): Promise<PaymentRecord> {
  const query = `
    INSERT INTO payments (
      source_account_id, destination_account_id, amount, currency,
      status, idempotency_key, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, source_account_id, destination_account_id, amount, currency,
              status, idempotency_key, failure_reason, metadata, created_at, updated_at;
  `;
  const values = [
    data.sourceAccountId,
    data.destinationAccountId,
    data.amount,
    data.currency,
    data.status,
    data.idempotencyKey ?? null,
    JSON.stringify(data.metadata ?? {}),
  ];

  const result = await client.query<PaymentRecord>(query, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create payment record');
  }
  return row;
}

export async function updatePaymentStatus(
  client: PoolClient,
  paymentId: string,
  status: PaymentRecord['status'],
  failureReason: string | null = null
): Promise<PaymentRecord> {
  const query = `
    UPDATE payments
    SET status = $1, failure_reason = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, source_account_id, destination_account_id, amount, currency,
              status, idempotency_key, failure_reason, metadata, created_at, updated_at;
  `;
  const result = await client.query<PaymentRecord>(query, [status, failureReason, paymentId]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Payment not found to update status');
  }
  return row;
}
