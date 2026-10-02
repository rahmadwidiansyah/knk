import cron from "node-cron";
import { eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { workflows } from "../db/schema";
import { executeWorkflow } from "../engine/executor";

const tasks = new Map<string, cron.ScheduledTask>();

function buildRunner(workflowId: string, cronExpr: string) {
  return () => {
    (async () => {
      const db = getDb();
      const rows = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
      const row = rows[0];
      if (!row || row.isActive !== 1) return;
      let cfg: any;
      try {
        cfg = JSON.parse(row.jsonConfig);
      } catch {
        return;
      }
      if (cfg?.trigger?.type !== "schedule") return;
      const triggerData = { scheduled_at: new Date().toISOString(), cron: cronExpr };
      try {
        await executeWorkflow(workflowId, cfg, "schedule", triggerData);
      } catch (e: any) {
        console.error(`[schedule:${workflowId}] async failed:`, e?.message || e);
      }
    })().catch((e) => console.error(`[schedule:${workflowId}] runner error:`, e?.message || e));
  };
}

export function registerSchedule(workflowId: string, cronExpr: string, timezone?: string): void {
  unregisterSchedule(workflowId);
  if (!cron.validate(cronExpr)) {
    throw Object.assign(new Error(`Cron tidak valid: ${cronExpr}`), { status: 400 });
  }
  const opts: { scheduled: boolean; timezone?: string } = { scheduled: true };
  if (timezone) opts.timezone = timezone;
  const task = cron.schedule(cronExpr, buildRunner(workflowId, cronExpr), opts);
  tasks.set(workflowId, task);
}

export function unregisterSchedule(workflowId: string): void {
  const t = tasks.get(workflowId);
  if (t) {
    try {
      t.stop();
    } catch {
      // abaikan
    }
    tasks.delete(workflowId);
  }
}

export function isScheduled(workflowId: string): boolean {
  return tasks.has(workflowId);
}

export async function resyncAllSchedules(): Promise<{ registered: number }> {
  const db = getDb();
  const rows = await db.select().from(workflows).where(eq(workflows.isActive, 1));
  let registered = 0;
  for (const row of rows) {
    let cfg: any;
    try {
      cfg = JSON.parse(row.jsonConfig);
    } catch {
      continue;
    }
    if (cfg?.trigger?.type !== "schedule") {
      unregisterSchedule(row.id);
      continue;
    }
    const cronExpr = cfg.trigger.config?.cron;
    const timezone = cfg.trigger.config?.timezone;
    if (typeof cronExpr !== "string" || !cron.validate(cronExpr)) {
      console.warn(`[scheduler] skip ${row.id}: cron invalid '${cronExpr}'`);
      continue;
    }
    try {
      registerSchedule(row.id, cronExpr, timezone);
      registered++;
    } catch (e: any) {
      console.warn(`[scheduler] gagal register ${row.id}:`, e?.message);
    }
  }
  // Bersihkan task yatim (workflow sudah tidak aktif / dihapus)
  const activeIds = new Set(rows.map((r) => r.id));
  for (const id of [...tasks.keys()]) {
    if (!activeIds.has(id)) unregisterSchedule(id);
  }
  console.log(`[scheduler] resync: ${registered} jadwal aktif`);
  return { registered };
}

/** Dipanggil setelah create/update/toggle/delete workflow. */
export async function syncWorkflowSchedule(workflowId: string): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
  const row = rows[0];
  if (!row || row.isActive !== 1) {
    unregisterSchedule(workflowId);
    return;
  }
  let cfg: any;
  try {
    cfg = JSON.parse(row.jsonConfig);
  } catch {
    unregisterSchedule(workflowId);
    return;
  }
  if (cfg?.trigger?.type !== "schedule") {
    unregisterSchedule(workflowId);
    return;
  }
  const cronExpr = cfg.trigger.config?.cron;
  const timezone = cfg.trigger.config?.timezone;
  if (typeof cronExpr !== "string" || !cron.validate(cronExpr)) {
    unregisterSchedule(workflowId);
    return;
  }
  registerSchedule(workflowId, cronExpr, timezone);
}
