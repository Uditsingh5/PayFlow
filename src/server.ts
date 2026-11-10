import app from './app.js';
import env from './config/env.js';
import { pool } from './db/pool.js';

const server = app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});

// --- Graceful Shutdown ---
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    await pool.end();
    console.log('Server and database connections closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));