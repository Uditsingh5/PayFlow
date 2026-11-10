import { z } from 'zod';

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD'] as const;

export const createAccountSchema = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => SUPPORTED_CURRENCIES.includes(val as (typeof SUPPORTED_CURRENCIES)[number]), {
      message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
    }),
});

export const accountIdParamSchema = z.object({
  id: z.string().uuid('Invalid account UUID format'),
});

