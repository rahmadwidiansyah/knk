import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import * as wf from "../services/workflow.service";
import { getWorkflowWebhook, regenerateWorkflowWebhook } from "../services/webhook.service";
import { isScheduled } from "../services/scheduler.service";
import { executeWorkflow, fillExecutionContext, getExecutionWithSteps, runNodeHandler } from "../engine/executor";
import { ExecutionContext } from "../engine/context";
import { resolveConfig } from "../engine/interpolator";
import { withRetry } from "../engine/retry";
import { createWorkflowSchema, updateWorkflowSchema } from "../validation/workflow.schema";
import { userLimiter } from "../middleware/rate-limit";
import { TEST_TIMEOUT_MS } from "../types/workflow.types";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const all = req.query.all === "1";
    res.json({ workflows: await wf.listWorkflows(req.user!, all) });
  } catch (e) {
    next(e);
  }
});

router.post("/", validateBody(createWorkflowSchema), async (req, res, next) => {
  try {
    const out = await wf.createWorkflow(req.user!, req.body);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    res.json({ workflow: await wf.getWorkflow(req.user!, req.params.id) });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", validateBody(updateWorkflowSchema), async (req, res, next) => {
  try {
    res.json({ workflow: await wf.updateWorkflow(req.user!, req.params.id, req.body) });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    res.json(await wf.deleteWorkflow(req.user!, req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/:id/toggle",
  validateBody(z.object({ is_active: z.number().int().min(0).max(1) })),
  async (req, res, next) => {
    try {
      res.json({ workflow: await wf.toggleWorkflow(req.user!, req.params.id, req.body.is_active === 1) });
    } catch (e) {
      next(e);
    }
  }
);

router.get("/:id/webhook", async (req, res, next) => {
  try {
    await wf.getWorkflow(req.user!, req.params.id);
    const wh = await getWorkflowWebhook(req.params.id);
    res.json({ webhook: wh, scheduled: isScheduled(req.params.id) });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/webhook/regenerate", async (req, res, next) => {
  try {
    await wf.getWorkflow(req.user!, req.params.id);
    res.json({ webhook: await regenerateWorkflowWebhook(req.params.id) });
  } catch (e) {
    next(e);
  }
});

function simulatedTriggerData(type: string, input: any, config: any): any {
  const base = input && typeof input === "object" ? input : {};
  const stamp = new Date().toISOString();
  switch (type) {
    case "webhook":
      return { headers: {}, query: {}, body: base, path: "(simulasi)", received_at: stamp, simulated: true };
    case "schedule":
      return { scheduled_at: stamp, cron: config?.trigger?.config?.cron, simulated: true, ...base };
    case "telegram_event":
      return {
        platform: "telegram",
        connector_id: "(simulasi)",
        chat_id: "123456",
        from: { id: 1, username: "tester", name: "Tester" },
        text: "halo",
        received_at: stamp,
        simulated: true,
        ...base,
      };
    case "waha_event":
      return {
        platform: "waha",
        connector_id: "(simulasi)",
        session: "default",
        chat_id: "62812@c.us",
        from: "62812@c.us",
        text: "halo",
        is_group: false,
        received_at: stamp,
        simulated: true,
        ...base,
      };
    default:
      return base;
  }
}

router.post(
  "/:id/test",
  userLimiter(20, "Terlalu banyak test, coba lagi sebentar."),
  validateBody(z.object({ input: z.any().optional() }).passthrough().default({})),
  async (req, res, next) => {
    try {
      const { config } = await wf.mustOwnForExecution(req.user!, req.params.id);
      const triggerType = config.trigger?.type || "manual";
      const triggerData = simulatedTriggerData(triggerType, req.body?.input ?? {}, config);
      const { executionId } = await Promise.race([
        executeWorkflow(req.params.id, config, triggerType, triggerData),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(Object.assign(new Error("Test timeout 35 detik"), { status: 504 })), TEST_TIMEOUT_MS)
        ),
      ]);
      const detail = await getExecutionWithSteps(executionId);
      res.json(detail);
    } catch (e) {
      next(e);
    }
  }
);

// Uji SATU node dengan trigger simulasi — untuk send_*/http ini EKSEKUSI ASLI.
router.post(
  "/:id/nodes/:nodeId/test",
  userLimiter(20, "Terlalu banyak test, coba lagi sebentar."),
  validateBody(z.object({ input: z.any().optional() }).passthrough().default({})),
  async (req, res, next) => {
    try {
      const { config } = await wf.mustOwnForExecution(req.user!, req.params.id);
      const node = (config.nodes || []).find((n: any) => n.id === req.params.nodeId);
      if (!node) {
        throw Object.assign(new Error(`Node '${req.params.nodeId}' tidak ditemukan`), { status: 404 });
      }
      const triggerType = config.trigger?.type || "manual";
      const triggerData = simulatedTriggerData(triggerType, req.body?.input ?? {}, config);
      const ctx = new ExecutionContext();
      ctx.set("trigger", triggerData ?? {});
      await fillExecutionContext(ctx, req.params.id);
      const started = Date.now();
      const resolved = resolveConfig(node.config || {}, ctx);
      const { result } = await withRetry(
        () => runNodeHandler(node, resolved, ctx),
        node.retry?.max ?? 0,
        node.retry?.delay_ms ?? 1000
      );
      res.json({ node_id: node.id, output: result, duration_ms: Date.now() - started });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
