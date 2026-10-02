import { useEffect, useState } from "react";
import { NodeTypeIcon } from "./icons";
import ScheduleBuilder from "./builder/ScheduleBuilder";
import { listConnectors } from "../lib/integrations";
import { defaultTriggerConfig, TRIGGER_LABELS, type DraftTrigger, type TriggerType } from "../lib/workflowDraft";

interface Props {
  trigger: DraftTrigger;
  onChange: (t: DraftTrigger) => void;
  webhookUrl?: string | null;
  scheduled?: boolean;
  onCopyWebhook?: () => void;
  onRegenerateWebhook?: () => void;
  copied?: boolean;
}

const TYPES: TriggerType[] = ["manual", "schedule", "webhook", "waha_event", "telegram_event"];

function EventTriggerForm({ trigger, filter, setConfig, setFilter, inputStyle }: {
  trigger: DraftTrigger;
  filter: Record<string, any>;
  setConfig: (patch: Record<string, any>) => void;
  setFilter: (patch: Record<string, any>) => void;
  inputStyle: React.CSSProperties;
}) {
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; type: string }>>([]);
  useEffect(() => {
    listConnectors().then((c: any[]) => setConnectors(c.map((x) => ({ id: x.id, name: x.name, type: x.type })))).catch(() => {});
  }, []);
  const wantType = trigger.type === "waha_event" ? "waha" : "telegram";
  const list = connectors.filter((c) => c.type === wantType);
  const legacyText = filter.text_contains || filter.text_equals;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem" }}>
        {trigger.type === "waha_event" ? "Akun WhatsApp sumber" : "Bot Telegram sumber"}
        <select
          value={String(trigger.config?.connector_id || "")}
          onChange={(e) => setConfig({ connector_id: e.target.value || undefined })}
          style={inputStyle}
        >
          <option value="">— pilih konektor —</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem" }}>
        Chat ID (opsional — kosongkan = semua chat)
        <input
          value={(filter.chats || []).join(", ")}
          onChange={(e) =>
            setFilter({ chats: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
          placeholder={trigger.type === "waha_event" ? "62812@c.us" : "123456"}
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center", fontSize: "0.8rem" }}>
        <input
          type="checkbox"
          checked={filter.is_group === false}
          onChange={(e) => setFilter({ is_group: e.target.checked ? false : undefined })}
        />
        Abaikan pesan grup
      </label>
      {legacyText && (
        <details style={{ fontSize: "0.75rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--md-sys-color-on-surface-variant)" }}>
            Filter teks lama (deprecated — pakai node IF)
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Text mengandung
              <input value={filter.text_contains || ""} onChange={(e) => setFilter({ text_contains: e.target.value || undefined })} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Text persis sama
              <input value={filter.text_equals || ""} onChange={(e) => setFilter({ text_equals: e.target.value || undefined })} style={inputStyle} />
            </label>
          </div>
        </details>
      )}
      <p className="md3-card__supporting" style={{ margin: 0, fontSize: "0.75rem" }}>
        Butuh saring isi pesan? Tambahkan node <strong>Kondisi (IF)</strong> setelah trigger.
      </p>
    </div>
  );
}

export default function TriggerForm(p: Props) {
  const { trigger, onChange } = p;

  function setType(type: TriggerType) {
    onChange({ type, config: defaultTriggerConfig(type) });
  }

  function setConfig(patch: Record<string, any>) {
    onChange({ type: trigger.type, config: { ...trigger.config, ...patch } });
  }

  const filter = trigger.config?.filter || {};

  function setFilter(patch: Record<string, any>) {
    setConfig({ filter: { ...filter, ...patch } });
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "inherit",
    fontSize: "0.875rem",
    padding: "8px 12px",
    borderRadius: "var(--md-sys-shape-corner-small)",
    border: "1px solid var(--md-sys-color-outline)",
    background: "var(--md-sys-color-surface)",
    color: "var(--md-sys-color-on-surface)",
    width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`md3-button ${trigger.type === t ? "md3-button--filled" : "md3-button--tonal"}`}
            onClick={() => setType(t)}
          >
            <span style={{ display: "inline-flex", verticalAlign: "-3px", marginRight: 6 }}><NodeTypeIcon type={t} size={15} /></span>{TRIGGER_LABELS[t].label}
          </button>
        ))}
      </div>

      {trigger.type === "manual" && (
        <p className="md3-card__supporting" style={{ margin: 0 }}>
          Tanpa config — hanya jalan via tombol Test.
        </p>
      )}

      {trigger.type === "webhook" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="md3-card__supporting" style={{ margin: 0 }}>
            Endpoint publik (tanpa login) → eksekusi async. Aktifkan workflow agar URL hidup.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem" }}>
              Method diizinkan
              <select
                value={(trigger.config?.methods || ["POST"]).join(",")}
                onChange={(e) => {
                  const v = e.target.value;
                  setConfig({ methods: v === "POST" ? undefined : v.split(",") });
                }}
                style={inputStyle}
              >
                <option value="POST">POST saja</option>
                <option value="GET,POST">GET + POST</option>
                <option value="GET,POST,PUT,PATCH,DELETE">Semua</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem" }}>
              Secret (opsional)
              <input
                value={trigger.config?.secret || ""}
                onChange={(e) => setConfig({ secret: e.target.value || undefined })}
                placeholder="via header x-webhook-secret"
                style={{ ...inputStyle, fontFamily: "monospace" }}
              />
            </label>
          </div>
          {p.webhookUrl ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ flex: 1, fontSize: "0.8rem", wordBreak: "break-all", background: "var(--md-sys-color-surface-container-low)", padding: "8px 12px", borderRadius: 8 }}>
                {p.webhookUrl}
              </code>
              <button type="button" className="md3-button md3-button--tonal" onClick={p.onCopyWebhook}>
                {p.copied ? "Tersalin!" : "Copy"}
              </button>
              <button type="button" className="md3-button md3-button--text" onClick={p.onRegenerateWebhook}>
                Regenerate
              </button>
            </div>
          ) : (
            <p className="md3-card__supporting">Webhook dibuat otomatis saat workflow disimpan.</p>
          )}
        </div>
      )}

      {trigger.type === "schedule" && (
        <ScheduleBuilder
          cron={String(trigger.config?.cron || "0 7 * * *")}
          timezone={String(trigger.config?.timezone || "Asia/Jakarta")}
          scheduled={p.scheduled}
          onChange={(cron, timezone) => setConfig({ cron, timezone })}
        />
      )}

      {(trigger.type === "telegram_event" || trigger.type === "waha_event") && (
        <EventTriggerForm
          trigger={trigger}
          filter={filter}
          setConfig={setConfig}
          setFilter={setFilter}
          inputStyle={inputStyle}
        />
      )}
    </div>
  );
}
