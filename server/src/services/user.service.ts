import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db/connection";
import { users } from "../db/schema";

function now(): string {
  return new Date().toISOString();
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  themePreference: "light" | "dark" | "system";
  role: "admin" | "user";
}

function toProfile(row: typeof users.$inferSelect): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName ?? "",
    themePreference: row.themePreference === "light" || row.themePreference === "dark" ? row.themePreference : "system",
    role: row.role === "admin" ? "admin" : "user",
  };
}

async function loadOwned(userId: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  if (!row || row.isActive !== 1) {
    throw Object.assign(new Error("User not found or inactive"), { status: 404 });
  }
  return row;
}

export async function getProfile(userId: string): Promise<UserProfile> {
  return toProfile(await loadOwned(userId));
}

export async function updateProfile(
  userId: string,
  input: { username: string; displayName?: string }
): Promise<UserProfile> {
  const db = getDb();
  const username = input.username.trim();

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, userId)))
    .limit(1);
  if (taken.length > 0) {
    throw Object.assign(new Error("Username already taken"), { status: 409 });
  }

  const patch: Partial<typeof users.$inferInsert> = { username, updatedAt: now() };
  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    patch.displayName = displayName === "" ? null : displayName;
  }
  await db.update(users).set(patch).where(eq(users.id, userId));
  return getProfile(userId);
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string }
): Promise<{ ok: true }> {
  const db = getDb();
  const row = await loadOwned(userId);

  const ok = await bcrypt.compare(input.currentPassword, row.passwordHash);
  if (!ok) {
    // Sengaja generik: jangan bocorkan apakah user ada / password mana yang salah.
    throw Object.assign(new Error("Current password is incorrect"), { status: 401 });
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await db.update(users).set({ passwordHash, updatedAt: now() }).where(eq(users.id, userId));
  return { ok: true as const };
}

export async function updatePreferences(
  userId: string,
  input: { themePreference: "light" | "dark" | "system" }
): Promise<UserProfile> {
  const db = getDb();
  await db
    .update(users)
    .set({ themePreference: input.themePreference, updatedAt: now() })
    .where(eq(users.id, userId));
  return getProfile(userId);
}
