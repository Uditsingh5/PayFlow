import { ConflictError, NotFoundError } from '../../errors/app.error.js';
import * as accountRepo from './account.repo.js';
import type { AccountRecord, CreateAccountInput } from './account.types.js';

export async function createAccount(
  userId: string,
  input: CreateAccountInput
): Promise<AccountRecord> {
  const existing = await accountRepo.findAccountByUserAndCurrency(userId, input.currency);
  if (existing) {
    throw new ConflictError(
      `An account with currency ${input.currency} already exists for this user`
    );
  }

  return accountRepo.createAccount(userId, input.currency);
}

export async function getAccountsForUser(userId: string): Promise<AccountRecord[]> {
  return accountRepo.findAccountsByUserId(userId);
}

export async function getAccountById(userId: string, accountId: string): Promise<AccountRecord> {
  const account = await accountRepo.findAccountById(accountId);

  // Enforce ownership: return 404 if account does not exist or belongs to another user
  if (!account || account.user_id !== userId) {
    throw new NotFoundError('Account not found');
  }

  return account;
}

