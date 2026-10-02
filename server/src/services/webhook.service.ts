import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { webhooks, workflows } from "../db/schema";
import { config } from "../config";

function now(): string {
  return new Date().toISOString();
}

function randomPath(): string {
  return `/wh/${randomBytes(18).toString("base64url")}`;
}

export async function ensureWebhookForWorkflow(workflowId: string): Promise<typeof webhooks.$inferSelect> {
  const db = getDb();
  const existing = await db.select().from(webhooks).where(eq(webhooks.workflowId, workflowId)).limit(1);
  if (existing.length > 0) return existing[0];
  const row = {
    id: randomUUID(),
    workflowId,
    path: randomPath(),
    method: "POST",
    isActive: 1,
    createdAt: now(),
  };
  await db.insert(webhooks).values(row);
  const after = await db.select().from(webhooks).where(eq(webhooks.workflowId, workflowId)).limit(1);
  return after[0];
}

export async function getWebhookByPath(path: string) {
  const db = getDb();
  const fullPath = path.startsWith("/wh/") ? path : `/wh/${path}`;
  const rows = await db.select().from(webhooks).where(eq(webhooks.path, fullPath)).limit(1);
  const wh = rows[0];
  if (!wh || wh.isActive !== 1) return null;
  const wf = await db.select().from(workflows).where(eq(workflows.id, wh.workflowId)).limit(1);
  if (wf.length === 0 || wf[0].isActive !== 1) return null;
  return { webhook: wh, workflow: wf[0] };
}

export function webhookUrl(path: string): string {
  return `${config.baseUrl.replace(/\/$/, "")}${path}`;
}

export async function getWorkflowWebhook(workflowId: string) {
  const db = getDb();
  const rows = await db.select().from(webhooks).where(eq(webhooks.workflowId, workflowId)).limit(1);
  const wh = rows[0];
  if (!wh) return null;
  return { ...wh, url: webhookUrl(wh.path) };
}

export async function regenerateWorkflowWebhook(workflowId: string) {
  const db = getDb();
  const rows = await db.select().from(webhooks).where(eq(webhooks.workflowId, workflowId)).limit(1);
  const newPath = randomPath();
  if (rows.length === 0) {
    const row = {
      id: randomUUID(),
      workflowId,
      path: newPath,
      method: "POST",
      isActive: 1,
      createdAt: now(),
    };
    await db.insert(webhooks).values(row);
    return { ...row, url: webhookUrl(newPath) };
  }
  await db.update(webhooks).set({ path: newPath }).where(eq(webhooks.workflowId, workflowId));
  const after = await db.select().from(webhooks).where(eq(webhooks.workflowId, workflowId)).limit(1);
  return { ...after[0], url: webhookUrl(after[0].path) };
}

export async function setWebhookActive(workflowId: string, active: boolean) {
  const db = getDb();
  await db.update(webhooks).set({ isActive: active ? 1 : 0 }).where(eq(webhooks.workflowId, workflowId));
}

export async function deleteWorkflowWebhook(workflowId: string) {
  const db = getDb();
  await db.delete(webhooks).where(eq(webhooks.workflowId, workflowId));
}
