import { pool } from '../../db/pool.js';
import type { UserRecord } from './auth.types.js';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

export async function createUser(data: CreateUserData): Promise<UserRecord> {
  const query = `
    INSERT INTO users (name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, name, email, password_hash, created_at, updated_at;
  `;
  const values = [data.name, data.email, data.passwordHash];

  const result = await pool.query<UserRecord>(query, values);
  const user = result.rows[0];

  if (!user) {
    throw new Error('Failed to create user record');
  }

  return user;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const query = `
    SELECT id, name, email, password_hash, created_at, updated_at
    FROM users
    WHERE email = $1
    LIMIT 1;
  `;
  const result = await pool.query<UserRecord>(query, [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const query = `
    SELECT id, name, email, password_hash, created_at, updated_at
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;
  const result = await pool.query<UserRecord>(query, [id]);
  return result.rows[0] ?? null;
}
