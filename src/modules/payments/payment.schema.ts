import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../accounts/account.schema.js';

export const createPaymentSchema = z
  .object({
    sourceAccountId: z.string().uuid('Invalid source account UUID'),
    destinationAccountId: z.string().uuid('Invalid destination account UUID'),
    amount: z
      .number()
      .int('Amount must be an integer in minor units')
      .positive('Amount must be strictly greater than 0'),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => SUPPORTED_CURRENCIES.includes(val as (typeof SUPPORTED_CURRENCIES)[number]), {
        message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
      }),
    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.sourceAccountId !== data.destinationAccountId, {
    message: 'Source and destination accounts must be distinct',
    path: ['destinationAccountId'],
  });

export const depositFundsSchema = z.object({
  amount: z
    .number()
    .int('Amount must be an integer in minor units')
    .positive('Amount must be strictly greater than 0'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => SUPPORTED_CURRENCIES.includes(val as (typeof SUPPORTED_CURRENCIES)[number]), {
      message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
    }),
});
