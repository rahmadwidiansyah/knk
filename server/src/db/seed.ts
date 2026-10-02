import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { config } from "../config";
import { getDb, runMigrations, closeDb } from "./connection";
import { users } from "./schema";

function now(): string {
  return new Date().toISOString();
}

async function main() {
  runMigrations();
  const db = getDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, config.seedAdminUsername))
    .limit(1);

  if (existing.length > 0) {
    // Pastikan role admin & aktif, tapi jangan reset password diam-diam
    const u = existing[0];
    if (u.role !== "admin" || u.isActive !== 1) {
      await db
        .update(users)
        .set({ role: "admin", isActive: 1, updatedAt: now() })
        .where(eq(users.id, u.id));
      console.log(`[seed] promoted '${config.seedAdminUsername}' to admin.`);
    } else {
      console.log(`[seed] admin '${config.seedAdminUsername}' already exists.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(config.seedAdminPassword, 10);
  await db.insert(users).values({
    id: randomUUID(),
    username: config.seedAdminUsername,
    passwordHash,
    role: "admin",
    isActive: 1,
    createdAt: now(),
    updatedAt: now(),
  });
  console.log(`[seed] admin '${config.seedAdminUsername}' created.`);
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
