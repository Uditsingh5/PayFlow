import { KAFKA_TOPICS, publishEvent } from '../../lib/kafka.js';
import * as outboxRepo from './outbox.repo.js';

let isPolling = false;
let pollingTimer: NodeJS.Timeout | null = null;

export async function processOutboxBatch(batchSize = 20): Promise<number> {
  const events = await outboxRepo.fetchPendingOutboxEvents(batchSize);
  if (events.length === 0) {
    return 0;
  }

  for (const event of events) {
    try {
      const topic =
        event.aggregate_type === 'payment' ? KAFKA_TOPICS.PAYMENTS : KAFKA_TOPICS.ACCOUNTS;

      await publishEvent(topic, event.aggregate_id, {
        eventId: event.id,
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        payload: event.payload,
        createdAt: event.created_at,
      });

      await outboxRepo.markOutboxEventPublished(event.id);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown publish failure';
      await outboxRepo.markOutboxEventFailed(event.id, errMsg);
    }
  }

  return events.length;
}

export function startOutboxPolling(intervalMs = 2000): void {
  if (isPolling) return;
  isPolling = true;

  const poll = async () => {
    if (!isPolling) return;
    try {
      await processOutboxBatch();
    } catch (err) {
      console.error('Error during outbox polling batch:', err);
    } finally {
      if (isPolling) {
        pollingTimer = setTimeout(poll, intervalMs);
      }
    }
  };

  pollingTimer = setTimeout(poll, intervalMs);
}

export function stopOutboxPolling(): void {
  isPolling = false;
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
}

