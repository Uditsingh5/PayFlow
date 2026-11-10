export interface AccountRecord {
  id: string;
  user_id: string;
  currency: string;
  balance: string; // BIGINT is returned as string by pg to avoid JS precision loss
  status: 'active' | 'frozen' | 'closed';
  created_at: Date;
  updated_at: Date;
}

export interface CreateAccountInput {
  currency: string;
}

