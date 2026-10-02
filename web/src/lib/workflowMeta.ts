import { scheduleShort } from "./scheduleModel";
import { NODE_LABELS } from "./workflowDraft";

const TRIGGER_ID: Record<string, string> = {
  manual: "Manual",
  webhook: "Webhook",
  schedule: "Jadwal",
  telegram_event: "Pesan Telegram",
  waha_event: "Pesan WhatsApp",
};

/** "Jadwal · Tiap hari 22:00" — tanpa cron mentah. */
export function triggerLine(cfg: any): string {
  const t = cfg?.trigger?.type || "manual";
  if (t === "schedule") return `Jadwal · ${scheduleShort(String(cfg.trigger.config?.cron || ""))}`;
  return TRIGGER_ID[t] || t;
}

/** "Pemicu Jadwal → Kirim WhatsApp" + jumlah langkah. */
export function flowLine(cfg: any): { flow: string; steps: number } {
  const nodes: any[] = Array.isArray(cfg?.nodes) ? cfg.nodes : [];
  const t = cfg?.trigger?.type || "manual";
  const triggerName =
    t === "schedule" ? "Jadwal" : t === "webhook" ? "Webhook" : t === "manual" ? "Manual" : t === "waha_event" ? "Pesan WA" : t === "telegram_event" ? "Pesan TG" : t;
  const first = nodes.find((n) => n.type !== "condition" && n.type !== "delay" && n.type !== "log" && n.type !== "transform");
  const actionName = first ? NODE_LABELS[first.type]?.label || first.type : "—";
  return { flow: `${triggerName} → ${actionName}`, steps: nodes.length };
}
