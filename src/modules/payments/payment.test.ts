import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import app from '../../app.js';
import { pool } from '../../db/pool.js';

describe('Payments & Double-Entry Ledger Integration Tests', () => {
  let server: Server;
  let baseUrl: string;
  let userAToken = '';
  let userBToken = '';
  let userAAccountId = '';
  let userBAccountId = '';
  let paymentId = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // Create User A
    const resA = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Payer A',
        email: `payera_${Date.now()}@example.com`,
        password: 'Password123!',
      }),
    });
    const dataA = (await resA.json()) as { data: { user: { email: string } } };
    const loginA = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dataA.data.user.email, password: 'Password123!' }),
    });
    userAToken = ((await loginA.json()) as { data: { accessToken: string } }).data.accessToken;

    // Create User B
    const resB = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Payee B',
        email: `payeeb_${Date.now()}@example.com`,
        password: 'Password123!',
      }),
    });
    const dataB = (await resB.json()) as { data: { user: { email: string } } };
    const loginB = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dataB.data.user.email, password: 'Password123!' }),
    });
    userBToken = ((await loginB.json()) as { data: { accessToken: string } }).data.accessToken;

    // Create Account for User A (USD)
    const accResA = await fetch(`${baseUrl}/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ currency: 'USD' }),
    });
    userAAccountId = ((await accResA.json()) as { data: { account: { id: string } } }).data.account.id;

    // Create Account for User B (USD)
    const accResB = await fetch(`${baseUrl}/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ currency: 'USD' }),
    });
    userBAccountId = ((await accResB.json()) as { data: { account: { id: string } } }).data.account.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await pool.end();
  });

  it('should deposit 10,000 minor units ($100.00) into User A account', async () => {
    const res = await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ amount: 10000, currency: 'USD' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { account: { balance: string } } };
    expect(body.data.account.balance).toBe('10000');
  });

  it('should execute a payment of 2,500 minor units ($25.00) from User A to User B', async () => {
    const idempotencyKey = `idemp_test_${Date.now()}`;
    const res = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        sourceAccountId: userAAccountId,
        destinationAccountId: userBAccountId,
        amount: 2500,
        currency: 'USD',
        idempotencyKey,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      status: string;
      data: { payment: { id: string; status: string; amount: string } };
    };
    expect(body.status).toBe('success');
    expect(body.data.payment.status).toBe('succeeded');
    expect(body.data.payment.amount).toBe('2500');
    paymentId = body.data.payment.id;

    // Check balances
    const checkA = await (
      await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })
    ).json() as { data: { account: { balance: string } } };
    expect(checkA.data.account.balance).toBe('7500'); // 10000 - 2500

    const checkB = await (
      await fetch(`${baseUrl}/api/v1/accounts/${userBAccountId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      })
    ).json() as { data: { account: { balance: string } } };
    expect(checkB.data.account.balance).toBe('2500'); // 0 + 2500
  });

  it('should enforce idempotency by returning existing payment and not deducting funds twice', async () => {
    const idempotencyKey = `idemp_test_repeat_${Date.now()}`;

    // First request
    const firstRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        sourceAccountId: userAAccountId,
        destinationAccountId: userBAccountId,
        amount: 1000,
        currency: 'USD',
        idempotencyKey,
      }),
    });
    expect(firstRes.status).toBe(201);
    const firstPayment = ((await firstRes.json()) as { data: { payment: { id: string } } }).data.payment;

    // Second request with SAME idempotency key
    const secondRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        sourceAccountId: userAAccountId,
        destinationAccountId: userBAccountId,
        amount: 1000,
        currency: 'USD',
        idempotencyKey,
      }),
    });

    expect(secondRes.status).toBe(201);
    const secondPayment = ((await secondRes.json()) as { data: { payment: { id: string } } }).data.payment;
    expect(secondPayment.id).toBe(firstPayment.id);

    // Balance should have been deducted only once: 7500 - 1000 = 6500
    const checkA = await (
      await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })
    ).json() as { data: { account: { balance: string } } };
    expect(checkA.data.account.balance).toBe('6500');
  });

  it('should reject payment when source account has insufficient funds (atomic rollback)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        sourceAccountId: userAAccountId,
        destinationAccountId: userBAccountId,
        amount: 999999, // User A only has 6500
        currency: 'USD',
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('Insufficient funds');

    // Balance unchanged
    const checkA = await (
      await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })
    ).json() as { data: { account: { balance: string } } };
    expect(checkA.data.account.balance).toBe('6500');
  });

  it('should verify Double-Entry Ledger integrity and balance audit for both accounts', async () => {
    const auditA = await (
      await fetch(`${baseUrl}/api/v1/ledger/accounts/${userAAccountId}/audit`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })
    ).json() as { data: { audit: { isBalanced: boolean; storedBalance: string; computedBalance: string } } };

    expect(auditA.data.audit.isBalanced).toBe(true);
    expect(auditA.data.audit.storedBalance).toBe(auditA.data.audit.computedBalance);

    const auditB = await (
      await fetch(`${baseUrl}/api/v1/ledger/accounts/${userBAccountId}/audit`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      })
    ).json() as { data: { audit: { isBalanced: boolean; storedBalance: string; computedBalance: string } } };

    expect(auditB.data.audit.isBalanced).toBe(true);
    expect(auditB.data.audit.storedBalance).toBe(auditB.data.audit.computedBalance);
  });

  it('should refund a payment, reversing balances and logging double-entry entries', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { payment: { status: string } } };
    expect(body.data.payment.status).toBe('refunded');

    // User A should have refunded 2500 back: 6500 + 2500 = 9000
    const checkA = await (
      await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })
    ).json() as { data: { account: { balance: string } } };
    expect(checkA.data.account.balance).toBe('9000');
  });

  it(
    'should safely handle concurrent payments without overspending or corrupting balances',
    async () => {
      // User A has 9,000 minor units.
      // Send 4 concurrent requests for 3,000 each = 12,000 total requested.
      // Exactly 3 must succeed (3 * 3000 = 9000), 1 must fail with 400 Insufficient funds!
      const requests = Array.from({ length: 4 }, (_, i) =>
        fetch(`${baseUrl}/api/v1/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userAToken}`,
          },
          body: JSON.stringify({
            sourceAccountId: userAAccountId,
            destinationAccountId: userBAccountId,
            amount: 3000,
            currency: 'USD',
            idempotencyKey: `concurrent_${Date.now()}_${i}`,
          }),
        })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 201).length;
      const failureCount = statuses.filter((s) => s === 400).length;

      expect(successCount).toBe(3);
      expect(failureCount).toBe(1);

      // Final balance of User A must be exactly 0 (9000 - 3 * 3000 = 0)
      const checkA = (await (
        await fetch(`${baseUrl}/api/v1/accounts/${userAAccountId}`, {
          headers: { Authorization: `Bearer ${userAToken}` },
        })
      ).json()) as { data: { account: { balance: string } } };
      expect(checkA.data.account.balance).toBe('0');
    },
    20000
  );
});
