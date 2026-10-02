import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { connectors } from "../db/schema";
import type { AuthUser } from "../types/api.types";
import { decrypt, encrypt } from "./crypto.service";
import { tgGetMe } from "../integrations/telegram/client";
import { wahaGetSessions } from "../integrations/waha/client";

function now(): string {
  return new Date().toISOString();
}

export interface TelegramCfg {
  bot_token: string;
  secret_token?: string;
}

export interface WahaCfg {
  base_url: string;
  api_key?: string;
  session?: string;
}

export function parseTelegramCfg(raw: unknown): TelegramCfg {
  const c = (raw || {}) as Record<string, any>;
  if (!c.bot_token || typeof c.bot_token !== "string" || !c.bot_token.includes(":")) {
    throw Object.assign(new Error("Telegram config butuh bot_token valid (format 123:ABC)"), { status: 400 });
  }
  return { bot_token: c.bot_token, secret_token: c.secret_token };
}

export function parseWahaCfg(raw: unknown): WahaCfg {
  const c = (raw || {}) as Record<string, any>;
  if (!c.base_url || typeof c.base_url !== "string") {
    throw Object.assign(new Error("WAHA config butuh base_url (contoh http://192.168.1.10:3000)"), { status: 400 });
  }
  let u: URL;
  try {
    u = new URL(c.base_url);
  } catch {
    throw Object.assign(new Error("WAHA base_url tidak valid"), { status: 400 });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error("WAHA base_url harus http(s)"), { status: 400 });
  }
  return { base_url: c.base_url.replace(/\/$/, ""), api_key: c.api_key, session: c.session || "default" };
}

function redact(type: string, cfg: Record<string, any>): Record<string, any> {
  if (type === "telegram") {
    return {
      bot_token: mask(cfg.bot_token),
      ...(cfg.secret_token ? { secret_token: mask(cfg.secret_token) } : {}),
    };
  }
  return {
    base_url: cfg.base_url,
    ...(cfg.api_key ? { api_key: mask(cfg.api_key) } : {}),
    session: cfg.session || "default",
  };
}

function mask(v: unknown): string {
  const s = String(v || "");
  if (s.length <= 6) return "***";
  return `***${s.slice(-4)}`;
}

function toResponse(row: typeof connectors.$inferSelect, includeUrl = false) {
  let cfg: Record<string, any> = {};
  try {
    cfg = JSON.parse(decrypt(row.config));
  } catch {
    cfg = { _decrypt_error: true };
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    config: redact(row.type, cfg),
    has_config: true,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listConnectors(actor: AuthUser, all = false) {
  const db = getDb();
  const rows = await db.select().from(connectors).orderBy(desc(connectors.updatedAt));
  const filtered = actor.role === "admin" && all ? rows : rows.filter((r) => r.userId === actor.id);
  return filtered.map((r) => toResponse(r));
}

/** Ambil connector milik user (atau admin) + decrypt config penuh. Untuk executor/receiver. */
export async function getConnectorDecrypted(id: string): Promise<{
  row: typeof connectors.$inferSelect;
  cfg: Record<string, any>;
}> {
  const db = getDb();
  const rows = await db.select().from(connectors).where(eq(connectors.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw Object.assign(new Error("Connector tidak ditemukan"), { status: 404 });
  let cfg: Record<string, any>;
  try {
    cfg = JSON.parse(decrypt(row.config));
  } catch (e: any) {
    throw Object.assign(new Error(`Connector '${row.name}' gagal didekripsi: ${e.message}`), { status: 500 });
  }
  return { row, cfg };
}

export async function mustOwnConnector(actor: AuthUser, id: string) {
  const { row } = await getConnectorDecrypted(id);
  if (actor.role !== "admin" && row.userId !== actor.id) {
    throw Object.assign(new Error("Tidak punya akses ke connector ini"), { status: 403 });
  }
  return row;
}

/** Resolve connector_id ATAU nama (termasuk hasil {{connector.nama}}). */
export async function resolveConnector(userId: string, ref: string, type?: string) {
  const db = getDb();
  const byId = await db.select().from(connectors).where(eq(connectors.id, ref)).limit(1);
  let row = byId[0];
  if (!row) {
    const all = await db.select().from(connectors).where(eq(connectors.userId, userId));
    row = all.find((r) => r.name === ref && (!type || r.type === type)) as any;
  }
  if (!row) throw Object.assign(new Error(`Connector '${ref}' tidak ditemukan`), { status: 404 });
  if (row.isActive !== 1) throw Object.assign(new Error(`Connector '${row.name}' nonaktif`), { status: 400 });
  let cfg: Record<string, any>;
  try {
    cfg = JSON.parse(decrypt(row.config));
  } catch (e: any) {
    throw Object.assign(new Error(`Connector '${row.name}' gagal didekripsi: ${e.message}`), { status: 500 });
  }
  return { row, cfg };
}

export async function createConnector(
  actor: AuthUser,
  input: { type: string; name: string; config: unknown }
) {
  if (input.type !== "telegram" && input.type !== "waha") {
    throw Object.assign(new Error("Connector type harus telegram|waha"), { status: 400 });
  }
  if (!input.name?.trim()) throw Object.assign(new Error("Connector name wajib diisi"), { status: 400 });
  const parsed = input.type === "telegram" ? parseTelegramCfg(input.config) : parseWahaCfg(input.config);
  const db = getDb();
  const ts = now();
  const row = {
    id: randomUUID(),
    userId: actor.id,
    type: input.type,
    name: input.name.trim(),
    config: encrypt(JSON.stringify(parsed)),
    isActive: 1,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(connectors).values(row);
  return { id: row.id, type: row.type, name: row.name };
}

export async function updateConnector(
  actor: AuthUser,
  id: string,
  input: { name?: string; config?: unknown; is_active?: number }
) {
  const row = await mustOwnConnector(actor, id);
  const patch: Partial<typeof connectors.$inferInsert> = { updatedAt: now() };
  if (input.name !== undefined) {
    if (!input.name.trim()) throw Object.assign(new Error("name tidak boleh kosong"), { status: 400 });
    patch.name = input.name.trim();
  }
  if (input.config !== undefined) {
    const parsed = row.type === "telegram" ? parseTelegramCfg(input.config) : parseWahaCfg(input.config);
    patch.config = encrypt(JSON.stringify(parsed));
  }
  if (input.is_active !== undefined) patch.isActive = input.is_active ? 1 : 0;
  const db = getDb();
  await db.update(connectors).set(patch).where(eq(connectors.id, id));
  const after = await db.select().from(connectors).where(eq(connectors.id, id)).limit(1);
  return toResponse(after[0]);
}

export async function deleteConnector(actor: AuthUser, id: string) {
  await mustOwnConnector(actor, id);
  const db = getDb();
  await db.delete(connectors).where(eq(connectors.id, id));
  return { ok: true };
}

export async function testConnector(actor: AuthUser, id: string) {
  const row = await mustOwnConnector(actor, id);
  const { cfg } = await getConnectorDecrypted(id);
  if (row.type === "telegram") {
    const me = await tgGetMe(parseTelegramCfg(cfg).bot_token);
    return { ok: true, type: "telegram", username: me.username };
  }
  const wcfg = parseWahaCfg(cfg);
  const sessions = await wahaGetSessions(wcfg);
  const mine = sessions.find((s: any) => s.name === (wcfg.session || "default"));
  return {
    ok: true,
    type: "waha",
    session: wcfg.session || "default",
    session_status: mine?.status || "NOT_FOUND",
    sessions: sessions.map((s: any) => ({ name: s.name, status: s.status })),
  };
}
