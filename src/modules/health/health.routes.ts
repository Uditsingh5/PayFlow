import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { isRedisConnected } from '../../lib/redis.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (req, res) => {
  try {
    // Check authoritative database
    await pool.query('SELECT 1;');

    const redisReady = isRedisConnected();

    res.status(200).json({
      status: 'ready',
      database: 'connected',
      redis: redisReady ? 'connected' : 'unavailable_fail_open',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Database check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
