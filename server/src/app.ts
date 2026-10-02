import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import authRoutes from "./routes/auth.routes";
import systemRoutes from "./routes/system.routes";
import workflowRoutes from "./routes/workflow.routes";
import executionRoutes from "./routes/execution.routes";
import webhookRoutes from "./routes/webhook.routes";
import secretRoutes from "./routes/secret.routes";
import connectorRoutes from "./routes/connector.routes";
import telegramWebhook from "./integrations/telegram/webhook";
import wahaWebhook from "./integrations/waha/webhook";
import adminRoutes from "./routes/admin.routes";
import userRoutes from "./routes/user.routes";
import { errorHandler, notFound } from "./middleware/error-handler";
import { authLimiter, webhookLimiter } from "./middleware/rate-limit";
import { config } from "./config";

export function createApp() {
  const app = express();

  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    config.corsOrigins.length > 0
      ? cors({ origin: config.corsOrigins })
      : cors()
  );
  app.use(express.json({ limit: "1mb" }));

  // Aplikasi privat: jangan di-index crawler. Auth tetap penegak utama.
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  });
  app.get("/.well-known/security.txt", (_req, res) => {
    if (!config.securityContact) {
      return res.status(404).json({ error: "Endpoint tidak ditemukan" });
    }
    res.type("text/plain").send(
      `Contact: ${config.securityContact}\nExpires: ${new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()}\nPreferred-Languages: id, en\n`
    );
  });

  const sensitiveLimit = authLimiter();
  app.use("/api/auth", sensitiveLimit, authRoutes);
  app.use("/api/users", sensitiveLimit, userRoutes);
  app.use("/api/workflows", workflowRoutes);
  app.use("/api/executions", executionRoutes);
  app.use("/api/secrets", secretRoutes);
  app.use("/api/connectors", connectorRoutes);
  app.use("/api/admin", adminRoutes);
  const whLimit = webhookLimiter();
  app.use("/wh", whLimit, webhookRoutes); // public webhook receiver (sebelum static!)
  app.use("/wh/telegram", whLimit, telegramWebhook);
  app.use("/wh/waha", whLimit, wahaWebhook);
  app.use("/", systemRoutes); // /health
  app.use("/api", systemRoutes); // /api/stats + /api/health alias

  // Serve frontend build (Docker: /app/public, dev: ../web/dist)
  const candidates = [
    path.join(process.cwd(), "public"),
    path.join(__dirname, "../../public"),
    path.resolve(__dirname, "../../public"),
  ];
  const publicDir = candidates.find((d) => fs.existsSync(d) && fs.existsSync(path.join(d, "index.html")));

  if (publicDir) {
    app.use(express.static(publicDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/wh/")) return next();
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
