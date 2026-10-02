import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

const isProd = config.nodeEnv === "production";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Body bukan JSON valid (mis. webhook ngirim teks mentah).
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Body harus JSON yang valid" });
  }
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) {
    console.error("[error]", err);
  }
  const body: Record<string, any> = {
    // Jangan bocorkan detail internal (stack, query SQL) di production.
    error: status >= 500 && isProd ? "Terjadi kesalahan internal" : err?.message || "Internal server error",
  };
  if (err?.details) body.details = err.details;
  if (status >= 500 && !isProd) body.stack = err?.stack?.split("\n").slice(0, 5).join("\n");
  res.status(status).json(body);
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Endpoint tidak ditemukan" });
}
