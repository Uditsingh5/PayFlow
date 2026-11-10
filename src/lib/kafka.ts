import { Kafka, logLevel, type Consumer, type Producer } from 'kafkajs';
import env from '../config/env.js';

export const KAFKA_TOPICS = {
  PAYMENTS: 'payflow.payments',
  ACCOUNTS: 'payflow.accounts',
  DLQ: 'payflow.dlq',
} as const;

let kafkaInstance: Kafka | null = null;
let producerInstance: Producer | null = null;

export function getKafka(): Kafka {
  if (!kafkaInstance) {
    const brokers = env.KAFKA_BROKERS.split(',').map((b) => b.trim());
    kafkaInstance = new Kafka({
      clientId: env.KAFKA_CLIENT_ID,
      brokers,
      logLevel: logLevel.NOTHING,
      retry: {
        initialRetryTime: 100,
        retries: 3,
      },
    });
  }
  return kafkaInstance;
}

export async function getKafkaProducer(): Promise<Producer> {
  if (!producerInstance) {
    const kafka = getKafka();
    producerInstance = kafka.producer({
      allowAutoTopicCreation: true,
    });
    await producerInstance.connect();
  }
  return producerInstance;
}

export async function publishEvent(
  topic: string,
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  try {
    const producer = await getKafkaProducer();
    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(value),
          timestamp: Date.now().toString(),
        },
      ],
    });
  } catch (error) {
    // In test or environments where Kafka is offline, log without bringing down application
    if (env.NODE_ENV !== 'test') {
      console.warn(`Kafka publish skipped/failed for topic ${topic}:`, error);
    }
  }
}

export async function createKafkaConsumer(groupId: string): Promise<Consumer> {
  const kafka = getKafka();
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  return consumer;
}

