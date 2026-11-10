import { Pool } from 'pg';
import env from '../config/env.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});



// Steps to use in reposotory of modules.

// 1. import { pool } from './db/pool';
// 2. Inside async function, use the following steps to perform a transaction:
// 3. const client = await pool.connect();

// 4. await client.query('BEGIN');
// 5. preform your queries using client.query('YOUR SQL QUERY');
// 6. await client.query('COMMIT');
// 7. await client.query('ROLLBACK');
// 8. in finally block
// 9. client.release();