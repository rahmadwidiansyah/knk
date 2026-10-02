import { Router } from "express";
import { getConnectorDecrypted } from "../../services/connector.service";
import { fanOut } from "../../services/inbound.service";

const router = Router();

// WAHA dashboard → Webhooks → URL ini, event `message`.
// Format payload WAHA v2 Core: { event, session, payload: { from, fromMe, body/_data.body, ... } }
router.post("/:connectorId", async (req, res, next) => {
  try {
    let name = req.params.connectorId;
    try {
      const found = await getConnectorDecrypted(req.params.connectorId);
      if (found.row.type !== "waha") return res.status(404).json({ error: "Bukan connector waha" });
      if (found.row.isActive !== 1) return res.status(404).json({ error: "Connector nonaktif" });
      name = found.row.name;
    } catch {
      return res.status(404).json({ error: "Connector tidak ditemukan" });
    }

    const event = req.body?.event;
    if (event !== "message" && event !== "message.any") {
      return res.json({ ok: true, ignored: true, event });
    }
    const p = req.body?.payload || {};
    const chatId = String(p.from || p.to || "");
    const text = String(p.body ?? p._data?.body ?? "");
    const fromMe = p.fromMe === true;
    const isGroup = chatId.endsWith("@g.us");
    if (!chatId || !text) return res.json({ ok: true, ignored: true });

    const session = req.body?.session;
    const fired = await fanOut("waha_event", () => ({
      triggerData: {
        platform: "waha",
        connector_id: req.params.connectorId,
        connector_name: name,
        session,
        chat_id: chatId,
        from: chatId,
        text,
        is_group: isGroup,
        // Konteks ternormalisasi (stabil antar provider) + raw untuk advanced.
        source: "waha",
        connector: { id: req.params.connectorId, name },
        event: "message",
        chat: { id: chatId, type: isGroup ? "group" : "private" },
        sender: { id: chatId, name: chatId.replace(/@.*$/, "") },
        message: { id: p.id ?? p.key?.id ?? null, text, type: "text" },
        raw: req.body,
        received_at: new Date().toISOString(),
      },
      match: { chatId, text, isGroup, fromMe, connectorId: req.params.connectorId },
    }));

    res.json({ ok: true, fired });
  } catch (e) {
    next(e);
  }
});

export default router;
