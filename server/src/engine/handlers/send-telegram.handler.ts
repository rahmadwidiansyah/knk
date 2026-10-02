import type { ExecutionContext } from "../context";
import { getConnectorDecrypted, resolveConnector } from "../../services/connector.service";
import { tgSendMessage } from "../../integrations/telegram/client";

function ownerOf(ctx: ExecutionContext): string {
  const id = ctx.get("__ownerId");
  if (!id) throw Object.assign(new Error("Konteks eksekusi tanpa owner"), { status: 500 });
  return id as string;
}

async function loadConnector(ctx: ExecutionContext, ref: string, type: "telegram" | "waha") {
  if (!ref) throw Object.assign(new Error("connector_id wajib diisi"), { status: 400 });
  // Coba sebagai ID dulu (tanpa cek owner agar pesan error konsisten), fallback nama milik owner
  try {
    const { row, cfg } = await getConnectorDecrypted(ref);
    if (row.type !== type) {
      throw Object.assign(new Error(`Connector '${row.name}' bertipe ${row.type}, butuh ${type}`), { status: 400 });
    }
    if (row.isActive !== 1) throw Object.assign(new Error(`Connector '${row.name}' nonaktif`), { status: 400 });
    return { row, cfg };
  } catch (e: any) {
    if (e?.status === 400) throw e;
    return resolveConnector(ownerOf(ctx), ref, type);
  }
}

export async function sendTelegramHandler(
  config: Record<string, any>,
  ctx: ExecutionContext
): Promise<Record<string, any>> {
  const ref = String(config.connector_id || "");
  const chatId = config.chat_id ?? config.chatId;
  const text = String(config.text ?? "");
  if (chatId === undefined || chatId === "") {
    throw Object.assign(new Error("send_telegram butuh chat_id"), { status: 400 });
  }
  if (!text) throw Object.assign(new Error("send_telegram butuh text"), { status: 400 });
  const { row, cfg } = await loadConnector(ctx, ref, "telegram");
  const token = (cfg as any).bot_token;
  if (!token) throw Object.assign(new Error(`Connector '${row.name}' tanpa bot_token`), { status: 500 });
  const sent: any = await tgSendMessage(token, chatId as any, text.slice(0, 4000), config.parse_mode);
  return { message_id: sent?.message_id, chat_id: sent?.chat?.id ?? chatId };
}
