export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export type UserResponse = Omit<UserRecord, 'password_hash'>;

export interface JWTPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

