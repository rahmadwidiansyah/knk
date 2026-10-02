import { useState } from "react";
import { ArrowLeft, Loader2, Menu, Pause, Play } from "../icons";

export type SaveState = "saved" | "dirty" | "saving";

interface Props {
  name: string;
  description: string;
  isActive: boolean;
  saveState: SaveState;
  testing: boolean;
  saving: boolean;
  showJson: boolean;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  onBack: () => void;
  onTest: () => void;
  onSave: () => void;
  onToggle: () => void;
  onToggleJson: () => void;
  onOpenLibrary: () => void;
}

export default function WorkflowHeader(p: Props) {
  const [editName, setEditName] = useState(false);
  const [editDesc, setEditDesc] = useState(false);

  return (
    <div className="builder-header">
      <button type="button" className="builder-back" onClick={p.onBack} aria-label="Kembali" style={{ display: "flex" }}><ArrowLeft size={18} aria-hidden /></button>
      <button type="button" className="builder-btn builder-btn--text builder-lib-toggle" onClick={p.onOpenLibrary} aria-label="Buka library">
        <Menu size={18} aria-hidden />
      </button>
      <div className="builder-title">
        {editName ? (
          <input
            autoFocus
            className="builder-name-input"
            value={p.name}
            onChange={(e) => p.onName(e.target.value)}
            onBlur={() => setEditName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditName(false)}
          />
        ) : (
          <p className="builder-name" onClick={() => setEditName(true)} title="Klik untuk ubah nama">
            {p.name || "(tanpa nama)"}
          </p>
        )}
        {editDesc ? (
          <input
            autoFocus
            className="builder-name-input"
            style={{ fontWeight: 400, fontSize: "0.8rem" }}
            value={p.description}
            onChange={(e) => p.onDescription(e.target.value)}
            onBlur={() => setEditDesc(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditDesc(false)}
            placeholder="Deskripsi…"
          />
        ) : (
          <div className="builder-sub" onClick={() => setEditDesc(true)} title="Klik untuk ubah deskripsi">
            {p.description || "Tambah deskripsi…"} · <span className="lf-dot" style={{ display: "inline-block", background: p.isActive ? "var(--lf-success)" : "var(--md-sys-color-outline)" }} /> {p.isActive ? "Aktif" : "Nonaktif"}
          </div>
        )}
      </div>
      <div className={`builder-save-dot ${p.saveState === "dirty" ? "dirty" : p.saveState === "saving" ? "saving" : "saved"}`}>
        <span className="dot" />
        <span className="txt">{p.saveState === "dirty" ? "Belum disimpan" : p.saveState === "saving" ? "Menyimpan…" : "Tersimpan"}</span>
      </div>
      <button type="button" className="builder-btn builder-btn--text" onClick={p.onToggleJson} title="Lihat/edit JSON">
        {"{ }"}
      </button>
      <button type="button" className="builder-btn builder-btn--tonal" onClick={p.onTest} disabled={p.testing}>
        {p.testing ? <Loader2 size={14} className="lf-spin" aria-hidden /> : "Test"}
      </button>
      <button type="button" className="builder-btn builder-btn--filled" onClick={p.onSave} disabled={p.saving}>
        {p.saving ? <Loader2 size={14} className="lf-spin" aria-hidden /> : "Save"}
      </button>
      <button
        type="button"
        className={`builder-btn ${p.isActive ? "builder-btn--tonal" : "builder-btn--filled"}`}
        onClick={p.onToggle}
        title={p.isActive ? "Nonaktifkan" : "Aktifkan & jalankan"}
        aria-label={p.isActive ? "Nonaktifkan workflow" : "Aktifkan workflow"}
      >
        {p.isActive ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
      </button>
    </div>
  );
}
