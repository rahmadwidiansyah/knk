import { count, inArray, lt } from "drizzle-orm";
import { getDb } from "../db/connection";
import { executions, executionSteps } from "../db/schema";
import { config } from "../config";

export interface CleanupResult {
  enabled: boolean;
  retentionDays: number;
  executionsDeleted: number;
  stepsDeleted: number;
  cutoff?: string;
}

/**
 * Hapus executions (+ steps) yang finished_at-nya lebih tua dari retensi.
 * Yang masih 'running' tidak pernah dihapus (ditandai yatim saat boot).
 */
export async function cleanupOldExecutions(retentionDays = config.retentionDays): Promise<CleanupResult> {
  const days = Math.floor(retentionDays);
  if (!(days > 0)) {
    return { enabled: false, retentionDays: days, executionsDeleted: 0, stepsDeleted: 0 };
  }
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const old = await db
    .select({ id: executions.id })
    .from(executions)
    .where(lt(executions.finishedAt, cutoff));

  // Hanya yang sudah selesai (finished_at terisi).
  const ids = old.map((r) => r.id);
  if (ids.length === 0) {
    return { enabled: true, retentionDays: days, executionsDeleted: 0, stepsDeleted: 0, cutoff };
  }

  // Hapus bertahap agar tidak mengunci DB terlalu lama.
  const CHUNK = 200;
  let stepsDeleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const cRows = (await db
      .select({ value: count() })
      .from(executionSteps)
      .where(inArray(executionSteps.executionId, chunk))) as unknown as Array<{ value: number }>;
    stepsDeleted += cRows[0]?.value ?? 0;
    await db.delete(executionSteps).where(inArray(executionSteps.executionId, chunk));
    await db.delete(executions).where(inArray(executions.id, chunk));
  }

  console.log(`[cleanup] ${ids.length} executions + ${stepsDeleted} steps lebih tua dari ${days} hari dihapus`);
  return { enabled: true, retentionDays: days, executionsDeleted: ids.length, stepsDeleted, cutoff };
}
