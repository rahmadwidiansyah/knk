import { useEffect, useState } from "react";
import { deleteSecret, listSecrets, upsertSecret } from "../lib/integrations";
import { timeAgo } from "../lib/format";
import { KeyRound, Plus } from "../components/icons";
import OverflowMenu from "../components/OverflowMenu";

export default function Secrets() {
  const [items, setItems] = useState<Array<{ id: string; key: string; created_at: string }>>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  async function load() {
    try {
      setItems(await listSecrets());
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await upsertSecret(key.trim().toUpperCase(), value);
      setKey("");
      setValue("");
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message);
    }
  }

  async function onDelete(id: string, k: string) {
    if (!confirm(`Hapus secret '${k}'? Workflow yang memakainya akan gagal.`)) return;
    try {
      await deleteSecret(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  }

  return (
    <div className="lf-page">
      <div className="lf-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Secrets</h1>
          <p>API key & credential sensitif untuk workflow</p>
        </div>
        <div className="spacer" />
        <button type="button" className="lf-btn lf-btn--primary" onClick={() => setShowForm((s) => !s)}>
          <Plus size={15} aria-hidden /> Tambah secret
        </button>
      </div>
      {error && <div className="lf-error">{error}</div>}

      {showForm && (
        <form className="lf-card" onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 460 }}>
          <h3>Secret baru</h3>
          <label className="lf-field">
            <span>Nama</span>
            <input className="lf-input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="GEMINI_API_KEY" required style={{ fontFamily: "monospace" }} />
          </label>
          <label className="lf-field">
            <span>Nilai</span>
            <input className="lf-input" type="password" value={value} onChange={(e) => setValue(e.target.value)} required />
            <small>Tidak dapat dilihat kembali setelah disimpan.</small>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="lf-btn lf-btn--primary">Simpan secret</button>
            <button type="button" className="lf-btn lf-btn--tertiary" onClick={() => setShowForm(false)}>Batal</button>
          </div>
        </form>
      )}

      {items.length === 0 && !showForm ? (
        <div className="lf-empty">
          <div className="e-ic" style={{ display: "flex", justifyContent: "center", color: "var(--md-sys-color-on-surface-variant)" }}><KeyRound size={34} aria-hidden /></div>
          <h3>Belum ada secret</h3>
          <p>Simpan API key di sini, pakai sebagai {"{{secrets.NAMA}}"} di workflow.</p>
          <button type="button" className="lf-btn lf-btn--primary" onClick={() => setShowForm(true)}>
            <Plus size={15} aria-hidden /> Tambah secret
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((s) => (
            <div key={s.id} className="lf-row">
              <span style={{ display: "flex", color: "var(--md-sys-color-on-surface-variant)" }}><KeyRound size={17} aria-hidden /></span>
              <span className="grow">
                <span className="t1" style={{ fontFamily: "monospace" }}>{s.key}</span>
                <span className="t2" style={{ display: "block" }}>
                  {"{{secrets."}{s.key}{"}}"} · diperbarui {timeAgo(s.created_at)}
                </span>
              </span>
              <span className="lf-status lf-status--ok"><span className="lf-dot" />Aktif</span>
              <OverflowMenu items={[{ label: "Hapus", danger: true, onClick: () => onDelete(s.id, s.key) }]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
