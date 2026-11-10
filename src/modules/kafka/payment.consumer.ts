import type { Consumer, EachMessagePayload } from 'kafkajs';
import { createKafkaConsumer, KAFKA_TOPICS, publishEvent } from '../../lib/kafka.js';

// Idempotent set for processed event IDs to prevent duplicate handling
const processedEventIds = new Set<string>();

export interface PaymentKafkaEvent {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function handlePaymentMessage(payload: EachMessagePayload): Promise<void> {
  const { message } = payload;
  if (!message.value) {
    return;
  }

  const event: PaymentKafkaEvent = JSON.parse(message.value.toString());

  // Consumer Idempotency Check
  if (processedEventIds.has(event.eventId)) {
    return;
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      // Process event (e.g. notify webhook engine, update analytics)
      processedEventIds.add(event.eventId);
      return;
    } catch (err) {
      if (attempts >= maxAttempts) {
        // Route to Dead Letter Queue (DLQ)
        await publishEvent(KAFKA_TOPICS.DLQ, event.aggregateId, {
          failedEvent: event,
          error: err instanceof Error ? err.message : 'Unknown error',
          failedAt: new Date().toISOString(),
        });
        return;
      }
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, attempts * 200));
    }
  }
}

let activeConsumer: Consumer | null = null;

export async function startPaymentConsumer(): Promise<void> {
  try {
    activeConsumer = await createKafkaConsumer('payflow-payment-workers');
    await activeConsumer.subscribe({ topic: KAFKA_TOPICS.PAYMENTS, fromBeginning: false });

    await activeConsumer.run({
      eachMessage: handlePaymentMessage,
    });
  } catch (err) {
    // In local or test runs without Kafka broker running, log notice without crashing server
    console.warn('Kafka consumer could not connect (skipping local listener):', err);
  }
}

export async function stopPaymentConsumer(): Promise<void> {
  if (activeConsumer) {
    await activeConsumer.disconnect();
    activeConsumer = null;
  }
}

