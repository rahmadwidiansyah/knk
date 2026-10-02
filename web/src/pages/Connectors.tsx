import { useEffect, useState } from "react";
import {
  createConnector,
  deleteConnector,
  listConnectors,
  receiverUrl,
  testConnector,
  updateConnector,
  type Connector,
} from "../lib/integrations";
import { Cable, Check, CircleX, Loader2, PlugZap, Plus, ProviderIcon } from "../components/icons";
import OverflowMenu from "../components/OverflowMenu";

export default function Connectors() {
  const [items, setItems] = useState<Connector[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"telegram" | "waha" | null>(null);
  const [name, setName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [secretToken, setSecretToken] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [session, setSession] = useState("default");
  const [testing, setTesting] = useState<string | null>(null);
  const [testState, setTestState] = useState<Record<string, { ok: boolean; msg: string }>>({});

  async function load() {
    try {
      setItems(await listConnectors());
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return;
    setError("");
    try {
      const config =
        type === "telegram"
          ? { bot_token: botToken.trim(), ...(secretToken.trim() ? { secret_token: secretToken.trim() } : {}) }
          : { base_url: baseUrl.trim(), ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}), session: session.trim() || "default" };
      await createConnector({ type, name: name.trim(), config });
      resetForm();
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message);
    }
  }

  function resetForm() {
    setType(null);
    setName("");
    setBotToken("");
    setSecretToken("");
    setBaseUrl("");
    setApiKey("");
    setSession("default");
  }

  async function onTest(c: Connector) {
    setTesting(c.id);
    try {
      const out: any = await testConnector(c.id);
      const msg =
        c.type === "telegram"
          ? out.username
            ? `Terhubung sebagai @${out.username}`
            : "Terhubung"
          : `Session “${out.session}”: ${out.session_status}`;
      setTestState((p) => ({ ...p, [c.id]: { ok: true, msg } }));
    } catch (e: any) {
      setTestState((p) => ({ ...p, [c.id]: { ok: false, msg: e?.response?.data?.error || e.message } }));
    } finally {
      setTesting(null);
    }
  }

  async function onToggle(c: Connector) {
    try {
      await updateConnector(c.id, { is_active: c.is_active === 1 ? 0 : 1 });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  }

  async function onDelete(c: Connector) {
    if (!confirm(`Hapus connector '${c.name}'?`)) return;
    try {
      await deleteConnector(c.id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => setError("Gagal menyalin."));
  }

  return (
    <div className="lf-page">
      <div className="lf-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Connectors</h1>
          <p>Hubungkan LightFlow ke layanan yang kamu gunakan</p>
        </div>
        <div className="spacer" />
        <button type="button" className="lf-btn lf-btn--primary" onClick={() => { resetForm(); setShowForm((s) => !s); }}>
          <Plus size={15} aria-hidden /> Tambah connector
        </button>
      </div>
      {error && <div className="lf-error">{error}</div>}

      {showForm && (
        <div className="lf-card">
          <h3>Provider apa?</h3>
          <p className="sub">Pilih dulu, field menyesuaikan.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(
              [
                { id: "waha", label: "WhatsApp" },
                { id: "telegram", label: "Telegram" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`lf-btn ${type === t.id ? "lf-btn--primary" : "lf-btn--secondary"}`}
                onClick={() => setType(t.id)}
              >
                <ProviderIcon provider={t.id} size={17} /> {t.label}
              </button>
            ))}
          </div>
          {type && (
            <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 460 }}>
              <label className="lf-field">
                <span>Nama koneksi</span>
                <input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="wa_main" required />
                <small>Dipakai sebagai {"{{connector.nama}}"} di workflow.</small>
              </label>
              {type === "telegram" ? (
                <>
                  <label className="lf-field">
                    <span>Bot token</span>
                    <input className="lf-input" type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123:ABC" required />
                    <small>Dari BotFather.</small>
                  </label>
                  <label className="lf-field">
                    <span>Secret webhook (opsional)</span>
                    <input className="lf-input" value={secretToken} onChange={(e) => setSecretToken(e.target.value)} placeholder="string acak" />
                  </label>
                </>
              ) : (
                <>
                  <label className="lf-field">
                    <span>WAHA URL</span>
                    <input className="lf-input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://192.168.1.101:3000" required />
                    <small>Harus terjangkau dari container LightFlow.</small>
                  </label>
                  <label className="lf-field">
                    <span>API key (opsional)</span>
                    <input className="lf-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                  </label>
                  <label className="lf-field">
                    <span>Session</span>
                    <input className="lf-input" value={session} onChange={(e) => setSession(e.target.value)} />
                  </label>
                </>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="lf-btn lf-btn--primary">Simpan connector</button>
                <button type="button" className="lf-btn lf-btn--tertiary" onClick={() => setShowForm(false)}>Batal</button>
              </div>
            </form>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="lf-empty">
          <div className="e-ic" style={{ display: "flex", justifyContent: "center", color: "var(--md-sys-color-on-surface-variant)" }}><Cable size={34} aria-hidden /></div>
          <h3>Belum ada connector</h3>
          <p>Hubungkan WhatsApp atau Telegram agar workflow bisa berkirim pesan.</p>
          <button type="button" className="lf-btn lf-btn--primary" onClick={() => setShowForm(true)}>
            <Plus size={15} aria-hidden /> Tambah connector
          </button>
        </div>
      ) : (
        <div className="lf-grid">
          {items.map((c) => {
            const st = testState[c.id];
            const connected = c.is_active === 1;
            return (
              <div key={c.id} className="lf-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
  <h3 style={{ flex: 1, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><ProviderIcon provider={c.type} size={20} />{c.name}</h3>
                  <OverflowMenu
                    items={[
                      { label: connected ? "Nonaktifkan" : "Aktifkan", onClick: () => onToggle(c) },
                      { label: "Hapus", danger: true, onClick: () => onDelete(c) },
                    ]}
                  />
                </div>
                <p className="sub" style={{ margin: "0 0 8px" }}>
                  {c.type === "waha" ? `WAHA · ${(c.config as any).base_url || ""} · session “${(c.config as any).session || "default"}”` : "Telegram Bot"}
                </p>
                <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", margin: "0 0 10px" }}>
                  <span className="lf-dot" style={{ background: connected ? "var(--lf-success)" : "var(--md-sys-color-outline)" }} />
                  {connected ? "Connected" : "Nonaktif"}
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button type="button" className="lf-btn lf-btn--secondary" disabled={testing === c.id} onClick={() => onTest(c)}>
                    {testing === c.id ? "Testing…" : "Test connection"}
                  </button>
                  <button type="button" className="lf-btn lf-btn--tertiary" onClick={() => copy(receiverUrl(c.type, c.id))}>
                    Copy webhook URL
                  </button>
                </div>
                {st && (
                  <p style={{ fontSize: "0.8rem", margin: "0 0 4px", color: st.ok ? "var(--lf-success)" : "var(--lf-error)", display: "flex", alignItems: "center", gap: 6 }}>
                    {st.ok ? <Check size={13} aria-hidden /> : <CircleX size={13} aria-hidden />}{st.msg}
                  </p>
                )}
                <details>
                  <summary style={{ fontSize: "0.78rem", cursor: "pointer", color: "var(--md-sys-color-on-surface-variant)" }}>
                    Detail teknis
                  </summary>
                  <div className="lf-code" style={{ marginTop: 6 }}>{JSON.stringify(c.config)}</div>
                  <div className="lf-code" style={{ marginTop: 6 }}>{receiverUrl(c.type, c.id)}</div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
