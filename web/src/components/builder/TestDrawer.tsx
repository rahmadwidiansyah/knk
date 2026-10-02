import { useState } from "react";
import { ArrowRight, Check, CircleX, Clock3, Loader2, X } from "../icons";
import { humanError } from "../../lib/humanError";

const TRIGGER_HINTS: Record<string, string> = {
  manual: "Isi ini jadi {{trigger.*}} apa adanya.",
  webhook: "Isi ini jadi {{trigger.body}}. Header/query disimulasi kosong.",
  schedule: "Isi ini digabung ke data jadwal simulasi.",
  telegram_event: 'Isi ini menimpa pesan simulasi. Contoh: {"text": "halo", "chat_id": "123"}',
  waha_event: 'Isi ini menimpa pesan simulasi. Contoh: {"text": "halo", "chat_id": "62812@c.us"}',
};

interface Props {
  open: boolean;
  testing: boolean;
  testInput: string;
  onInput: (v: string) => void;
  onRun: () => void;
  onClose: () => void;
  result: { execution: any; steps: any[] } | null;
  error: string | null;
  rawError?: any;
  onOpenDetail: (id: string) => void;
  triggerType?: string;
}

export default function TestDrawer(p: Props) {
  const [showTech, setShowTech] = useState(false);
  if (!p.open) return null;

  const friendly = p.error ? humanError(p.rawError || new Error(p.error)) : null;

  return (
    <>
      <div className="test-drawer-backdrop" onClick={p.onClose} />
      <div className="test-drawer" role="dialog" aria-label="Test workflow">
        <h3>
          Test Run
          <button type="button" className="builder-btn builder-btn--text" onClick={p.onClose} aria-label="Tutup"><X size={16} /></button>
        </h3>
        <div className="md3-text-field" style={{ marginBottom: 12 }}>
          <label>Input pemicu (JSON)</label>
          {p.triggerType && TRIGGER_HINTS[p.triggerType] && (
            <p style={{ fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 6px" }}>
              {TRIGGER_HINTS[p.triggerType]}
            </p>
          )}
          <textarea
            value={p.testInput}
            onChange={(e) => p.onInput(e.target.value)}
            rows={3}
            style={{
              fontFamily: "monospace",
              fontSize: "0.8rem",
              padding: "10px 12px",
              borderRadius: "var(--md-sys-shape-corner-small)",
              border: "1px solid var(--md-sys-color-outline)",
              background: "var(--md-sys-color-surface)",
              color: "var(--md-sys-color-on-surface)",
            }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <button type="button" className="builder-btn builder-btn--filled" onClick={p.onRun} disabled={p.testing}>
            {p.testing ? <><Loader2 size={14} className="lf-spin" aria-hidden /> Menjalankan…</> : "Jalankan Test"}
          </button>
        </div>

        <div style={{ overflowY: "auto" }}>
          {p.testing && <p style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={14} className="lf-spin" aria-hidden /> Menjalankan langkah…</p>}
          {friendly && (
            <div>
              <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: "4px 0", display: "flex", alignItems: "center", gap: 6 }}><CircleX size={16} aria-hidden /> {friendly.title}</p>
              <p style={{ fontSize: "0.85rem", color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 4px" }}>
                {friendly.hint}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="builder-btn builder-btn--tonal" onClick={p.onRun}>Coba lagi</button>
                <button type="button" className="builder-btn builder-btn--text" onClick={() => setShowTech((s) => !s)}>
                  {showTech ? "Sembunyikan" : "Lihat detail teknis"}
                </button>
              </div>
              {showTech && (
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.72rem", background: "var(--md-sys-color-surface-container-high)", padding: 10, borderRadius: 8, marginTop: 8 }}>
                  {friendly.technical}
                </pre>
              )}
            </div>
          )}
          {p.result && <ResultList result={p.result} onOpenDetail={p.onOpenDetail} />}
        </div>
      </div>
    </>
  );
}

function ResultList({ result, onOpenDetail }: { result: { execution: any; steps: any[] }; onOpenDetail: (id: string) => void }) {
  const ex = result.execution;
  const ok = ex.status === "success";
  return (
    <div>
      <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>
        {ok ? <><Check size={14} aria-hidden /> Berhasil</> : <><CircleX size={14} aria-hidden /> Gagal</>}
        <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "var(--md-sys-color-on-surface-variant)" }}>
          {" "}· {(ex.finished_at ?? ex.finishedAt) ? "" : ""}
          {result.steps.length} langkah
        </span>
      </p>
      {result.steps.map((s: any, i: number) => {
        const name = s.node_name ?? s.nodeName ?? s.node_id ?? s.nodeId;
        const st = s.status;
        const err = s.error_message ?? s.errorMessage;
        const out = s.output_data ?? s.outputData;
        return (
          <div key={s.id} className="test-step">
            <span className="test-ic" style={{ display: "flex" }}>{st === "success" ? <Check size={15} aria-hidden /> : st === "failed" ? <CircleX size={15} aria-hidden /> : <Clock3 size={15} aria-hidden />}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tt">{i + 1}. {name}</div>
              <div className="ts">{st === "success" ? summaryOf(out) : err || st}</div>
              {err && (
                <details className="test-tech">
                  <summary>Lihat detail teknis</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre>
                </details>
              )}
            </div>
          </div>
        );
      })}
      <button type="button" className="builder-btn builder-btn--text" onClick={() => onOpenDetail(ex.id)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Buka detail lengkap <ArrowRight size={14} aria-hidden />
      </button>
    </div>
  );
}

function summaryOf(out: any): string {
  try {
    const o = typeof out === "string" ? JSON.parse(out) : out;
    if (o?.message) return String(o.message).slice(0, 80);
    if (o?.conditionMet !== undefined) return o.conditionMet ? "cocok" : "tidak cocok";
    if (o?.sent) return "terkirim";
    if (o?.status) return `HTTP ${o.status}`;
    if (o?.delayed_ms !== undefined) return `tunggu ${o.delayed_ms}ms`;
    return "selesai";
  } catch {
    return "selesai";
  }
}
