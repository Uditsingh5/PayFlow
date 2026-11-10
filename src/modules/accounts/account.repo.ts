import { pool } from '../../db/pool.js';
import type { AccountRecord } from './account.types.js';

export async function createAccount(userId: string, currency: string): Promise<AccountRecord> {
  const query = `
    INSERT INTO accounts (user_id, currency, balance, status)
    VALUES ($1, $2, 0, 'active')
    RETURNING id, user_id, currency, balance, status, created_at, updated_at;
  `;
  const result = await pool.query<AccountRecord>(query, [userId, currency]);
  const account = result.rows[0];

  if (!account) {
    throw new Error('Failed to create account');
  }

  return account;
}

export async function findAccountById(accountId: string): Promise<AccountRecord | null> {
  const query = `
    SELECT id, user_id, currency, balance, status, created_at, updated_at
    FROM accounts
    WHERE id = $1
    LIMIT 1;
  `;
  const result = await pool.query<AccountRecord>(query, [accountId]);
  return result.rows[0] ?? null;
}

export async function findAccountsByUserId(userId: string): Promise<AccountRecord[]> {
  const query = `
    SELECT id, user_id, currency, balance, status, created_at, updated_at
    FROM accounts
    WHERE user_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query<AccountRecord>(query, [userId]);
  return result.rows;
}

export async function findAccountByUserAndCurrency(
  userId: string,
  currency: string
): Promise<AccountRecord | null> {
  const query = `
    SELECT id, user_id, currency, balance, status, created_at, updated_at
    FROM accounts
    WHERE user_id = $1 AND currency = $2
    LIMIT 1;
  `;
  const result = await pool.query<AccountRecord>(query, [userId, currency]);
  return result.rows[0] ?? null;
}

