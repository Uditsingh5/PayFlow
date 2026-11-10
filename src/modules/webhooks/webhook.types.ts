export interface WebhookEndpointRecord {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  status: 'active' | 'disabled';
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhook_endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  signature: string;
  response_status_code: number | null;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  last_error: string | null;
  created_at: Date;
  delivered_at: Date | null;
}

export interface CreateWebhookEndpointInput {
  url: string;
}

