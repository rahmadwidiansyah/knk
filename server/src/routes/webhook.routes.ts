import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { getWebhookByPath } from "../services/webhook.service";
import { executeWorkflow } from "../engine/executor";

const router = Router();

function checkSecret(cfg: any, req: { headers: any; query: any }): boolean {
  const secret = cfg?.trigger?.config?.secret;
  if (!secret) return true;
  const got = String(req.headers["x-webhook-secret"] || req.query?.secret || "");
  const a = Buffer.from(got);
  const b = Buffer.from(String(secret));
  // timingSafeEqual butuh panjang sama; bandingkan aman tanpa bocor info.
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

// Public webhook receiver — tanpa auth; keamanan = path acak + secret opsional.
// Async: langsung 202, eksekusi jalan background (bisa dipoll via /api/executions).
async function handleWebhook(req: any, res: any, next: any) {
  try {
    const found = await getWebhookByPath(req.params.path);
    if (!found) {
      return res.status(404).json({ error: "Webhook tidak ditemukan atau nonaktif" });
    }
    const cfg = JSON.parse(found.workflow.jsonConfig);
    const methods: string[] | undefined = cfg?.trigger?.config?.methods;
    if (methods && !methods.includes(req.method)) {
      return res.status(405).json({ error: `Method ${req.method} tidak diizinkan untuk webhook ini` });
    }
    if (!checkSecret(cfg, req)) {
      return res.status(401).json({ error: "Webhook secret salah" });
    }
    const triggerData = {
      method: req.method,
      headers: sanitizeHeaders(req.headers),
      query: req.query ?? {},
      body: req.body ?? {},
      path: found.webhook.path,
      received_at: new Date().toISOString(),
    };
    // Fire-and-forget: jangan await agar response <500ms
    executeWorkflow(found.workflow.id, cfg, "webhook", triggerData).catch((e) => {
      console.error(`[webhook:${found.webhook.path}] async failed:`, e?.message || e);
    });
    // Ambil execution terbaru? Tidak — kembalikan accepted + path info.
    // Client poll via /api/executions?workflow_id=
    res.status(202).json({ status: "accepted", workflow_id: found.workflow.id });
  } catch (e) {
    next(e);
  }
}

router.get("/:path", handleWebhook);
router.post("/:path", handleWebhook);
router.put("/:path", handleWebhook);
router.patch("/:path", handleWebhook);
router.delete("/:path", handleWebhook);

function sanitizeHeaders(h: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (/^authorization$/i.test(k)) {
      out[k] = "[redacted]";
    } else if (typeof v === "string" && v.length < 2000) {
      out[k] = v;
    }
  }
  return out;
}

export default router;
