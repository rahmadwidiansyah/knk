import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { workflows } from "../db/schema";
import { workflowConfigSchema } from "../validation/workflow.schema";
import type { AuthUser } from "../types/api.types";
import type { WorkflowConfig } from "../types/workflow.types";
import {
  deleteWorkflowWebhook,
  ensureWebhookForWorkflow,
  setWebhookActive,
} from "./webhook.service";
import { syncWorkflowSchedule, unregisterSchedule } from "./scheduler.service";

function now(): string {
  return new Date().toISOString();
}

export function parseAndValidate(raw: unknown): WorkflowConfig {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const result = workflowConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw Object.assign(new Error("Workflow JSON tidak valid"), {
      status: 400,
      details: result.error.flatten(),
    });
  }
  return result.data as WorkflowConfig;
}

function rowToResponse(row: typeof workflows.$inferSelect) {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description,
    json_config: JSON.parse(row.jsonConfig),
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listWorkflows(actor: AuthUser, all = false) {
  const db = getDb();
  if (actor.role === "admin" && all) {
    return (await db.select().from(workflows).orderBy(desc(workflows.updatedAt))).map(rowToResponse);
  }
  return (
    await db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, actor.id))
      .orderBy(desc(workflows.updatedAt))
  ).map(rowToResponse);
}

export async function getWorkflow(actor: AuthUser, id: string) {
  const db = getDb();
  const rows = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw Object.assign(new Error("Workflow tidak ditemukan"), { status: 404 });
  if (actor.role !== "admin" && row.userId !== actor.id) {
    throw Object.assign(new Error("Tidak punya akses ke workflow ini"), { status: 403 });
  }
  return rowToResponse(row);
}

async function getOwnedRow(actor: AuthUser, id: string) {
  const db = getDb();
  const rows = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw Object.assign(new Error("Workflow tidak ditemukan"), { status: 404 });
  if (actor.role !== "admin" && row.userId !== actor.id) {
    throw Object.assign(new Error("Tidak punya akses ke workflow ini"), { status: 403 });
  }
  return row;
}

export async function createWorkflow(
  actor: AuthUser,
  input: { name: string; description?: string; json_config: unknown }
) {
  const cfg = parseAndValidate(input.json_config);
  const db = getDb();
  const ts = now();
  const row = {
    id: randomUUID(),
    userId: actor.id,
    name: input.name,
    description: input.description ?? cfg.description ?? "",
    jsonConfig: JSON.stringify({ ...cfg, name: input.name, description: input.description ?? cfg.description ?? "" }),
    isActive: 0,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(workflows).values(row);
  if (cfg.trigger?.type === "webhook") {
    await ensureWebhookForWorkflow(row.id);
    await setWebhookActive(row.id, false);
  }
  return { id: row.id, name: row.name };
}

export async function updateWorkflow(
  actor: AuthUser,
  id: string,
  input: { name?: string; description?: string; json_config?: unknown; is_active?: number }
) {
  const row = await getOwnedRow(actor, id);
  const patch: Partial<typeof workflows.$inferInsert> = { updatedAt: now() };
  const currentCfg = JSON.parse(row.jsonConfig);

  if (input.name !== undefined) {
    if (!input.name.trim()) throw Object.assign(new Error("name tidak boleh kosong"), { status: 400 });
    patch.name = input.name;
    currentCfg.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
    currentCfg.description = input.description;
  }
  if (input.json_config !== undefined) {
    const cfg = parseAndValidate(input.json_config);
    currentCfg.trigger = cfg.trigger;
    currentCfg.nodes = cfg.nodes;
    if (cfg.name) {
      patch.name = patch.name ?? cfg.name;
      currentCfg.name = patch.name;
    }
  }
  if (input.is_active !== undefined) {
    patch.isActive = input.is_active ? 1 : 0;
  }
  if (patch.name || input.json_config !== undefined || input.description !== undefined) {
    patch.jsonConfig = JSON.stringify(currentCfg);
  }

  const db = getDb();
  await db.update(workflows).set(patch).where(eq(workflows.id, id));
  await afterWorkflowChanged(id);
  return getWorkflow(actor, id);
}

async function afterWorkflowChanged(workflowId: string): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
  const row = rows[0];
  if (!row) return;
  let cfg: any;
  try {
    cfg = JSON.parse(row.jsonConfig);
  } catch {
    return;
  }
  if (cfg?.trigger?.type === "webhook") {
    await ensureWebhookForWorkflow(workflowId);
    await setWebhookActive(workflowId, row.isActive === 1);
  } else {
    await deleteWorkflowWebhook(workflowId);
  }
  await syncWorkflowSchedule(workflowId);
}

export async function deleteWorkflow(actor: AuthUser, id: string) {
  await getOwnedRow(actor, id);
  unregisterSchedule(id);
  await deleteWorkflowWebhook(id);
  const db = getDb();
  // Hapus executions + steps milik workflow agar tidak yatim (SQLite tanpa FK cascade)
  const { executions, executionSteps } = await import("../db/schema");
  const exRows = await db.select({ id: executions.id }).from(executions).where(eq(executions.workflowId, id));
  for (const ex of exRows) {
    await db.delete(executionSteps).where(eq(executionSteps.executionId, ex.id));
  }
  await db.delete(executions).where(eq(executions.workflowId, id));
  await db.delete(workflows).where(eq(workflows.id, id));
  return { ok: true };
}

export async function toggleWorkflow(actor: AuthUser, id: string, isActive: boolean) {
  const row = await getOwnedRow(actor, id);
  if (isActive) {
    const { validateForActivation } = await import("./activation.service");
    const issues = await validateForActivation(row.userId, JSON.parse(row.jsonConfig));
    if (issues.length > 0) {
      throw Object.assign(new Error("Workflow belum siap diaktifkan"), {
        status: 400,
        details: { issues },
      });
    }
  }
  const db = getDb();
  await db.update(workflows).set({ isActive: isActive ? 1 : 0, updatedAt: now() }).where(eq(workflows.id, id));
  await afterWorkflowChanged(id);
  return getWorkflow(actor, id);
}

export async function mustOwnForExecution(actor: AuthUser, id: string) {
  const row = await getOwnedRow(actor, id);
  return { row, config: JSON.parse(row.jsonConfig) as WorkflowConfig };
}
