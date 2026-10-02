import type { DraftNode } from "./workflowDraft";
import { scheduleShort } from "./scheduleModel";

function short(v: unknown, max = 48): string {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const OP_LABEL: Record<string, string> = {
  equals: "=", not_equals: "≠", contains: "mengandung", not_contains: "tak mengandung",
  starts_with: "diawali", ends_with: "diakhiri", is_empty: "kosong", is_not_empty: "isi",
  gt: ">", gte: "≥", lt: "<", lte: "≤", is_true: "true", is_false: "false",
  exists: "ada", not_exists: "tak ada",
};

export function conditionSummary(c: Record<string, any>): string {
  if (Array.isArray(c.conditions) && c.conditions.length > 0) {
    const parts = c.conditions.map((x: any) => {
      const op = OP_LABEL[x.operator] || x.operator;
      const fld = short(String(x.field || "?").replace(/^\{\{\s*|\s*\}\}$/g, ""), 24);
      const val = x.value === undefined ? "" : ` ${short(String(x.value), 16)}`;
      return `${fld} ${op}${val}`;
    });
    const joiner = c.combinator === "any" ? " ATAU " : " DAN ";
    return `Jika ${parts.join(joiner)}`.slice(0, 60);
  }
  return `Jika ${short(c.expression || "—", 44)}`;
}

/** Ringkasan 1–2 baris untuk kartu canvas. Jangan tampilkan field teknis. */
export function nodeSummary(n: DraftNode): string[] {
  const c = n.config || {};
  switch (n.type) {
    case "send_waha": {
      const to = String(c.to || c.chat_id || c.chatId || "").replace(/@c\.us$/, "");
      return [`Kirim ke ${to || "—"}`, `“${short(c.text || "—", 40)}”`];
    }
    case "send_waha_media": {
      const to = String(c.to || c.chat_id || c.chatId || "").replace(/@c\.us$/, "");
      return [`Kirim ${c.media_type === "file" ? "file" : "gambar"} ke ${to || "—"}`, `“${short(c.caption || c.media_url || "—", 40)}”`];
    }
    case "send_telegram": {
      const chat = String(c.chat_id ?? c.chatId ?? "—");
      return [`Kirim ke ${short(chat, 20)}`, `“${short(c.text || "—", 40)}”`];
    }
    case "condition":
      return [conditionSummary(c)];
    case "http_request":
      return [`${String(c.method || "GET")} ${short(c.url || "—", 40)}`];
    case "delay": {
      const ms = Number(c.delay_ms || 0);
      const txt = ms >= 60000 ? `${Math.round(ms / 60000)} mnt` : ms >= 1000 ? `${Math.round(ms / 1000)} dtk` : `${ms} ms`;
      return [`Tunggu ${txt}`];
    }
    case "transform":
      return [`Olah data (JS)`];
    case "log":
      return [`“${short(c.message || "—", 44)}”`];
    default:
      return [String(n.type)];
  }
}

export function triggerSummary(type: string, config: Record<string, any>): string[] {
  switch (type) {
    case "manual":
      return ["Jalan via Test"];
    case "schedule":
      return [scheduleShort(String(config?.cron || ""))];
    case "webhook":
      return ["POST publik"];
    case "waha_event": {
      const f = config?.filter;
      const who = config?.connector_id ? " · konektor terpilih" : "";
      if (f?.text_contains) return [`“${f.text_contains}”${who}`];
      const chat = f?.chats?.[0];
      return [`${chat ? short(chat, 22) : "Semua pesan WA"}${who}`];
    }
    case "telegram_event": {
      const f = config?.filter;
      const who = config?.connector_id ? " · konektor terpilih" : "";
      if (f?.text_contains) return [`“${f.text_contains}”${who}`];
      const chat = f?.chats?.[0];
      return [`${chat ? short(chat, 22) : "Semua pesan Telegram"}${who}`];
    }
    default:
      return [type];
  }
}

/** Apakah node terasa "terkonfigurasi" (punya field kunci terisi)? */
export function isConfigured(n: DraftNode): boolean {
  const c = n.config || {};
  switch (n.type) {
    case "send_waha":
      return Boolean(c.connector_id && (c.to || c.chat_id || c.chatId) && c.text);
    case "send_waha_media":
      return Boolean(c.connector_id && (c.to || c.chat_id || c.chatId) && c.media_url);
    case "send_telegram":
      return Boolean(c.connector_id && (c.chat_id ?? c.chatId) && c.text);
    case "condition":
      return Boolean(String(c.expression || "").trim());
    case "http_request":
      return Boolean(String(c.url || "").trim() && c.url !== "https://");
    case "transform":
      return Boolean(String(c.code || "").trim());
    case "delay":
      return Number(c.delay_ms) > 0;
    case "log":
      return Boolean(String(c.message || "").trim());
    default:
      return true;
  }
}
