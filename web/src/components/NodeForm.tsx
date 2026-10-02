import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, CircleAlert, Copy, NodeTypeIcon, X } from "./icons";
import VarInput from "./builder/VarInput";
import { listConnectors } from "../lib/integrations";
import { NODE_LABELS, type DraftNode } from "../lib/workflowDraft";

interface Props {
  node: DraftNode;
  index: number;
  nodes: DraftNode[];
  stepIds: string[];
  onChange: (n: DraftNode) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  /** Mode panel: tanpa kartu & tombol header (panel punya header sendiri). */
  bare?: boolean;
}

export const fieldStyle: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: "0.875rem",
  padding: "8px 12px",
  borderRadius: "var(--md-sys-shape-corner-small)",
  border: "1px solid var(--md-sys-color-outline)",
  background: "var(--md-sys-color-surface)",
  color: "var(--md-sys-color-on-surface)",
  width: "100%",
};

function Field({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)" }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {label} {action}
      </span>
      {children}
    </label>
  );
}

function setCfg(n: DraftNode, patch: Record<string, any>): DraftNode {
  return { ...n, config: { ...n.config, ...patch } };
}

export default function NodeForm(p: Props) {
  const { node: n, nodes } = p;
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [headers, setHeaders] = useState<Array<[string, string]>>(() =>
    Object.entries((n.config.headers || {}) as Record<string, string>)
  );
  const [bodyText, setBodyText] = useState(() =>
    n.config.body === undefined ? "" : typeof n.config.body === "string" ? n.config.body : JSON.stringify(n.config.body, null, 2)
  );
  const [delayVal, setDelayVal] = useState(() => String(Math.round(Number(n.config.delay_ms || 0) / 1000)));
  const [delayUnit, setDelayUnit] = useState<"detik" | "menit" | "jam">("detik");

  useEffect(() => {
    listConnectors().then((c: any[]) => setConnectors(c.map((x) => ({ id: x.id, name: x.name, type: x.type })))).catch(() => {});
  }, []);

  useEffect(() => {
    setHeaders(Object.entries((n.config.headers || {}) as Record<string, string>));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.key]);

  const targets = [...nodes.map((x) => x.id), "step_end"];
  const stepIds = p.stepIds.filter((id) => id !== n.id);

  const set = (patch: Partial<DraftNode>) => p.onChange({ ...n, ...patch });

  if (n.unsupported) {
    return (
      <div className="md3-card md3-card--outlined" style={{ borderColor: "var(--md-sys-color-error)" }}>
        <h4 style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}><CircleAlert size={15} /> {n.id} · tipe `{String(n.type)}` tak didukung form</h4>
        <p className="md3-card__supporting">Node dipertahankan apa adanya. Ubah via tab JSON → Edit Mentah.</p>
        <Field label="Lanjut ke →">
          <NextSelect value={n.next} targets={targets} onPick={(v) => set({ next: v })} />
        </Field>
      </div>
    );
  }

  const meta = NODE_LABELS[n.type] || { label: String(n.type) };

  return (
    <div className={p.bare ? undefined : "md3-card md3-card--outlined"}>
      {!p.bare && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 12 }}>
          <span style={{ display: "flex" }}><NodeTypeIcon type={n.type} size={18} /></span>
          <strong style={{ flex: 1 }}>
            {p.index + 1}. {meta.label}
          </strong>
          <button type="button" className="md3-button md3-button--text" onClick={p.onMoveUp} disabled={p.isFirst} title="Naik" aria-label="Pindah ke atas"><ChevronUp size={15} /></button>
          <button type="button" className="md3-button md3-button--text" onClick={p.onMoveDown} disabled={p.isLast} title="Turun" aria-label="Pindah ke bawah"><ChevronDown size={15} /></button>
          <button type="button" className="md3-button md3-button--text" onClick={p.onDuplicate} title="Duplikat" aria-label="Duplikat langkah"><Copy size={15} /></button>
          <button type="button" className="md3-button md3-button--text" onClick={p.onDelete} title="Hapus" aria-label="Hapus langkah"><X size={15} /></button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: p.bare ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {!p.bare && (
          <Field label="ID langkah">
            <input value={n.id} onChange={(e) => set({ id: e.target.value.replace(/\s+/g, "_") })} style={fieldStyle} />
          </Field>
        )}
        <Field label="Nama langkah">
          <input value={n.name} onChange={(e) => set({ name: e.target.value })} style={fieldStyle} />
        </Field>
      </div>

      {n.type === "send_waha" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label="Konektor WhatsApp">
            <select value={String(n.config.connector_id || "")} onChange={(e) => p.onChange(setCfg(n, { connector_id: e.target.value }))} style={fieldStyle}>
              <option value="">— pilih —</option>
              {connectors.filter((c) => c.type === "waha").map((c) => (
                <option key={c.id} value={`{{connector.${c.name}}}`}>{c.name}</option>
              ))}
              <option value="__custom">Ketik manual…</option>
            </select>
          </Field>
          {(!connectors.some((c) => `{{connector.${c.name}}}` === n.config.connector_id) && n.config.connector_id) || n.config.connector_id === "__custom" ? (
            <Field label="Connector ID manual">
              <input value={n.config.connector_id === "__custom" ? "" : String(n.config.connector_id)} onChange={(e) => p.onChange(setCfg(n, { connector_id: e.target.value }))} style={fieldStyle} placeholder="{{connector.waha_main}} atau id" />
            </Field>
          ) : null}
          <Field label="Nomor tujuan (format 628xx@c.us)">
            <VarInput value={String(n.config.to || "")} onChange={(v) => p.onChange(setCfg(n, { to: v }))} stepIds={stepIds} placeholder="6281541148547@c.us" />
          </Field>
          <Field label="Pesan — ketik {{ untuk variabel">
            <VarInput value={String(n.config.text || "")} onChange={(v) => p.onChange(setCfg(n, { text: v }))} stepIds={stepIds} rows={3} />
          </Field>
        </div>
      )}

      {n.type === "send_waha_media" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label="Konektor WhatsApp">
            <select value={String(n.config.connector_id || "")} onChange={(e) => p.onChange(setCfg(n, { connector_id: e.target.value }))} style={fieldStyle}>
              <option value="">— pilih —</option>
              {connectors.filter((c) => c.type === "waha").map((c) => (
                <option key={c.id} value={`{{connector.${c.name}}}`}>{c.name}</option>
              ))}
              <option value="__custom">Ketik manual…</option>
            </select>
          </Field>
          {(!connectors.some((c) => `{{connector.${c.name}}}` === n.config.connector_id) && n.config.connector_id) || n.config.connector_id === "__custom" ? (
            <Field label="Connector ID manual">
              <input value={n.config.connector_id === "__custom" ? "" : String(n.config.connector_id)} onChange={(e) => p.onChange(setCfg(n, { connector_id: e.target.value }))} style={fieldStyle} placeholder="{{connector.waha_main}} atau id" />
            </Field>
          ) : null}
          <Field label="Nomor tujuan (format 628xx@c.us)">
            <VarInput value={String(n.config.to || "")} onChange={(v) => p.onChange(setCfg(n, { to: v }))} stepIds={stepIds} placeholder="6281541148547@c.us" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
            <Field label="Jenis">
              <select value={String(n.config.media_type || "image")} onChange={(e) => p.onChange(setCfg(n, { media_type: e.target.value }))} style={fieldStyle}>
                <option value="image">Gambar</option>
                <option value="file">File</option>
              </select>
            </Field>
            <Field label="URL media (publik)">
              <VarInput value={String(n.config.media_url || "")} onChange={(v) => p.onChange(setCfg(n, { media_url: v }))} stepIds={stepIds} placeholder="https://..." mono />
            </Field>
          </div>
          <Field label="Caption (opsional)">
            <VarInput value={String(n.config.caption || "")} onChange={(v) => p.onChange(setCfg(n, { caption: v }))} stepIds={stepIds} rows={2} />
          </Field>
        </div>
      )}

      {n.type === "send_telegram" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label="Konektor Telegram">
            <select value={String(n.config.connector_id || "")} onChange={(e) => p.onChange(setCfg(n, { connector_id: e.target.value }))} style={fieldStyle}>
              <option value="">— pilih —</option>
              {connectors.filter((c) => c.type === "telegram").map((c) => (
                <option key={c.id} value={`{{connector.${c.name}}}`}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Chat ID">
            <VarInput value={String(n.config.chat_id || n.config.chatId || "")} onChange={(v) => p.onChange(setCfg(n, { chat_id: v }))} stepIds={stepIds} placeholder="{{trigger.chat_id}}" mono />
          </Field>
          <Field label="Pesan — ketik {{ untuk variabel">
            <VarInput value={String(n.config.text || "")} onChange={(v) => p.onChange(setCfg(n, { text: v }))} stepIds={stepIds} rows={3} />
          </Field>
        </div>
      )}

      {n.type === "condition" && (
        <ConditionBuilder node={n} stepIds={stepIds} onChange={(cfg) => p.onChange({ ...n, config: cfg })} />
      )}

      {n.type === "transform" && (
        <Field label="Kode JS (return object; sandbox, tanpa require/fetch)">
          <textarea value={String(n.config.code || "")} onChange={(e) => p.onChange(setCfg(n, { code: e.target.value }))} rows={4} style={{ ...fieldStyle, fontFamily: "monospace" }} />
        </Field>
      )}

      {n.type === "delay" && (
        <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
          <Field label="Lama tunda">
            <input
              type="number"
              min={0}
              value={delayVal}
              onChange={(e) => {
                setDelayVal(e.target.value);
                const mult = delayUnit === "detik" ? 1000 : delayUnit === "menit" ? 60000 : 3600000;
                p.onChange(setCfg(n, { delay_ms: Math.round(Number(e.target.value || 0) * mult) }));
              }}
              style={fieldStyle}
            />
          </Field>
          <select
            value={delayUnit}
            onChange={(e) => {
              const u = e.target.value as typeof delayUnit;
              setDelayUnit(u);
              const mult = u === "detik" ? 1000 : u === "menit" ? 60000 : 3600000;
              p.onChange(setCfg(n, { delay_ms: Math.round(Number(delayVal || 0) * mult) }));
            }}
            style={{ ...fieldStyle, width: 120 }}
          >
            <option value="detik">detik</option>
            <option value="menit">menit</option>
            <option value="jam">jam</option>
          </select>
          {Number(n.config.delay_ms || 0) > 30000 && (
            <span style={{ fontSize: "0.75rem", color: "var(--md-sys-color-error)" }}>Clamp 30 dtk saat test!</span>
          )}
        </div>
      )}

      {n.type === "log" && (
        <Field label="Pesan log — ketik {{ untuk variabel">
          <VarInput value={String(n.config.message || "")} onChange={(v) => p.onChange(setCfg(n, { message: v }))} stepIds={stepIds} />
        </Field>
      )}

      {n.type === "http_request" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
            <Field label="Method">
              <select value={String(n.config.method || "GET")} onChange={(e) => p.onChange(setCfg(n, { method: e.target.value }))} style={fieldStyle}>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="URL (publik saja — privat diblokir)">
              <VarInput value={String(n.config.url || "")} onChange={(v) => p.onChange(setCfg(n, { url: v }))} stepIds={stepIds} placeholder="https://api.example.com/..." mono />
            </Field>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", marginBottom: 4 }}>Headers</div>
            {headers.map(([k, v], i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <input value={k} onChange={(e) => {
                  const next = [...headers];
                  next[i] = [e.target.value, v];
                  setHeaders(next);
                  p.onChange(setCfg(n, { headers: Object.fromEntries(next.filter(([kk]) => kk)) }));
                }} placeholder="Authorization" style={{ ...fieldStyle, flex: 1 }} />
                <input value={v} onChange={(e) => {
                  const next = [...headers];
                  next[i] = [k, e.target.value];
                  setHeaders(next);
                  p.onChange(setCfg(n, { headers: Object.fromEntries(next.filter(([kk]) => kk)) }));
                }} placeholder="Bearer {{secrets.API_KEY}}" style={{ ...fieldStyle, flex: 2 }} />
                <button type="button" className="md3-button md3-button--text" onClick={() => {
                  const next = headers.filter((_, j) => j !== i);
                  setHeaders(next);
                  p.onChange(setCfg(n, { headers: Object.fromEntries(next) }));
                }} aria-label="Hapus header"><X size={14} /></button>
              </div>
            ))}
            <button type="button" className="md3-button md3-button--text" onClick={() => setHeaders([...headers, ["", ""]])}>
              + Header
            </button>
          </div>
          <Field label="Body (JSON, kosongkan bila GET)">
            <textarea
              value={bodyText}
              onChange={(e) => {
                setBodyText(e.target.value);
                if (!e.target.value.trim()) {
                  const c = { ...n.config };
                  delete c.body;
                  p.onChange({ ...n, config: c });
                  return;
                }
                try {
                  p.onChange(setCfg(n, { body: JSON.parse(e.target.value) }));
                } catch {
                  p.onChange(setCfg(n, { body: e.target.value }));
                }
              }}
              rows={3}
              style={{ ...fieldStyle, fontFamily: "monospace" }}
              placeholder='{"text": "{{trigger.text}}"}'
            />
          </Field>
        </div>
      )}

      <details className="builder-advanced">
        <summary>Alur lanjutan ▾</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <Field label="ID langkah (teknis)">
            <input value={n.id} onChange={(e) => set({ id: e.target.value.replace(/\s+/g, "_") })} style={{ ...fieldStyle, fontFamily: "monospace" }} />
          </Field>
          {n.type === "condition" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Jika benar →">
                <NextSelect value={n.next_true} targets={targets} onPick={(v) => set({ next_true: v })} />
              </Field>
              <Field label="Jika salah →">
                <NextSelect value={n.next_false} targets={targets} onPick={(v) => set({ next_false: v })} />
              </Field>
            </div>
          ) : (
            <Field label="Lanjut ke →">
              <NextSelect value={n.next} targets={targets} onPick={(v) => set({ next: v })} />
            </Field>
          )}
          <Field label="Kalau error → (opsional)">
            <NextSelect value={n.on_error} targets={targets} allowEmpty onPick={(v) => set({ on_error: v || undefined })} />
          </Field>
          <div>
            <div style={{ fontSize: "0.75rem", marginBottom: 4, color: "var(--md-sys-color-on-surface-variant)" }}>
              Cabang tambahan — jalankan SEMUA yang dicentang setelah node ini
            </div>
            {nodes.filter((x) => x.id !== n.id).map((x) => {
              const checked = (n.next_all || []).includes(x.id);
              return (
                <label key={x.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.8rem", padding: "2px 0" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const cur = n.next_all || [];
                      const nextAll = e.target.checked ? [...cur, x.id] : cur.filter((id) => id !== x.id);
                      set({ next_all: nextAll.length > 0 ? nextAll : undefined });
                    }}
                  />
                  {x.id} · {x.name}
                </label>
              );
            })}
            {nodes.length <= 1 && (
              <div style={{ fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)" }}>Belum ada langkah lain.</div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

const CONDITION_OPERATORS: Array<{ id: string; label: string; needValue: boolean }> = [
  { id: "equals", label: "sama dengan", needValue: true },
  { id: "not_equals", label: "tidak sama dengan", needValue: true },
  { id: "contains", label: "mengandung", needValue: true },
  { id: "not_contains", label: "tidak mengandung", needValue: true },
  { id: "starts_with", label: "diawali", needValue: true },
  { id: "ends_with", label: "diakhiri", needValue: true },
  { id: "is_empty", label: "kosong", needValue: false },
  { id: "is_not_empty", label: "tidak kosong", needValue: false },
  { id: "gt", label: "> lebih dari (angka)", needValue: true },
  { id: "gte", label: "≥ (angka)", needValue: true },
  { id: "lt", label: "< kurang dari (angka)", needValue: true },
  { id: "lte", label: "≤ (angka)", needValue: true },
  { id: "is_true", label: "bernilai true", needValue: false },
  { id: "is_false", label: "bernilai false", needValue: false },
  { id: "exists", label: "ada", needValue: false },
  { id: "not_exists", label: "tidak ada", needValue: false },
];

function parseValue(raw: string): unknown {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return raw;
}

function ConditionBuilder({ node: n, stepIds, onChange }: { node: DraftNode; stepIds: string[]; onChange: (config: Record<string, any>) => void }) {
  const hasStruct = Array.isArray(n.config.conditions);
  const [mode, setMode] = useState<"struct" | "expr">(hasStruct ? "struct" : "expr");
  const conditions: Array<{ field: string; operator: string; value?: unknown }> =
    hasStruct ? n.config.conditions : [];

  function setConditions(list: typeof conditions, combinator?: string) {
    onChange({
      ...n.config,
      conditions: list,
      combinator: combinator ?? n.config.combinator ?? "all",
    });
  }

  if (mode === "expr") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Field label="Ekspresi (contoh: {{trigger.count}} > 5)">
          <VarInput value={String(n.config.expression || "")} onChange={(v) => onChange({ ...n.config, expression: v })} stepIds={stepIds} mono />
        </Field>
        <button type="button" className="md3-button md3-button--text" style={{ alignSelf: "flex-start" }}
          onClick={() => { setConditions([{ field: "{{trigger.text}}", operator: "contains", value: "" }]); setMode("struct"); }}>
          Pakai builder terstruktur
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Field label="Kombinasi">
        <select
          value={n.config.combinator === "any" ? "any" : "all"}
          onChange={(e) => setConditions(conditions, e.target.value)}
          style={fieldStyle}
        >
          <option value="all">SEMUA cocok (AND)</option>
          <option value="any">SALAH SATU cocok (OR)</option>
        </select>
      </Field>
      {conditions.map((c, i) => {
        const op = CONDITION_OPERATORS.find((o) => o.id === c.operator) || CONDITION_OPERATORS[0];
        return (
          <div key={i} style={{ border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Kondisi {i + 1}</span>
              <button type="button" className="md3-button md3-button--text" aria-label="Hapus kondisi"
                onClick={() => setConditions(conditions.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
            <Field label="Field (ketik {{ untuk variabel)">
              <VarInput value={String(c.field || "")}
                onChange={(v) => setConditions(conditions.map((x, j) => (j === i ? { ...x, field: v } : x)))}
                stepIds={stepIds} mono />
            </Field>
            <Field label="Operator">
              <select value={c.operator} style={fieldStyle}
                onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))}>
                {CONDITION_OPERATORS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </Field>
            {op.needValue && (
              <Field label="Nilai (true/false/angka otomatis dikenali)">
                <input value={c.value === undefined || c.value === null ? "" : String(c.value)}
                  onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: parseValue(e.target.value) } : x)))}
                  style={fieldStyle} placeholder="halo" />
              </Field>
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="md3-button md3-button--text"
          onClick={() => setConditions([...conditions, { field: "{{trigger.text}}", operator: "contains", value: "" }])}>
          + Kondisi
        </button>
        <button type="button" className="md3-button md3-button--text" onClick={() => setMode("expr")}>
          Mode ekspresi
        </button>
      </div>
    </div>
  );
}

function NextSelect({ value, targets, onPick, allowEmpty }: { value?: string; targets: string[]; onPick: (v: string) => void; allowEmpty?: boolean }) {
  return (
    <select value={value || (allowEmpty ? "" : "step_end")} onChange={(e) => onPick(e.target.value)} style={fieldStyle}>
      {allowEmpty && <option value="">— berhenti (gagal) —</option>}
      {targets.map((t) => (
        <option key={t} value={t}>{t === "step_end" ? "Selesai" : t}</option>
      ))}
    </select>
  );
}
