import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { config } from "../config";

function getKey(): Buffer {
  const raw = config.encryptionKey;
  if (!raw && config.nodeEnv === "production") {
    throw new Error("ENCRYPTION_KEY wajib diisi di production (min 16 karakter)");
  }
  const src = raw || "dev-only-32chars-long-key-123456";
  // Derivasi 256-bit stabil dari string apapun (salt statis: cocok untuk homelab single-node)
  return scryptSync(src, "lightflow-v1", 32);
}

// Format: v1.<iv hex>.<cipher hex>.<tag hex>
export function encrypt(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("hex")}.${enc.toString("hex")}.${tag.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw Object.assign(new Error("Format data terenkripsi tidak dikenal (ENCRYPTION_KEY berubah?)"), {
      status: 500,
    });
  }
  const [, ivHex, encHex, tagHex] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const out = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
    return out.toString("utf8");
  } catch {
    throw Object.assign(
      new Error("Gagal mendekripsi (ENCRYPTION_KEY salah/berubah?)"),
      { status: 500 }
    );
  }
}
