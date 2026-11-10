import app from './app.js';
import env from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { getRedisClient } from './lib/redis.js';
import { startOutboxPolling, stopOutboxPolling } from './modules/outbox/outbox.processor.js';

// Initialize Redis client eagerly (fails open if unavailable)
getRedisClient();

// Start outbox polling for Kafka publishing
if (env.NODE_ENV !== 'test') {
  startOutboxPolling(3000);
  logger.info('Outbox polling started');
}

const server = app.listen(env.PORT, () => {
  logger.info(`PayFlow server is running on port ${env.PORT} [${env.NODE_ENV}]`);
});

// --- Graceful Shutdown ---
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  stopOutboxPolling();

  server.close(async () => {
    const redis = getRedisClient();
    if (redis) {
      await redis.quit().catch(() => {});
    }
    await pool.end();
    logger.info('Server, database, and Redis connections closed.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
