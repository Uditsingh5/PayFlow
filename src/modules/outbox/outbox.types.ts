export interface OutboxEventRecord {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'published' | 'failed';
  retry_count: number;
  error_message: string | null;
  created_at: Date;
  processed_at: Date | null;
}

