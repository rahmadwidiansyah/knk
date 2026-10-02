import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { config } from "../config";
import { getDb } from "../db/connection";
import { users } from "../db/schema";
import type { AuthUser, JwtPayload, LoginResponse } from "../types/api.types";

function now(): string {
  return new Date().toISOString();
}

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role === "admin" ? "admin" : "user",
  };
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
  };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const row = rows[0];
  if (!row || row.isActive !== 1) {
    throw Object.assign(new Error("Invalid username or password"), { status: 401 });
  }

  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) {
    throw Object.assign(new Error("Invalid username or password"), { status: 401 });
  }

  const user = toAuthUser(row);
  return { token: signToken(user), user };
}

export async function register(
  actor: AuthUser,
  input: { username: string; password: string; role?: "admin" | "user" }
): Promise<AuthUser> {
  if (actor.role !== "admin") {
    throw Object.assign(new Error("Only admin can register new users"), { status: 403 });
  }

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (existing.length > 0) {
    throw Object.assign(new Error("Username already taken"), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const row = {
    id: randomUUID(),
    username: input.username,
    passwordHash,
    role: input.role === "admin" ? "admin" : "user",
    isActive: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(users).values(row);
  return { id: row.id, username: row.username, role: row.role as "admin" | "user" };
}

export async function getMe(userId: string): Promise<AuthUser> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  if (!row || row.isActive !== 1) {
    throw Object.assign(new Error("User not found or inactive"), { status: 404 });
  }
  return toAuthUser(row);
}
