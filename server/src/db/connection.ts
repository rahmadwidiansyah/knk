import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle as drizzleNodeSqlite } from "drizzle-orm-node-sqlite";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { config } from "../config";
import * as schema from "./schema";

let sqlite: DatabaseSync | null = null;
let dbInstance: SqliteRemoteDatabase<typeof schema> | null = null;

const INIT_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  display_name TEXT,
  theme_preference TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  json_config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  status TEXT NOT NULL DEFAULT 'running',
  trigger_type TEXT NOT NULL,
  input_data TEXT,
  output_data TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id),
  node_id TEXT NOT NULL,
  node_name TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_data TEXT,
  output_data TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  path TEXT UNIQUE NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, key)
);
`;

export function getSqlite(): DatabaseSync {
  if (sqlite) return sqlite;
  const dbPath = path.resolve(config.dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sqlite = new DatabaseSync(dbPath);
  return sqlite;
}

export function getDb(): SqliteRemoteDatabase<typeof schema> {
  if (dbInstance) return dbInstance;
  dbInstance = drizzleNodeSqlite({ client: getSqlite(), schema });
  return dbInstance;
}

export function runMigrations(): void {
  const db = getSqlite();
  db.exec(INIT_SQL);
  // Kolom baru untuk DB lama (idempoten, aman diulang).
  const cols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("display_name")) db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT`);
  if (!names.has("theme_preference")) {
    db.exec(`ALTER TABLE users ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system'`);
  }
}

export function closeDb(): void {
  sqlite?.close();
  sqlite = null;
  dbInstance = null;
}
