import * as reconciliationRepo from './reconciliation.repo.js';
import type { ReconciliationReport } from './reconciliation.types.js';

export async function generateReconciliationReport(): Promise<ReconciliationReport> {
  const [balanceAudit, doubleEntryAudit, paymentConsistency] = await Promise.all([
    reconciliationRepo.checkAccountBalanceDiscrepancies(),
    reconciliationRepo.checkDoubleEntryBalancing(),
    reconciliationRepo.checkPaymentToLedgerConsistency(),
  ]);

  const hasIssues =
    balanceAudit.discrepancies.length > 0 ||
    doubleEntryAudit.unbalanced.length > 0 ||
    paymentConsistency.length > 0;

  return {
    timestamp: new Date().toISOString(),
    totalAccountsAudited: balanceAudit.totalAudited,
    totalTransactionsAudited: doubleEntryAudit.totalAudited,
    isSystemHealthy: !hasIssues,
    accountDiscrepancies: balanceAudit.discrepancies,
    unbalancedTransactions: doubleEntryAudit.unbalanced,
    missingLedgerPayments: paymentConsistency,
  };
}
