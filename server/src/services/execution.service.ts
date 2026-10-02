import { and, count, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { getDb } from "../db/connection";
import { executions, executionSteps, workflows } from "../db/schema";
import type { AuthUser } from "../types/api.types";

export interface ListOpts {
  workflowId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function listExecutions(actor: AuthUser, opts: ListOpts) {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const conds: SQL[] = [];
  if (actor.role !== "admin") conds.push(eq(workflows.userId, actor.id));
  if (opts.workflowId) conds.push(eq(executions.workflowId, opts.workflowId));
  if (opts.status) conds.push(eq(executions.status, opts.status));
  if (opts.from) conds.push(gte(executions.startedAt, opts.from));
  if (opts.to) conds.push(lte(executions.startedAt, opts.to));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: executions.id,
      workflowId: executions.workflowId,
      workflowName: workflows.name,
      status: executions.status,
      triggerType: executions.triggerType,
      errorMessage: executions.errorMessage,
      startedAt: executions.startedAt,
      finishedAt: executions.finishedAt,
      inputData: executions.inputData,
    })
    .from(executions)
    .innerJoin(workflows, eq(executions.workflowId, workflows.id))
    .where(where)
    .orderBy(desc(executions.startedAt))
    .limit(limit)
    .offset(offset);

  const withFlag = rows.map(({ inputData, ...r }) => ({
    ...r,
    simulated: isSimulated(inputData),
  }));

  const totalRows = await db
    .select({ value: count() })
    .from(executions)
    .innerJoin(workflows, eq(executions.workflowId, workflows.id))
    .where(where);
  const total = totalRows[0]?.value ?? 0;

  return { executions: withFlag, total, limit, offset };
}

/** Test manual menandai input dengan simulated:true — tampilkan sebagai "Tes" di UI. */
function isSimulated(inputData: string | null): boolean {
  if (!inputData) return false;
  try {
    return (JSON.parse(inputData) as any)?.simulated === true;
  } catch {
    return false;
  }
}

export async function getExecutionDetail(actor: AuthUser, id: string) {
  const db = getDb();
  const ex = await db.select().from(executions).where(eq(executions.id, id)).limit(1);
  if (ex.length === 0) throw Object.assign(new Error("Execution tidak ditemukan"), { status: 404 });
  const wf = await db.select().from(workflows).where(eq(workflows.id, ex[0].workflowId)).limit(1);
  const ownerId = wf[0]?.userId;
  if (actor.role !== "admin" && ownerId !== actor.id) {
    throw Object.assign(new Error("Tidak punya akses ke execution ini"), { status: 403 });
  }
  const steps = await db.select().from(executionSteps).where(eq(executionSteps.executionId, id));
  return { execution: ex[0], steps };
}
