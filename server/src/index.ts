import cron from "node-cron";
import { eq } from "drizzle-orm";
import { config } from "./config";
import { createApp } from "./app";
import { getDb, runMigrations } from "./db/connection";
import { executions } from "./db/schema";
import { resyncAllSchedules } from "./services/scheduler.service";
import { cleanupOldExecutions } from "./services/maintenance.service";

async function markOrphanedRunning(): Promise<void> {
  try {
    const db = getDb();
    const rows = await db.select({ id: executions.id }).from(executions).where(eq(executions.status, "running"));
    for (const r of rows) {
      await db
        .update(executions)
        .set({ status: "failed", errorMessage: "Server restart saat execution berjalan", finishedAt: new Date().toISOString() })
        .where(eq(executions.id, r.id));
    }
    if (rows.length > 0) console.log(`[boot] menandai ${rows.length} execution yatim sebagai failed`);
  } catch (e: any) {
    console.warn("[boot] gagal menandai execution yatim:", e?.message);
  }
}

async function main() {
  runMigrations();

  // Seed admin secara lazy tanpa overwrite password:
  // panggil seed.ts terpisah saat setup awal (npm run seed).
  // Di sini hanya pastikan tabel siap.

  await markOrphanedRunning();
  await resyncAllSchedules();

  // Cleanup log lama: sekali saat boot + tiap hari jam 03:00.
  if (config.retentionDays > 0) {
    cleanupOldExecutions().catch((e) => console.warn("[cleanup] gagal saat boot:", e?.message));
    cron.schedule("0 3 * * *", () => {
      cleanupOldExecutions().catch((e) => console.warn("[cleanup] gagal terjadwal:", e?.message));
    });
    console.log(`[cleanup] retensi ${config.retentionDays} hari, jadwal harian 03:00`);
  } else {
    console.log("[cleanup] nonaktif (EXECUTION_RETENTION_DAYS=0)");
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[lightflow] listening on :${config.port} (${config.nodeEnv})`);
  });
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
