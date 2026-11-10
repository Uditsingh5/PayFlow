import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { ConflictError, UnauthorizedError } from '../../errors/app.error.js';
import { createUser, findUserByEmail, findUserById } from './auth.repo.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';
import type { UserRecord, UserResponse } from './auth.types.js';

const BCRYPT_SALT_ROUNDS = 10;

export interface LoginResult {
  accessToken: string;
  user: UserResponse;
}

function sanitizeUser(user: UserRecord): UserResponse {
  const { password_hash, ...sanitized } = user;
  return sanitized;
}

export async function register(input: RegisterInput): Promise<UserResponse> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new ConflictError('Email is already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  const user = await createUser({
    name: input.name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return sanitizeUser(user);
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const signOptions: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as unknown as number,
  };

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    env.JWT_SECRET,
    signOptions
  );

  return {
    accessToken,
    user: sanitizeUser(user),
  };
}

export async function getCurrentUser(userId: string): Promise<UserResponse> {
  const user = await findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }

  return sanitizeUser(user);
}
