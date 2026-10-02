/**
 * Cerminan frontend dari server/src/engine/nodes.ts (metadata saja).
 * Eksekusi tetap milik backend; file ini hanya untuk label/ikon/kategori UI.
 * Jika tipe baru ditambah di backend, daftarkan juga di sini.
 */

export interface RegistryOutput {
  name: string;
  label: string;
}

export interface RegistryEntry {
  type: string;
  label: string;
  category: "trigger" | "action" | "logic" | "utility";
  description: string;
  outputs: RegistryOutput[];
}

export const NODE_REGISTRY: Record<string, RegistryEntry> = {
  webhook: {
    type: "webhook", label: "Webhook", category: "trigger",
    description: "Menerima HTTP request publik",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  schedule: {
    type: "schedule", label: "Jadwal", category: "trigger",
    description: "Berjalan sesuai cron",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  manual: {
    type: "manual", label: "Manual", category: "trigger",
    description: "Jalan via tombol Test",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  telegram_event: {
    type: "telegram_event", label: "Telegram", category: "trigger",
    description: "Pemicu pesan Telegram",
    outputs: [{ name: "default", label: "Pesan masuk" }],
  },
  waha_event: {
    type: "waha_event", label: "WhatsApp", category: "trigger",
    description: "Pemicu pesan WhatsApp",
    outputs: [{ name: "default", label: "Pesan masuk" }],
  },
  http_request: {
    type: "http_request", label: "HTTP Request", category: "action",
    description: "Panggil API eksternal",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  send_telegram: {
    type: "send_telegram", label: "Kirim Telegram", category: "action",
    description: "Kirim pesan Telegram",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  send_waha: {
    type: "send_waha", label: "Kirim WhatsApp", category: "action",
    description: "Kirim pesan WhatsApp",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  send_waha_media: {
    type: "send_waha_media", label: "Kirim Media WA", category: "action",
    description: "Kirim gambar/file WhatsApp via URL",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  condition: {
    type: "condition", label: "Kondisi (IF)", category: "logic",
    description: "Cabang TRUE / FALSE",
    outputs: [
      { name: "true", label: "TRUE" },
      { name: "false", label: "FALSE" },
    ],
  },
  transform: {
    type: "transform", label: "Transform", category: "utility",
    description: "Olah data dengan JS",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  delay: {
    type: "delay", label: "Tunda", category: "utility",
    description: "Jeda eksekusi",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
  log: {
    type: "log", label: "Catat Log", category: "utility",
    description: "Simpan pesan ke log",
    outputs: [{ name: "default", label: "Lanjut" }],
  },
};

export function registryEntry(type: string): RegistryEntry | undefined {
  return NODE_REGISTRY[type];
}
