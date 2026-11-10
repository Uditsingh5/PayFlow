import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({quiet: true});

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
  // JWT_SECRET: z.string().trim().min(1, 'JWT_SECRET is required')
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