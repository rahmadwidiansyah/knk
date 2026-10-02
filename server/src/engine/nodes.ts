import type { NodeType } from "../types/workflow.types";

export interface NodeOutput {
  name: string;
  label: string;
}

export interface NodeMeta {
  type: NodeType | string;
  label: string;
  category: "trigger" | "action" | "logic" | "utility";
  description: string;
  /** Output/cabang yang dihasilkan node ini. */
  outputs: NodeOutput[];
  /** Field config yang wajib ada agar node bisa jalan. */
  requiredConfig: string[];
}

/**
 * Registry terpusat node LightFlow (sisi backend).
 * Executor memakai peta handler; UI punya cerminan di web/src/lib/nodeRegistry.ts.
 */
export const NODE_REGISTRY: Record<string, NodeMeta> = {
  webhook: {
    type: "webhook", label: "Webhook", category: "trigger",
    description: "Menerima HTTP request publik",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: [],
  },
  schedule: {
    type: "schedule", label: "Jadwal", category: "trigger",
    description: "Berjalan sesuai cron",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["cron"],
  },
  manual: {
    type: "manual", label: "Manual", category: "trigger",
    description: "Jalan via tombol Test",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: [],
  },
  telegram_event: {
    type: "telegram_event", label: "Telegram", category: "trigger",
    description: "Pemicu pesan Telegram",
    outputs: [{ name: "default", label: "Pesan masuk" }],
    requiredConfig: [],
  },
  waha_event: {
    type: "waha_event", label: "WhatsApp", category: "trigger",
    description: "Pemicu pesan WhatsApp",
    outputs: [{ name: "default", label: "Pesan masuk" }],
    requiredConfig: [],
  },
  http_request: {
    type: "http_request", label: "HTTP Request", category: "action",
    description: "Panggil API eksternal",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["url"],
  },
  send_telegram: {
    type: "send_telegram", label: "Kirim Telegram", category: "action",
    description: "Kirim pesan Telegram",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["connector_id", "text"],
  },
  send_waha: {
    type: "send_waha", label: "Kirim WhatsApp", category: "action",
    description: "Kirim pesan WhatsApp",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["connector_id", "text"],
  },
  condition: {
    type: "condition", label: "Kondisi (IF)", category: "logic",
    description: "Cabang TRUE / FALSE",
    outputs: [
      { name: "true", label: "TRUE" },
      { name: "false", label: "FALSE" },
    ],
    requiredConfig: [],
  },
  transform: {
    type: "transform", label: "Transform", category: "utility",
    description: "Olah data dengan JS",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["code"],
  },
  delay: {
    type: "delay", label: "Tunda", category: "utility",
    description: "Jeda eksekusi",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["delay_ms"],
  },
  log: {
    type: "log", label: "Catat Log", category: "utility",
    description: "Simpan pesan ke log",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["message"],
  },
  send_waha_media: {
    type: "send_waha_media", label: "Kirim Media WA", category: "action",
    description: "Kirim gambar/file WhatsApp via URL",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: ["connector_id", "media_url"],
  },
  ai_chat: {
    type: "ai_chat", label: "AI Chat", category: "action",
    description: "Belum tersedia (Fase 5)",
    outputs: [{ name: "default", label: "Lanjut" }],
    requiredConfig: [],
  },
};

export function nodeMeta(type: string): NodeMeta | undefined {
  return NODE_REGISTRY[type];
}
