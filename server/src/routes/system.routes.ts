import { Router } from "express";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb, getSqlite } from "../db/connection";
import { users, workflows, executions } from "../db/schema";
import { config } from "../config";

const router = Router();

const startedAt = Date.now();

router.get("/health", (_req, res) => {
  let db: "ok" | "error" = "ok";
  try {
    getSqlite().prepare("SELECT 1").get();
  } catch {
    db = "error";
  }
  res.status(db === "ok" ? 200 : 503).json({
    status: db === "ok" ? "ok" : "degraded",
    service: "lightflow",
    version: process.env.npm_package_version || "0.1.0",
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    db,
    time: new Date().toISOString(),
  });
});

router.get("/stats", async (_req, res, next) => {
  try {
    const db = getDb();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [[u], [w], [wa], [e], [et], [es]] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(workflows),
      db.select({ value: count() }).from(workflows).where(eq(workflows.isActive, 1)),
      db.select({ value: count() }).from(executions),
      db.select({ value: count() }).from(executions).where(gte(executions.startedAt, dayAgo)),
      db
        .select({ value: count() })
        .from(executions)
        .where(and(gte(executions.startedAt, dayAgo), eq(executions.status, "success"))),
    ]);
    res.json({
      users: u.value,
      workflows: w.value,
      workflows_active: wa.value,
      executions: e.value,
      executions_24h: et.value,
      success_rate_24h: et.value > 0 ? Math.round((es.value / et.value) * 100) : null,
      retention_days: config.retentionDays,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
