import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({quiet: true});

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().trim().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().trim().default('1h'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().trim().default('redis://localhost:6379'),
  KAFKA_BROKERS: z.string().trim().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().trim().default('payflow'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {

  // console.log(result.error.issues);
  const missingVariables = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');

  throw new Error(
    `Invalid environment configuration: ${missingVariables}`
  );
}

export default result.data;