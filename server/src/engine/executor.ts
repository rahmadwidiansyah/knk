import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { connectors, executions, executionSteps, workflows } from "../db/schema";
import { ExecutionContext } from "./context";
import { resolveConfig } from "./interpolator";
import { withRetry } from "./retry";
import { httpRequestHandler } from "./handlers/http-request.handler";
import { conditionHandler } from "./handlers/condition.handler";
import { transformHandler } from "./handlers/transform.handler";
import { delayHandler } from "./handlers/delay.handler";
import { logHandler, futureNodeHandler } from "./handlers/log.handler";
import { sendTelegramHandler } from "./handlers/send-telegram.handler";
import { sendWahaHandler } from "./handlers/send-waha.handler";
import { sendWahaMediaHandler } from "./handlers/send-waha-media.handler";
import { getDecryptedSecrets } from "../services/secret.service";
import type { BaseNode, WorkflowConfig } from "../types/workflow.types";
import { END_NODE } from "../types/workflow.types";

function now(): string {
  return new Date().toISOString();
}

function safeJson(v: unknown, max = 20000): string | null {
  if (v === undefined || v === null) return null;
  try {
    const s = JSON.stringify(v);
    return s.length > max ? s.slice(0, max) : s;
  } catch {
    return String(v).slice(0, max);
  }
}

/**
 * Isi konteks eksekusi: trigger sudah di-set pemanggil; fungsi ini menambah
 * execution info, secrets + peta connector milik owner. Dipakai executor
 * maupun uji-satu-node (tanpa menulis execution ke DB).
 */
export async function fillExecutionContext(
  ctx: ExecutionContext,
  workflowId: string,
  executionId = `test-${randomUUID()}`
): Promise<void> {
  const db = getDb();
  ctx.set("execution", { id: executionId });
  try {
    const wfRows = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
    const ownerId = wfRows[0]?.userId;
    if (ownerId) {
      ctx.set("__ownerId", ownerId);
      ctx.set("secrets", await getDecryptedSecrets(ownerId));
      const conns = await db.select().from(connectors).where(eq(connectors.userId, ownerId));
      const cmap: Record<string, string> = {};
      for (const c of conns) cmap[c.name] = c.id;
      ctx.set("connector", cmap);
    }
  } catch (e) {
    console.error("[executor] gagal load konteks:", (e as any)?.message);
    throw e;
  }
}

export async function executeWorkflow(
  workflowId: string,
  config: WorkflowConfig,
  triggerType: string,
  triggerData: any
): Promise<{ executionId: string }> {
  const db = getDb();
  const executionId = randomUUID();
  const startedAt = now();

  await db.insert(executions).values({
    id: executionId,
    workflowId,
    status: "running",
    triggerType,
    inputData: safeJson(triggerData),
    outputData: null,
    errorMessage: null,
    startedAt,
    finishedAt: null,
  });

  const ctx = new ExecutionContext();
  ctx.set("trigger", triggerData ?? {});
  ctx.set("execution", { id: executionId });

  // Owner workflow → secrets + peta nama connector. Gagal decrypt = execution failed eksplisit.
  try {
    await fillExecutionContext(ctx, workflowId);
  } catch (e: any) {
    await db
      .update(executions)
      .set({ status: "failed", errorMessage: String(e?.message || e).slice(0, 2000), finishedAt: now() })
      .where(eq(executions.id, executionId));
    return { executionId };
  }

  const byId = new Map<string, BaseNode>(config.nodes.map((n) => [n.id, n]));
  // Antrean kerja: mendukung fan-out (next_all). Tiap node jalan MAKS 1x
  // per execution agar cabang yang bergabung tak dieksekusi ganda.
  const queue: string[] = config.nodes[0] ? [config.nodes[0].id] : [];
  const visited = new Set<string>();
  let guard = 0;

  const logStep = async (p: {
    node: BaseNode;
    status: string;
    input: unknown;
    output: unknown;
    error?: string;
    retryCount?: number;
    startedAt?: string;
    finishedAt?: string;
  }) => {
    await db.insert(executionSteps).values({
      id: randomUUID(),
      executionId,
      nodeId: p.node.id,
      nodeName: p.node.name,
      nodeType: p.node.type,
      status: p.status,
      inputData: safeJson(p.input),
      outputData: safeJson(p.output),
      errorMessage: p.error ?? null,
      retryCount: p.retryCount ?? 0,
      startedAt: p.startedAt ?? null,
      finishedAt: p.finishedAt ?? null,
    });
  };

  const fail = async (msg: string) => {
    await db
      .update(executions)
      .set({ status: "failed", errorMessage: msg.slice(0, 2000), finishedAt: now() })
      .where(eq(executions.id, executionId));
  };

  const succeed = async () => {
    const all = ctx.getAll();
    const visible: Record<string, any> = {};
    for (const [k, v] of Object.entries(all)) {
      // __internal + peta secrets terdekripsi JANGAN disimpan ke log (plaintext di DB).
      if (k.startsWith("__") || k === "secrets") continue;
      visible[k] = v;
    }
    await db
      .update(executions)
      .set({ status: "success", outputData: safeJson(visible), finishedAt: now() })
      .where(eq(executions.id, executionId));
  };

  const enqueue = (t?: string) => {
    if (t && t !== END_NODE) queue.push(t);
  };

  while (queue.length > 0 && guard < 100) {
    guard++;
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const node = byId.get(current);
    if (!node) {
      await fail(`Node tak dikenal: ${current}`);
      break;
    }

    // Node nonaktif: lewati eksekusi, lanjut ke koneksi keluarnya.
    if (node.disabled) {
      await logStep({
        node,
        status: "skipped",
        input: node.config,
        output: { skipped: true },
        startedAt: now(),
        finishedAt: now(),
      });
      if (node.type === "condition") {
        enqueue(node.next_true);
        enqueue(node.next_false);
      } else if (node.next_all && node.next_all.length > 0) {
        for (const t of node.next_all) enqueue(t);
      } else {
        enqueue(node.next);
      }
      continue;
    }

    const stepStarted = now();
    try {
      const resolved = resolveConfig(node.config || {}, ctx);

      const { result, attempts } = await withRetry(
        () => runNodeHandler(node, resolved, ctx),
        node.retry?.max ?? 0,
        node.retry?.delay_ms ?? 1000
      );

      ctx.set(node.id, result);
      await logStep({
        node,
        status: "success",
        input: resolved,
        output: result,
        retryCount: attempts,
        startedAt: stepStarted,
        finishedAt: now(),
      });

      if (node.type === "condition") {
        enqueue((result as any).conditionMet ? node.next_true : node.next_false);
      } else if (node.next_all && node.next_all.length > 0) {
        for (const t of node.next_all) enqueue(t);
      } else {
        enqueue(node.next);
      }
    } catch (e: any) {
      const msg = e?.message || "Node gagal";
      await logStep({
        node,
        status: "failed",
        input: node.config,
        output: null,
        error: e?.responseBody ? `${msg} :: ${safeJson(e.responseBody, 1000)}` : msg,
        startedAt: stepStarted,
        finishedAt: now(),
      });
      if (node.on_error) {
        ctx.set("error", { message: msg, node: node.id });
        enqueue(node.on_error);
      } else {
        await fail(`[${node.id}] ${msg}`);
        return { executionId };
      }
    }
  }

  if (guard >= 100) {
    await fail("Guard: kemungkinan loop >100 langkah, dihentikan");
    return { executionId };
  }

  await succeed();
  return { executionId };
}

/** Jalankan SATU node handler (dipakai executor + uji-satu-node). */
export async function runNodeHandler(
  node: BaseNode,
  resolvedConfig: Record<string, any>,
  ctx: ExecutionContext
): Promise<Record<string, any>> {
  if (node.disabled) return { skipped: true };
  switch (node.type) {
    case "http_request": return httpRequestHandler(resolvedConfig, ctx);
    case "condition": return conditionHandler(resolvedConfig, ctx);
    case "transform": return transformHandler(resolvedConfig, ctx);
    case "delay": return delayHandler(resolvedConfig, ctx);
    case "log": return logHandler(resolvedConfig, ctx);
    case "send_telegram": return sendTelegramHandler(resolvedConfig, ctx);
    case "send_waha": return sendWahaHandler(resolvedConfig, ctx);
    case "send_waha_media": return sendWahaMediaHandler(resolvedConfig, ctx);
    case "ai_chat":
      return futureNodeHandler(node.type);
    default:
      throw Object.assign(new Error(`Tipe node tak dikenal: ${(node as any).type}`), { status: 400 });
  }
}

export async function getExecutionWithSteps(executionId: string) {
  const db = getDb();
  const ex = await db.select().from(executions).where(eq(executions.id, executionId)).limit(1);
  if (ex.length === 0) throw Object.assign(new Error("Execution tidak ditemukan"), { status: 404 });
  const steps = await db.select().from(executionSteps).where(eq(executionSteps.executionId, executionId));
  return { execution: ex[0], steps };
}
