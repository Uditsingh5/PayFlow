export interface LedgerTransactionRecord {
  id: string;
  payment_id: string | null;
  type: 'payment' | 'refund' | 'reversal' | 'deposit';
  description: string | null;
  created_at: Date;
}

export interface LedgerEntryRecord {
  id: string;
  transaction_id: string;
  account_id: string;
  entry_type: 'debit' | 'credit';
  amount: string; // integer minor units represented as string from BIGINT
  created_at: Date;
}

export interface LedgerAuditSummary {
  accountId: string;
  totalDebits: string;
  totalCredits: string;
  computedBalance: string;
  storedBalance: string;
  isBalanced: boolean;
}

