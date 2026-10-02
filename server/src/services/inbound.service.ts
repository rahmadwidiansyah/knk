import { eq } from "drizzle-orm";
import { getDb } from "../db/connection";
import { workflows } from "../db/schema";
import { executeWorkflow } from "../engine/executor";

export interface TriggerFilter {
  connector_id?: string;
  chats?: string[];
  text_contains?: string;
  text_equals?: string;
  is_group?: boolean;
  allow_from_me?: boolean;
}

export function matchFilter(filter: TriggerFilter | undefined, msg: { chatId: string; text: string; isGroup: boolean; fromMe: boolean; connectorId: string }): boolean {
  const f = filter || {};
  if (f.connector_id && f.connector_id !== msg.connectorId) return false;
  if (f.chats && f.chats.length > 0 && !f.chats.includes(msg.chatId)) return false;
  if (f.text_contains && !msg.text.includes(f.text_contains)) return false;
  if (f.text_equals !== undefined && msg.text !== f.text_equals) return false;
  if (f.is_group !== undefined && f.is_group !== msg.isGroup) return false;
  if (msg.fromMe && !f.allow_from_me) return false;
  return true;
}

/** Bentuk event ternormalisasi: sama untuk telegram & waha, mudah dipakai IF. */
export interface NormalizedEvent {
  source: "telegram" | "waha";
  connector: { id: string; name: string };
  event: string;
  chat: { id: string; type: "private" | "group" };
  sender: { id: string; name: string };
  message: { id: string | null; text: string; type: string };
  raw: unknown;
}

/** Fan-out async ke semua workflow aktif dengan trigger type tsb + filter cocok. */
export async function fanOut(
  triggerType: "telegram_event" | "waha_event",
  buildData: (cfg: any) => { triggerData: any; match: { chatId: string; text: string; isGroup: boolean; fromMe: boolean; connectorId: string } }
): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(workflows).where(eq(workflows.isActive, 1));
  let fired = 0;
  for (const row of rows) {
    let cfg: any;
    try {
      cfg = JSON.parse(row.jsonConfig);
    } catch {
      continue;
    }
    if (cfg?.trigger?.type !== triggerType) continue;
    const tcfg = cfg.trigger.config || {};
    // connector_id top-level diutamakan; filter.connector_id lama tetap didukung.
    const pinned = tcfg.connector_id || tcfg.filter?.connector_id;
    const { triggerData, match } = buildData(cfg);
    if (pinned && pinned !== match.connectorId) continue;
    if (!matchFilter(tcfg.filter, match)) continue;
    fired++;
    executeWorkflow(row.id, cfg, triggerType, triggerData).catch((e) => {
      console.error(`[inbound:${triggerType}:${row.id}] async failed:`, e?.message || e);
    });
  }
  return fired;
}
