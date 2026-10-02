import { rateLimit } from "express-rate-limit";
import { config } from "../config";

/**
 * Rate limit untuk endpoint webhook publik (/wh/*).
 * Single-container: memory store cukup. Di balik reverse proxy,
 * set TRUST_PROXY=1 agar IP klien terbaca dari X-Forwarded-For.
 */
export function webhookLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: Math.max(config.webhookRateLimit, 1),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Terlalu banyak request, coba lagi sebentar.",
    },
  });
}

/**
 * Rate limit ketat untuk endpoint sensitif (login + ganti password).
 * Melindungi dari brute-force credential.
 */
export function authLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: Math.max(config.authRateLimit, 1),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Terlalu banyak percobaan login, coba lagi sebentar.",
    },
  });
}

/**
 * Rate limit per-user untuk operasi yang memicu pengiriman eksternal
 * (test workflow / test connector) — mencegah spam WA/Telegram.
 * User di balik NAT berbagi IP, jadi kunci = user id bila login.
 */
export function userLimiter(perMinute: number, message: string) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: Math.max(perMinute, 1),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => (req as any).user?.id || req.ip || "unknown",
    message: { error: message },
  });
}
