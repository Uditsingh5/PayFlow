import { z } from 'zod';

export const createWebhookEndpointSchema = z.object({
  url: z
    .string()
    .trim()
    .url('Invalid URL format')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
      message: 'Webhook URL must use HTTP or HTTPS protocol',
    }),
});

