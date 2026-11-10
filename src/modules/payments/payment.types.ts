export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export interface PaymentRecord {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: string; // integer minor units represented as string from BIGINT
  currency: string;
  status: PaymentStatus;
  idempotency_key: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number; // integer minor units (e.g. 5000 = $50.00)
  currency: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface DepositFundsInput {
  amount: number; // integer minor units
  currency: string;
}

