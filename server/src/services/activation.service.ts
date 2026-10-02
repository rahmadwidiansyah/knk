import { eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { connectors } from "../db/schema";
import { nodeMeta } from "../engine/nodes";
import type { WorkflowConfig } from "../types/workflow.types";

export interface ActivationIssue {
  nodeId: string | null;
  message: string;
}

/**
 * Validasi sebelum workflow diaktifkan. Zod schema sudah lolos saat save;
 * di sini cek hal yang butuh konteks DB: connector ada & aktif,
 * trigger terkonfigurasi, cabang IF lengkap, node required terisi.
 */
export async function validateForActivation(
  userId: string,
  config: WorkflowConfig
): Promise<ActivationIssue[]> {
  const issues: ActivationIssue[] = [];
  const db = getDb();

  const conns = await db.select().from(connectors).where(eq(connectors.userId, userId));
  const byId = new Map(conns.map((c) => [c.id, c]));
  const byName = new Map(conns.map((c) => [c.name, c]));

  const unwrapRef = (ref: unknown): string => {
    const s = String(ref || "").trim();
    const m = s.match(/^\{\{\s*connector\.([a-zA-Z0-9_.-]+)\s*\}\}$/);
    return m ? m[1] : s;
  };

  const resolveConn = (ref: unknown): { ok: boolean; active: boolean; name: string } => {
    const s = unwrapRef(ref);
    const row = byId.get(s) || byName.get(s);
    if (!row) return { ok: false, active: false, name: s };
    return { ok: true, active: row.isActive === 1, name: row.name };
  };

  // --- trigger ---
  const t = config.trigger;
  if (t.type === "schedule" && !String(t.config?.cron || "").trim()) {
    issues.push({ nodeId: null, message: "Trigger jadwal belum punya cron." });
  }
  if ((t.type === "telegram_event" || t.type === "waha_event") && t.config?.connector_id) {
    const r = resolveConn(t.config.connector_id);
    if (!r.ok) {
      issues.push({ nodeId: null, message: `Konektor trigger '${t.config.connector_id}' tidak ditemukan.` });
    } else if (!r.active) {
      issues.push({ nodeId: null, message: `Konektor trigger '${r.name}' nonaktif.` });
    }
  }

  // --- nodes ---
  for (const n of config.nodes) {
    if (n.disabled) continue;
    const meta = nodeMeta(n.type);
    if (!meta) {
      issues.push({ nodeId: n.id, message: `Tipe node '${(n as any).type}' tak dikenal.` });
      continue;
    }
    for (const f of meta.requiredConfig) {
      const v = (n.config || {})[f];
      if (v === undefined || v === null || String(v).trim() === "") {
        issues.push({ nodeId: n.id, message: `'${n.name}' belum diisi: ${f}.` });
      }
    }
    if (n.type === "send_waha" || n.type === "send_waha_media") {
      const c = n.config || {};
      if (!c.to && !c.chat_id && !c.chatId) {
        issues.push({ nodeId: n.id, message: `'${n.name}' belum diisi: to/chat_id tujuan.` });
      }
    }
    if (n.type === "send_telegram") {
      const c = n.config || {};
      if (c.chat_id === undefined && c.chatId === undefined) {
        issues.push({ nodeId: n.id, message: `'${n.name}' belum diisi: chat_id.` });
      }
    }
    if (n.type === "send_telegram" || n.type === "send_waha") {
      const ref = n.config?.connector_id;
      if (ref) {
        const r = resolveConn(ref);
        if (!r.ok) {
          issues.push({ nodeId: n.id, message: `'${n.name}': konektor '${ref}' tidak ditemukan.` });
        } else if (!r.active) {
          issues.push({ nodeId: n.id, message: `'${n.name}': konektor '${r.name}' nonaktif.` });
        }
      }
    }
    if (n.type === "condition") {
      const hasExpr = typeof n.config?.expression === "string" && n.config.expression.trim();
      const hasStruct = Array.isArray(n.config?.conditions) && n.config.conditions.length > 0;
      if (!hasExpr && !hasStruct) {
        issues.push({ nodeId: n.id, message: `'${n.name}' belum punya kondisi.` });
      }
      if (!n.next_true || !n.next_false) {
        issues.push({ nodeId: n.id, message: `'${n.name}' butuh cabang TRUE dan FALSE.` });
      }
    }
  }

  return issues;
}
