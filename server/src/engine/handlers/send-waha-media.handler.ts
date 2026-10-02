import type { ExecutionContext } from "../context";
import { getConnectorDecrypted, resolveConnector } from "../../services/connector.service";
import { wahaSendMedia } from "../../integrations/waha/client";

function ownerOf(ctx: ExecutionContext): string {
  const id = ctx.get("__ownerId");
  if (!id) throw Object.assign(new Error("Konteks eksekusi tanpa owner"), { status: 500 });
  return id as string;
}

export async function sendWahaMediaHandler(
  config: Record<string, any>,
  ctx: ExecutionContext
): Promise<Record<string, any>> {
  const ref = String(config.connector_id || "");
  const to = String(config.to ?? config.chat_id ?? config.chatId ?? "");
  const mediaUrl = String(config.media_url || "");
  const caption = String(config.caption || "");
  const kind = config.media_type === "file" ? "file" : "image";
  if (!ref) throw Object.assign(new Error("send_waha_media butuh connector_id"), { status: 400 });
  if (!to) throw Object.assign(new Error("send_waha_media butuh to/chat_id"), { status: 400 });
  if (!mediaUrl) throw Object.assign(new Error("send_waha_media butuh media_url (URL publik)"), { status: 400 });
  if (!/^https?:\/\//i.test(mediaUrl)) {
    throw Object.assign(new Error("send_waha_media: media_url harus URL http(s) publik"), { status: 400 });
  }

  let cfg: any;
  let name = ref;
  try {
    const found = await getConnectorDecrypted(ref);
    if (found.row.type !== "waha") {
      throw Object.assign(new Error(`Connector '${found.row.name}' bertipe ${found.row.type}, butuh waha`), {
        status: 400,
      });
    }
    if (found.row.isActive !== 1) throw Object.assign(new Error(`Connector '${found.row.name}' nonaktif`), { status: 400 });
    cfg = found.cfg;
    name = found.row.name;
  } catch (e: any) {
    if (e?.status === 400) throw e;
    const found = await resolveConnector(ownerOf(ctx), ref, "waha");
    cfg = found.cfg;
    name = found.row.name;
  }

  const sent: any = await wahaSendMedia(
    { base_url: cfg.base_url, api_key: cfg.api_key, session: config.session || cfg.session || "default" },
    to,
    mediaUrl,
    { kind, caption: caption.slice(0, 1024) || undefined, session: config.session || cfg.session || "default" }
  );
  return { sent: true, connector: name, kind, id: sent?.id ?? sent?.key?.id ?? null };
}
