import { NotFoundError } from '../../errors/app.error.js';
import * as accountRepo from '../accounts/account.repo.js';
import * as ledgerRepo from './ledger.repo.js';
import type { LedgerAuditSummary, LedgerEntryRecord } from './ledger.types.js';

export async function getAccountLedgerEntries(
  userId: string,
  accountId: string
): Promise<LedgerEntryRecord[]> {
  const account = await accountRepo.findAccountById(accountId);
  if (!account || account.user_id !== userId) {
    throw new NotFoundError('Account not found');
  }

  return ledgerRepo.getEntriesByAccountId(accountId);
}

export async function verifyAccountIntegrity(
  userId: string,
  accountId: string
): Promise<LedgerAuditSummary> {
  const account = await accountRepo.findAccountById(accountId);
  if (!account || account.user_id !== userId) {
    throw new NotFoundError('Account not found');
  }

  const audit = await ledgerRepo.auditAccountBalance(accountId);
  if (!audit) {
    throw new NotFoundError('Account not found');
  }

  return audit;
}

