import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "verdix-dev-jwt-secret-do-not-use-in-production-random-entropy";
const TOKEN_EXPIRY = "8h";

export interface AuthTokenPayload {
  userId: string;
  organizationId: string;
  role: UserRole;
  email: string;
  name: string;
}

export interface SafeUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Sign a JWT token with user authentication payload
 */
export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

/**
 * Hash a plaintext password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare plaintext password with stored bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Strip sensitive fields (especially passwordHash) before returning to client
 */
export function sanitizeUser(user: any): SafeUser {
  const { passwordHash, ...safe } = user;
  return safe as SafeUser;
}
