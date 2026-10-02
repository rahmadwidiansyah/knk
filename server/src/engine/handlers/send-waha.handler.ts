import type { ExecutionContext } from "../context";
import { getConnectorDecrypted, resolveConnector } from "../../services/connector.service";
import { wahaSendText } from "../../integrations/waha/client";

function ownerOf(ctx: ExecutionContext): string {
  const id = ctx.get("__ownerId");
  if (!id) throw Object.assign(new Error("Konteks eksekusi tanpa owner"), { status: 500 });
  return id as string;
}

export async function sendWahaHandler(
  config: Record<string, any>,
  ctx: ExecutionContext
): Promise<Record<string, any>> {
  const ref = String(config.connector_id || "");
  const to = String(config.to ?? config.chat_id ?? config.chatId ?? "");
  const text = String(config.text ?? "");
  if (!ref) throw Object.assign(new Error("send_waha butuh connector_id"), { status: 400 });
  if (!to) throw Object.assign(new Error("send_waha butuh to/chat_id"), { status: 400 });
  if (!text) throw Object.assign(new Error("send_waha butuh text"), { status: 400 });

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

  // base_url privat (selfhost LAN/docker) diizinkan eksplisit — hanya untuk connector terdaftar.
  const sent: any = await wahaSendText(
    { base_url: cfg.base_url, api_key: cfg.api_key, session: config.session || cfg.session || "default" },
    to,
    text.slice(0, 4000),
    config.session || cfg.session || "default"
  );
  return { sent: true, connector: name, id: sent?.id ?? sent?.key?.id ?? null };
}
