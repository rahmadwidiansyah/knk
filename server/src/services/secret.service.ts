import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { secrets } from "../db/schema";
import type { AuthUser } from "../types/api.types";
import { decrypt, encrypt } from "./crypto.service";

const KEY_RE = /^[A-Z0-9_]{1,64}$/;

export function assertSecretKey(key: string): void {
  if (!KEY_RE.test(key)) {
    throw Object.assign(
      new Error("Secret key harus A-Z, 0-9, _ (max 64), contoh: OPENAI_API_KEY"),
      { status: 400 }
    );
  }
}

export async function listSecrets(actor: AuthUser) {
  const db = getDb();
  const rows = await db.select().from(secrets).where(eq(secrets.userId, actor.id));
  return rows.map((r) => ({ id: r.id, key: r.key, has_value: true, created_at: r.createdAt }));
}

export async function upsertSecret(actor: AuthUser, key: string, value: string) {
  assertSecretKey(key);
  if (!value || value.length > 8192) {
    throw Object.assign(new Error("Secret value wajib diisi (max 8192 char)"), { status: 400 });
  }
  const db = getDb();
  const existing = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.userId, actor.id), eq(secrets.key, key)))
    .limit(1);
  const enc = encrypt(value);
  if (existing.length > 0) {
    await db.update(secrets).set({ encryptedValue: enc }).where(eq(secrets.id, existing[0].id));
    return { id: existing[0].id, key };
  }
  const id = randomUUID();
  await db.insert(secrets).values({ id, userId: actor.id, key, encryptedValue: enc, createdAt: new Date().toISOString() });
  return { id, key };
}

export async function deleteSecret(actor: AuthUser, id: string) {
  const db = getDb();
  const rows = await db.select().from(secrets).where(eq(secrets.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw Object.assign(new Error("Secret tidak ditemukan"), { status: 404 });
  if (row.userId !== actor.id && actor.role !== "admin") {
    throw Object.assign(new Error("Tidak punya akses"), { status: 403 });
  }
  await db.delete(secrets).where(eq(secrets.id, id));
  return { ok: true };
}

/** Decrypt semua secrets milik user → { KEY: value }. Dipakai executor saat load context. */
export async function getDecryptedSecrets(userId: string): Promise<Record<string, string>> {
  const db = getDb();
  const rows = await db.select().from(secrets).where(eq(secrets.userId, userId));
  const out: Record<string, string> = {};
  for (const r of rows) {
    try {
      out[r.key] = decrypt(r.encryptedValue);
    } catch (e: any) {
      throw Object.assign(
        new Error(`Secret '${r.key}' gagal didekripsi (ENCRYPTION_KEY berubah?): ${e.message}`),
        { status: 500 }
      );
    }
  }
  return out;
}
