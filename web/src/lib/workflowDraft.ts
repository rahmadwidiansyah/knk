export type TriggerType = "manual" | "webhook" | "schedule" | "telegram_event" | "waha_event";
export type NodeType =
  | "http_request"
  | "condition"
  | "transform"
  | "delay"
  | "log"
  | "send_telegram"
  | "send_waha"
  | "send_waha_media";

export interface DraftTrigger {
  type: TriggerType;
  config: Record<string, any>;
}

export interface DraftNode {
  /** Key unik internal (stabil untuk React + referensi next). */
  key: string;
  id: string;
  type: NodeType | string;
  name: string;
  config: Record<string, any>;
  next?: string;
  next_true?: string;
  next_false?: string;
  /** Fan-out: jalankan semua cabang berikut (didukung executor). */
  next_all?: string[];
  on_error?: string;
  /** Node nonaktif dilewati executor (tercatat 'skipped'). */
  disabled?: boolean;
  retry?: { max?: number; delay_ms?: number };
  /** True bila tipe tak dikenal form (mis. ai_chat) — dipertahankan apa adanya. */
  unsupported?: boolean;
}

export interface Draft {
  name: string;
  description: string;
  trigger: DraftTrigger;
  nodes: DraftNode[];
}

export const TRIGGER_LABELS: Record<TriggerType, { label: string }> = {
  manual: { label: "Manual" },
  webhook: { label: "Webhook" },
  schedule: { label: "Jadwal" },
  telegram_event: { label: "Telegram" },
  waha_event: { label: "WhatsApp" },
};

export const NODE_LABELS: Record<string, { label: string }> = {
  http_request: { label: "HTTP Request" },
  condition: { label: "Kondisi" },
  transform: { label: "Transform" },
  delay: { label: "Tunda" },
  log: { label: "Catat Log" },
  send_telegram: { label: "Kirim Telegram" },
  send_waha: { label: "Kirim WhatsApp" },
  send_waha_media: { label: "Kirim Media WA" },
};

let keySeq = 0;
function newKey(): string {
  keySeq++;
  return `n${Date.now().toString(36)}${keySeq}`;
}

export function defaultTriggerConfig(type: TriggerType): Record<string, any> {
  switch (type) {
    case "schedule":
      return { cron: "0 7 * * *", timezone: "Asia/Jakarta" };
    case "telegram_event":
    case "waha_event":
      return { filter: {} };
    default:
      return {};
  }
}

export function defaultNodeConfig(type: string): Record<string, any> {
  switch (type) {
    case "http_request":
      return { url: "https://", method: "GET", headers: {}, timeout_ms: 15000 };
    case "condition":
      return { expression: "{{trigger.count}} > 5" };
    case "transform":
      return { code: "return { hasil: input.trigger }; " };
    case "delay":
      return { delay_ms: 60000 };
    case "log":
      return { message: "" };
    case "send_telegram":
      return { connector_id: "", chat_id: "", text: "" };
    case "send_waha":
      return { connector_id: "", to: "{{trigger.chat_id}}", text: "" };
    case "send_waha_media":
      return { connector_id: "", to: "{{trigger.chat_id}}", media_url: "", media_type: "image", caption: "" };
    default:
      return {};
  }
}

export function defaultNodeName(type: string, n: number): string {
  return `${NODE_LABELS[type]?.label || type} ${n}`;
}

export function makeNode(type: string, index: number, nodes: DraftNode[]): DraftNode {
  const base = `step_${index + 1}`;
  let id = base;
  let i = 1;
  const taken = new Set(nodes.map((x) => x.id));
  while (taken.has(id)) {
    i++;
    id = `${base}_${i}`;
  }
  const node: DraftNode = {
    key: newKey(),
    id,
    type,
    name: defaultNodeName(type, index + 1),
    config: defaultNodeConfig(type),
  };
  if (type === "condition") {
    node.next_true = "step_end";
    node.next_false = "step_end";
  } else {
    node.next = "step_end";
  }
  return node;
}

/** JSON (dari server / mode mentah) → Draft. Node tak dikenal ditandai unsupported. */
export function buildDraftFromJson(raw: any): Draft {
  const nodes: DraftNode[] = Array.isArray(raw?.nodes)
    ? raw.nodes.map((n: any) => ({
        key: newKey(),
        id: String(n.id || ""),
        type: String(n.type || "log"),
        name: String(n.name || n.id || "Node"),
        config: n.config && typeof n.config === "object" ? { ...n.config } : {},
        next: n.next,
        next_true: n.next_true,
        next_false: n.next_false,
        next_all: Array.isArray(n.next_all) ? [...n.next_all] : undefined,
        on_error: n.on_error,
        disabled: n.disabled === true,
        retry: n.retry,
        unsupported: !NODE_LABELS[String(n.type)],
      }))
    : [];
  return {
    name: String(raw?.name || ""),
    description: String(raw?.description || ""),
    trigger: {
      type: (["manual", "webhook", "schedule", "telegram_event", "waha_event"] as const).includes(raw?.trigger?.type)
        ? raw.trigger.type
        : "manual",
      config: raw?.trigger?.config && typeof raw.trigger.config === "object" ? { ...raw.trigger.config } : {},
    },
    nodes,
  };
}

/** Draft → JSON siap kirim sebagai json_config. */
export function draftToJson(d: Draft): any {
  return {
    name: d.name,
    description: d.description,
    trigger: { type: d.trigger.type, config: d.trigger.config },
    nodes: d.nodes.map((n) => {
      const out: Record<string, any> = { id: n.id, type: n.type, name: n.name, config: n.config };
      if (n.next !== undefined) out.next = n.next;
      if (n.next_true !== undefined) out.next_true = n.next_true;
      if (n.next_false !== undefined) out.next_false = n.next_false;
      if (n.next_all && n.next_all.length > 0) out.next_all = [...n.next_all];
      if (n.on_error) out.on_error = n.on_error;
      if (n.disabled) out.disabled = true;
      if (n.retry && (n.retry.max || n.retry.delay_ms)) out.retry = n.retry;
      return out;
    }),
  };
}

/** Validasi ringan di client sebelum kirim (server tetap validator akhir). */
export function validateDraftClient(d: Draft): string[] {
  const errs: string[] = [];
  if (!d.name.trim()) errs.push("Nama workflow wajib diisi.");
  if (d.nodes.length === 0) errs.push("Minimal 1 langkah.");
  const ids = new Set(d.nodes.map((n) => n.id));
  if (ids.size !== d.nodes.length) errs.push("ID langkah harus unik.");
  if (d.nodes.some((n) => !n.id.trim())) errs.push("ID langkah tidak boleh kosong.");
  if (d.trigger.type === "schedule" && !String(d.trigger.config?.cron || "").trim()) {
    errs.push("Jadwal: cron wajib diisi.");
  }
  const idSet = new Set(d.nodes.map((n) => n.id));
  const badTarget = (t?: string) => t !== undefined && t !== "step_end" && !idSet.has(t);
  for (const n of d.nodes) {
    if (n.unsupported) continue;
    if (n.type === "send_waha" && !String(n.config.connector_id || "").trim()) {
      errs.push(`[${n.id}] konektor WA wajib dipilih.`);
    }
    if (n.type === "send_waha_media") {
      if (!String(n.config.connector_id || "").trim()) errs.push(`[${n.id}] konektor WA wajib dipilih.`);
      if (!String(n.config.media_url || "").trim()) errs.push(`[${n.id}] media_url wajib diisi.`);
      if (!String(n.config.to || n.config.chat_id || n.config.chatId || "").trim()) {
        errs.push(`[${n.id}] nomor tujuan wajib diisi.`);
      }
    }
    if (n.type === "send_telegram" && !String(n.config.connector_id || "").trim()) {
      errs.push(`[${n.id}] konektor Telegram wajib dipilih.`);
    }
    if (n.type === "condition") {
      const hasExpr = String(n.config.expression || "").trim();
      const hasStruct = Array.isArray(n.config.conditions) && n.config.conditions.length > 0;
      if (!hasExpr && !hasStruct) errs.push(`[${n.id}] kondisi wajib diisi (ekspresi atau terstruktur).`);
    }
    for (const t of [n.next, n.next_true, n.next_false, n.on_error]) {
      if (badTarget(t)) errs.push(`[${n.id}] menunjuk ke id tak dikenal '${t}'.`);
    }
    for (const t of n.next_all || []) {
      if (badTarget(t)) errs.push(`[${n.id}] cabang menunjuk ke id tak dikenal '${t}'.`);
    }
  }
  return errs;
}
