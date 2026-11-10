import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { LedgerAuditSummary, LedgerEntryRecord, LedgerTransactionRecord } from './ledger.types.js';

export async function createLedgerTransaction(
  client: PoolClient,
  paymentId: string | null,
  type: LedgerTransactionRecord['type'],
  description: string | null
): Promise<LedgerTransactionRecord> {
  const query = `
    INSERT INTO ledger_transactions (payment_id, type, description)
    VALUES ($1, $2, $3)
    RETURNING id, payment_id, type, description, created_at;
  `;
  const result = await client.query<LedgerTransactionRecord>(query, [paymentId, type, description]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create ledger transaction');
  }
  return row;
}

export async function createLedgerEntry(
  client: PoolClient,
  transactionId: string,
  accountId: string,
  entryType: 'debit' | 'credit',
  amount: number | bigint
): Promise<LedgerEntryRecord> {
  const query = `
    INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount)
    VALUES ($1, $2, $3, $4)
    RETURNING id, transaction_id, account_id, entry_type, amount, created_at;
  `;
  const result = await client.query<LedgerEntryRecord>(query, [
    transactionId,
    accountId,
    entryType,
    amount.toString(),
  ]);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create ledger entry');
  }
  return row;
}

export async function getEntriesByAccountId(accountId: string): Promise<LedgerEntryRecord[]> {
  const query = `
    SELECT id, transaction_id, account_id, entry_type, amount, created_at
    FROM ledger_entries
    WHERE account_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await pool.query<LedgerEntryRecord>(query, [accountId]);
  return result.rows;
}

export async function getEntriesByTransactionId(transactionId: string): Promise<LedgerEntryRecord[]> {
  const query = `
    SELECT id, transaction_id, account_id, entry_type, amount, created_at
    FROM ledger_entries
    WHERE transaction_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query<LedgerEntryRecord>(query, [transactionId]);
  return result.rows;
}

export async function auditAccountBalance(accountId: string): Promise<LedgerAuditSummary | null> {
  const query = `
    WITH ledger_calc AS (
      SELECT
        account_id,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS total_credits,
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0) AS total_debits
      FROM ledger_entries
      WHERE account_id = $1
      GROUP BY account_id
    )
    SELECT
      a.id AS "accountId",
      a.balance AS "storedBalance",
      COALESCE(lc.total_credits, 0)::text AS "totalCredits",
      COALESCE(lc.total_debits, 0)::text AS "totalDebits",
      (COALESCE(lc.total_credits, 0) - COALESCE(lc.total_debits, 0))::text AS "computedBalance",
      (a.balance = (COALESCE(lc.total_credits, 0) - COALESCE(lc.total_debits, 0))) AS "isBalanced"
    FROM accounts a
    LEFT JOIN ledger_calc lc ON a.id = lc.account_id
    WHERE a.id = $1;
  `;
  const result = await pool.query<LedgerAuditSummary>(query, [accountId]);
  return result.rows[0] ?? null;
}

