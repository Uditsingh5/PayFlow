import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import app from '../../app.js';
import { pool } from '../../db/pool.js';

describe('Accounts Module Integration Tests', () => {
  let server: Server;
  let baseUrl: string;
  let tokenUserA = '';
  let tokenUserB = '';
  let userAAccountId = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // Register User A
    const resA = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User A',
        email: `usera_${Date.now()}@example.com`,
        password: 'Password123!',
      }),
    });
    const dataA = (await resA.json()) as { data: { user: { email: string } } };

    const loginResA = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dataA.data.user.email,
        password: 'Password123!',
      }),
    });
    const loginDataA = (await loginResA.json()) as { data: { accessToken: string } };
    tokenUserA = loginDataA.data.accessToken;

    // Register User B
    const resB = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User B',
        email: `userb_${Date.now()}@example.com`,
        password: 'Password123!',
      }),
    });
    const dataB = (await resB.json()) as { data: { user: { email: string } } };

    const loginResB = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dataB.data.user.email,
        password: 'Password123!',
      }),
    });
    const loginDataB = (await loginResB.json()) as { data: { accessToken: string } };
    tokenUserB = loginDataB.data.accessToken;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await pool.end();
  });

  it('should successfully create an account with initial zero balance', async () => {
    const response = await fetch(`${baseUrl}/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({ currency: 'USD' }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      status: string;
      data: { account: { id: string; currency: string; balance: string; status: string } };
    };
    expect(body.status).toBe('success');
    expect(body.data.account.currency).toBe('USD');
    expect(body.data.account.balance).toBe('0');
    expect(body.data.account.status).toBe('active');
    userAAccountId = body.data.account.id;
  });

  it('should prevent creating duplicate account with same currency for the same user', async () => {
    const response = await fetch(`${baseUrl}/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({ currency: 'USD' }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { status: string; message: string };
    expect(body.status).toBe('error');
    expect(body.message).toContain('already exists');
  });

  it('should list all accounts for authenticated user', async () => {
    const response = await fetch(`${baseUrl}/api/v1/accounts`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      data: { accounts: { id: string; currency: string }[] };
    };
    expect(body.status).toBe('success');
    expect(body.data.accounts.length).toBeGreaterThanOrEqual(1);
    expect(body.data.accounts.some((a) => a.id === userAAccountId)).toBe(true);
  });

  it('should allow user to get their own account by ID', async () => {
    const response = await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      data: { account: { id: string; currency: string } };
    };
    expect(body.status).toBe('success');
    expect(body.data.account.id).toBe(userAAccountId);
  });

  it('should deny User B from accessing User A account (404 isolation)', async () => {
    const response = await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}`, {
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });

    expect(response.status).toBe(404);
  });
});

