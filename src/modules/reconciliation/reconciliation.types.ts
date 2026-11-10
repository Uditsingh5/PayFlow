export interface AccountDiscrepancy {
  accountId: string;
  currency: string;
  storedBalance: string;
  computedBalance: string;
  difference: string;
}

export interface UnbalancedTransaction {
  transactionId: string;
  totalDebits: string;
  totalCredits: string;
  difference: string;
}

export interface MissingLedgerPayment {
  paymentId: string;
  amount: string;
  currency: string;
  status: string;
}

export interface ReconciliationReport {
  timestamp: string;
  totalAccountsAudited: number;
  totalTransactionsAudited: number;
  isSystemHealthy: boolean;
  accountDiscrepancies: AccountDiscrepancy[];
  unbalancedTransactions: UnbalancedTransaction[];
  missingLedgerPayments: MissingLedgerPayment[];
}
