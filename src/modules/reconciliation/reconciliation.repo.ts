import { pool } from '../../db/pool.js';
import type {
  AccountDiscrepancy,
  MissingLedgerPayment,
  UnbalancedTransaction,
} from './reconciliation.types.js';

export async function checkAccountBalanceDiscrepancies(): Promise<{
  totalAudited: number;
  discrepancies: AccountDiscrepancy[];
}> {
  const countQuery = `SELECT COUNT(*)::int AS count FROM accounts;`;
  const countRes = await pool.query<{ count: number }>(countQuery);
  const totalAudited = countRes.rows[0]?.count ?? 0;

  const query = `
    WITH ledger_totals AS (
      SELECT
        account_id,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS total_credits,
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0) AS total_debits
      FROM ledger_entries
      GROUP BY account_id
    )
    SELECT
      a.id AS "accountId",
      a.currency AS "currency",
      a.balance::text AS "storedBalance",
      (COALESCE(lt.total_credits, 0) - COALESCE(lt.total_debits, 0))::text AS "computedBalance",
      (a.balance - (COALESCE(lt.total_credits, 0) - COALESCE(lt.total_debits, 0)))::text AS "difference"
    FROM accounts a
    LEFT JOIN ledger_totals lt ON a.id = lt.account_id
    WHERE a.balance <> (COALESCE(lt.total_credits, 0) - COALESCE(lt.total_debits, 0));
  `;
  const result = await pool.query<AccountDiscrepancy>(query);
  return {
    totalAudited,
    discrepancies: result.rows,
  };
}

export async function checkDoubleEntryBalancing(): Promise<{
  totalAudited: number;
  unbalanced: UnbalancedTransaction[];
}> {
  const countQuery = `SELECT COUNT(*)::int AS count FROM ledger_transactions;`;
  const countRes = await pool.query<{ count: number }>(countQuery);
  const totalAudited = countRes.rows[0]?.count ?? 0;

  const query = `
    SELECT
      lt.id AS "transactionId",
      COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0)::text AS "totalDebits",
      COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0)::text AS "totalCredits",
      (
        COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0)
      )::text AS "difference"
    FROM ledger_transactions lt
    JOIN ledger_entries le ON lt.id = le.transaction_id
    WHERE lt.type IN ('payment', 'refund') -- Payments and refunds must strictly balance debits == credits
    GROUP BY lt.id
    HAVING
      COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) <>
      COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0);
  `;
  const result = await pool.query<UnbalancedTransaction>(query);
  return {
    totalAudited,
    unbalanced: result.rows,
  };
}

export async function checkPaymentToLedgerConsistency(): Promise<MissingLedgerPayment[]> {
  const query = `
    SELECT
      p.id AS "paymentId",
      p.amount::text AS "amount",
      p.currency AS "currency",
      p.status AS "status"
    FROM payments p
    LEFT JOIN ledger_transactions lt ON p.id = lt.payment_id
    WHERE p.status IN ('succeeded', 'refunded') AND lt.id IS NULL;
  `;
  const result = await pool.query<MissingLedgerPayment>(query);
  return result.rows;
}
