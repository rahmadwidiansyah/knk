import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { getConnectorDecrypted } from "../../services/connector.service";
import { fanOut } from "../../services/inbound.service";

const router = Router();

// Manual webhook: user pasang URL ini via setWebhook Bot API.
// Verifikasi opsional: header X-Telegram-Bot-Api-Secret-Token bila secret_token diisi.
router.post("/:connectorId", async (req, res, next) => {
  try {
    let cfg: any;
    let name = req.params.connectorId;
    try {
      const found = await getConnectorDecrypted(req.params.connectorId);
      if (found.row.type !== "telegram") return res.status(404).json({ error: "Bukan connector telegram" });
      if (found.row.isActive !== 1) return res.status(404).json({ error: "Connector nonaktif" });
      cfg = found.cfg;
      name = found.row.name;
    } catch {
      return res.status(404).json({ error: "Connector tidak ditemukan" });
    }

    const expected = (cfg as any).secret_token;
    if (expected) {
      const got = String(req.headers["x-telegram-bot-api-secret-token"] || "");
      const a = Buffer.from(got);
      const b = Buffer.from(String(expected));
      const same = a.length === b.length && timingSafeEqual(a, b);
      if (!same) return res.status(401).json({ error: "Secret token salah" });
    }

    const msg = req.body?.message || req.body?.edited_message;
    if (!msg) {
      // Update non-pesan (callback_query dll) → ack saja Fase 4
      return res.json({ ok: true, ignored: true });
    }
    const chatId = String(msg.chat?.id ?? "");
    const text = String(msg.text ?? msg.caption ?? "");
    const from = msg.from ? { id: msg.from.id, username: msg.from.username, name: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") } : null;

    const isGroup = chatId.startsWith("-");
    const fired = await fanOut("telegram_event", () => ({
      triggerData: {
        platform: "telegram",
        connector_id: req.params.connectorId,
        connector_name: name,
        chat_id: chatId,
        from,
        text,
        is_group: isGroup,
        // Konteks ternormalisasi (stabil antar provider) + raw untuk advanced.
        source: "telegram",
        connector: { id: req.params.connectorId, name },
        event: "message",
        chat: { id: chatId, type: isGroup ? "group" : "private" },
        sender: { id: String(from?.id ?? ""), name: from?.name || from?.username || "" },
        message: { id: msg.message_id ? String(msg.message_id) : null, text, type: "text" },
        raw: req.body,
        received_at: new Date().toISOString(),
      },
      match: { chatId, text, isGroup, fromMe: false, connectorId: req.params.connectorId },
    }));

    res.json({ ok: true, fired });
  } catch (e) {
    next(e);
  }
});

export default router;
