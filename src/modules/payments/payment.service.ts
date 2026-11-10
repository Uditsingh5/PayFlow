import { pool } from '../../db/pool.js';
import { BadRequestError, NotFoundError } from '../../errors/app.error.js';
import * as accountRepo from '../accounts/account.repo.js';
import type { AccountRecord } from '../accounts/account.types.js';
import * as ledgerRepo from '../ledger/ledger.repo.js';
import * as outboxRepo from '../outbox/outbox.repo.js';
import * as paymentRepo from './payment.repo.js';
import type { CreatePaymentInput, DepositFundsInput, PaymentRecord } from './payment.types.js';

export async function processPayment(
  userId: string,
  input: CreatePaymentInput
): Promise<PaymentRecord> {
  // 1. Authoritative idempotency check
  if (input.idempotencyKey) {
    const existingPayment = await paymentRepo.findPaymentByIdempotencyKey(input.idempotencyKey);
    if (existingPayment) {
      return existingPayment;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Lock both accounts in deterministic order (sorted by ID) to eliminate deadlocks
    const [firstId, secondId] = [input.sourceAccountId, input.destinationAccountId].sort();
    const lockQuery = `
      SELECT id, user_id, currency, balance, status
      FROM accounts
      WHERE id IN ($1, $2)
      ORDER BY id ASC
      FOR UPDATE;
    `;
    const lockRes = await client.query<AccountRecord>(lockQuery, [firstId, secondId]);
    const accountsMap = new Map(lockRes.rows.map((a) => [a.id, a]));

    const sourceAccount = accountsMap.get(input.sourceAccountId);
    const destinationAccount = accountsMap.get(input.destinationAccountId);

    if (!sourceAccount || !destinationAccount) {
      throw new NotFoundError('One or both accounts were not found');
    }

    if (sourceAccount.user_id !== userId) {
      throw new NotFoundError('Source account not found or not owned by user');
    }

    if (sourceAccount.status !== 'active') {
      throw new BadRequestError(`Source account is ${sourceAccount.status}`);
    }

    if (destinationAccount.status !== 'active') {
      throw new BadRequestError(`Destination account is ${destinationAccount.status}`);
    }

    if (sourceAccount.currency !== input.currency || destinationAccount.currency !== input.currency) {
      throw new BadRequestError(
        `Currency mismatch: Payment currency (${input.currency}) does not match accounts (${sourceAccount.currency}, ${destinationAccount.currency})`
      );
    }

    const currentBalance = BigInt(sourceAccount.balance);
    const paymentAmount = BigInt(input.amount);

    if (currentBalance < paymentAmount) {
      throw new BadRequestError('Insufficient funds in source account');
    }

    // 3. Atomically update balances
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
      [input.amount.toString(), sourceAccount.id]
    );

    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
      [input.amount.toString(), destinationAccount.id]
    );

    // 4. Create payment record
    const payment = await paymentRepo.createPaymentRecord(client, {
      sourceAccountId: sourceAccount.id,
      destinationAccountId: destinationAccount.id,
      amount: input.amount,
      currency: input.currency,
      status: 'succeeded',
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });

    // 5. Create double-entry ledger transaction and balanced debit/credit entries
    const ledgerTx = await ledgerRepo.createLedgerTransaction(
      client,
      payment.id,
      'payment',
      `Payment ${payment.id} from ${sourceAccount.id} to ${destinationAccount.id}`
    );

    await ledgerRepo.createLedgerEntry(client, ledgerTx.id, sourceAccount.id, 'debit', input.amount);
    await ledgerRepo.createLedgerEntry(client, ledgerTx.id, destinationAccount.id, 'credit', input.amount);

    // 6. Write outbox event in the same transaction
    await outboxRepo.createOutboxEvent(client, 'payment', payment.id, 'payment.succeeded', {
      paymentId: payment.id,
      sourceAccountId: sourceAccount.id,
      destinationAccountId: destinationAccount.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    });

    await client.query('COMMIT');
    return payment;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function depositFunds(
  userId: string,
  accountId: string,
  input: DepositFundsInput
): Promise<AccountRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lockQuery = `
      SELECT id, user_id, currency, balance, status
      FROM accounts
      WHERE id = $1
      FOR UPDATE;
    `;
    const lockRes = await client.query<AccountRecord>(lockQuery, [accountId]);
    const account = lockRes.rows[0];

    if (!account || account.user_id !== userId) {
      throw new NotFoundError('Account not found');
    }

    if (account.status !== 'active') {
      throw new BadRequestError(`Account is ${account.status}`);
    }

    if (account.currency !== input.currency) {
      throw new BadRequestError(
        `Deposit currency (${input.currency}) does not match account currency (${account.currency})`
      );
    }

    const updateRes = await client.query<AccountRecord>(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;`,
      [input.amount.toString(), account.id]
    );
    const updatedAccount = updateRes.rows[0];
    if (!updatedAccount) {
      throw new Error('Failed to update balance');
    }

    const ledgerTx = await ledgerRepo.createLedgerTransaction(
      client,
      null,
      'deposit',
      `Deposit of ${input.amount} ${input.currency} into ${account.id}`
    );
    await ledgerRepo.createLedgerEntry(client, ledgerTx.id, account.id, 'credit', input.amount);

    await outboxRepo.createOutboxEvent(client, 'account', account.id, 'account.deposited', {
      accountId: account.id,
      amount: input.amount.toString(),
      currency: input.currency,
    });

    await client.query('COMMIT');
    return updatedAccount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function refundPayment(userId: string, paymentId: string): Promise<PaymentRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await paymentRepo.findPaymentById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status !== 'succeeded') {
      throw new BadRequestError(`Payment cannot be refunded in status '${payment.status}'`);
    }

    const sourceAccount = await accountRepo.findAccountById(payment.source_account_id);
    if (!sourceAccount || sourceAccount.user_id !== userId) {
      throw new NotFoundError('Unauthorized to refund this payment');
    }

    // Lock destination (original recipient) and source (original payer)
    const [firstId, secondId] = [payment.source_account_id, payment.destination_account_id].sort();
    const lockRes = await client.query<AccountRecord>(
      `SELECT id, user_id, currency, balance, status FROM accounts WHERE id IN ($1, $2) ORDER BY id ASC FOR UPDATE;`,
      [firstId, secondId]
    );
    const accountsMap = new Map(lockRes.rows.map((a) => [a.id, a]));

    const origRecipient = accountsMap.get(payment.destination_account_id);
    const origPayer = accountsMap.get(payment.source_account_id);

    if (!origRecipient || !origPayer) {
      throw new NotFoundError('Accounts associated with payment not found');
    }

    const refundAmount = BigInt(payment.amount);
    if (BigInt(origRecipient.balance) < refundAmount) {
      throw new BadRequestError('Recipient account has insufficient funds to process refund');
    }

    // Reverse balances
    await client.query(
      `UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
      [payment.amount, origRecipient.id]
    );
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
      [payment.amount, origPayer.id]
    );

    const updatedPayment = await paymentRepo.updatePaymentStatus(client, payment.id, 'refunded');

    const ledgerTx = await ledgerRepo.createLedgerTransaction(
      client,
      payment.id,
      'refund',
      `Refund for payment ${payment.id}`
    );
    await ledgerRepo.createLedgerEntry(client, ledgerTx.id, origRecipient.id, 'debit', Number(refundAmount));
    await ledgerRepo.createLedgerEntry(client, ledgerTx.id, origPayer.id, 'credit', Number(refundAmount));

    await outboxRepo.createOutboxEvent(client, 'payment', payment.id, 'payment.refunded', {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: 'refunded',
    });

    await client.query('COMMIT');
    return updatedPayment;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getPaymentById(userId: string, paymentId: string): Promise<PaymentRecord> {
  const payment = await paymentRepo.findPaymentById(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // User must own either the source or destination account
  const accounts = await accountRepo.findAccountsByUserId(userId);
  const accountIds = new Set(accounts.map((a) => a.id));

  if (!accountIds.has(payment.source_account_id) && !accountIds.has(payment.destination_account_id)) {
    throw new NotFoundError('Payment not found');
  }

  return payment;
}

