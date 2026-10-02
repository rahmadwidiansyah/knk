import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  dbPath: process.env.DB_PATH || "./data/lightflow.db",
  jwtSecret: requireEnv("JWT_SECRET", "dev-only-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  baseUrl: process.env.BASE_URL || "http://localhost:4000",
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || "admin",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "admin123",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  // Retensi log eksekusi (hari). 0 = tidak pernah hapus otomatis.
  retentionDays: Number(process.env.EXECUTION_RETENTION_DAYS || 30),
  // Rate limit webhook publik: maks request per IP per menit.
  webhookRateLimit: Number(process.env.WEBHOOK_RATE_LIMIT || 60),
  // Rate limit endpoint auth sensitif: maks request per IP per menit.
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT || 20),
  // Set 1 jika di balik reverse proxy (agar rate limit baca IP asli).
  trustProxy: process.env.TRUST_PROXY === "1",
  // Batasi origin CORS (koma). Kosong = perilaku lama (*) — isi bila akses browser hanya dari domain tertentu.
  corsOrigins: (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Kontak untuk laporan kerentanan (/.well-known/security.txt). Kosong = tidak disajikan.
  securityContact: process.env.SECURITY_CONTACT || "",
};

if (config.nodeEnv === "production" && config.jwtSecret === "dev-only-change-me") {
  console.warn("[warn] JWT_SECRET masih default! Set JWT_SECRET di production.");
}
