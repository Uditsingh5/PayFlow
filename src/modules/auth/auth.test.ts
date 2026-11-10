import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import app from '../../app.js';
import { pool } from '../../db/pool.js';

describe('Auth Module Integration Tests', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await pool.end();
  });

  const testEmail = `payflow_user_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Alice PayFlow';
  let accessToken = '';

  describe('POST /api/v1/auth/register', () => {
    it('should reject registration with invalid email', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          email: 'invalid-email',
          password: 'Password123!',
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { status: string; errors: { field: string }[] };
      expect(data.status).toBe('error');
      expect(data.errors.some((e) => e.field === 'email')).toBe(true);
    });

    it('should reject registration with short password (< 8 chars)', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          email: 'shortpass@example.com',
          password: 'short',
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { status: string; errors: { field: string }[] };
      expect(data.status).toBe('error');
      expect(data.errors.some((e) => e.field === 'password')).toBe(true);
    });

    it('should successfully register a new user and normalize email', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `  ${testName}  `,
          email: `  ${testEmail.toUpperCase()}  `,
          password: testPassword,
        }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as {
        status: string;
        message: string;
        data: { user: Record<string, unknown> };
      };
      expect(data.status).toBe('success');
      expect(data.data.user.name).toBe(testName);
      expect(data.data.user.email).toBe(testEmail.toLowerCase());
      expect(data.data.user.id).toBeDefined();
      expect(data.data.user.password_hash).toBeUndefined();
      expect(data.data.user.created_at).toBeDefined();
      expect(data.data.user.updated_at).toBeDefined();
    });

    it('should prevent duplicate email registration with 409 Conflict', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate User',
          email: testEmail,
          password: 'AnotherPassword123!',
        }),
      });

      expect(response.status).toBe(409);
      const data = (await response.json()) as { status: string; message: string };
      expect(data.status).toBe('error');
      expect(data.message).toBe('Email is already registered');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject login with wrong password', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'WrongPassword!',
        }),
      });

      expect(response.status).toBe(401);
      const data = (await response.json()) as { status: string; message: string };
      expect(data.status).toBe('error');
      expect(data.message).toBe('Invalid email or password');
    });

    it('should reject login for non-existent user with generic message', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        }),
      });

      expect(response.status).toBe(401);
      const data = (await response.json()) as { status: string; message: string };
      expect(data.status).toBe('error');
      expect(data.message).toBe('Invalid email or password');
    });

    it('should successfully login and return JWT access token', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail.toUpperCase(),
          password: testPassword,
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        status: string;
        message: string;
        data: {
          accessToken: string;
          user: Record<string, unknown>;
        };
      };
      expect(data.status).toBe('success');
      expect(data.data.accessToken).toBeDefined();
      expect(typeof data.data.accessToken).toBe('string');
      expect(data.data.user.email).toBe(testEmail.toLowerCase());
      expect(data.data.user.password_hash).toBeUndefined();

      accessToken = data.data.accessToken;
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject access without token', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/me`);
      expect(response.status).toBe(401);
      const data = (await response.json()) as { status: string; message: string };
      expect(data.status).toBe('error');
      expect(data.message).toBe('Authentication token required');
    });

    it('should reject access with malformed header', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(response.status).toBe(401);
    });

    it('should reject access with invalid token signature', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Bearer this.is.an.invalid.token' },
      });
      expect(response.status).toBe(401);
      const data = (await response.json()) as { status: string; message: string };
      expect(data.status).toBe('error');
      expect(data.message).toBe('Invalid or expired token');
    });

    it('should return current user when valid Bearer token is provided', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        status: string;
        data: { user: Record<string, unknown> };
      };
      expect(data.status).toBe('success');
      expect(data.data.user.email).toBe(testEmail.toLowerCase());
      expect(data.data.user.name).toBe(testName);
      expect(data.data.user.password_hash).toBeUndefined();
      expect(data.data.user.id).toBeDefined();
    });
  });
});

