import { useEffect, useState } from "react";
import { Copy, NodeTypeIcon, Play, Power, Trash2, X, Zap } from "../icons";
import NodeForm from "../NodeForm";
import TriggerForm from "../TriggerForm";
import { NODE_LABELS, type Draft, type DraftNode } from "../../lib/workflowDraft";
import { getExecution, listExecutions, testNode } from "../../lib/workflows";

export type Selection = { kind: "trigger" } | { kind: "node"; key: string } | null;

interface Props {
  open: boolean;
  selection: Selection;
  draft: Draft;
  workflowId?: string;
  webhookUrl?: string | null;
  scheduled?: boolean;
  copied?: boolean;
  onCopyWebhook?: () => void;
  onRegenerateWebhook?: () => void;
  onClose: () => void;
  onDraft: (d: Draft) => void;
  onDeleteNode: (key: string) => void;
  onDuplicateNode: (key: string) => void;
  onToggleDisabled: (key: string) => void;
}

export default function ConfigPanel(p: Props) {
  const { draft, selection } = p;

  const node: DraftNode | undefined =
    selection?.kind === "node" ? draft.nodes.find((x) => x.key === selection.key) : undefined;
  const index = node ? draft.nodes.findIndex((x) => x.key === node.key) : -1;

  function updateNode(nn: DraftNode) {
    p.onDraft({ ...draft, nodes: draft.nodes.map((x) => (x.key === nn.key ? { ...nn, key: nn.key } : x)) });
  }

  return (
    <aside className={`builder-config${p.open ? " open" : ""}`}>
      {!selection && (
        <>
          <h3>Detail</h3>
          <p className="cfg-sub">Klik trigger atau langkah di canvas untuk mengatur.</p>
        </>
      )}
      {selection?.kind === "trigger" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h3 style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}><Zap size={16} aria-hidden /> Pemicu</h3>
            <button type="button" className="builder-btn builder-btn--text builder-config-close" onClick={p.onClose} aria-label="Tutup panel"><X size={16} /></button>
          </div>
          <p className="cfg-sub">Kapan workflow berjalan.</p>
          <TriggerForm
            trigger={draft.trigger}
            onChange={(t) => p.onDraft({ ...draft, trigger: t })}
            webhookUrl={p.webhookUrl}
            scheduled={p.scheduled}
            onCopyWebhook={p.onCopyWebhook}
            onRegenerateWebhook={p.onRegenerateWebhook}
            copied={p.copied}
          />
        </>
      )}
      {node && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h3 style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <NodeTypeIcon type={node.type} size={16} /> {NODE_LABELS[node.type]?.label || node.type}
            </h3>
            <button type="button" className="builder-btn builder-btn--text" title={node.disabled ? "Aktifkan" : "Nonaktifkan"} aria-label={node.disabled ? "Aktifkan langkah" : "Nonaktifkan langkah"} onClick={() => p.onToggleDisabled(node.key)}><Power size={15} /></button>
            <button type="button" className="builder-btn builder-btn--text" title="Duplikat" aria-label="Duplikat langkah" onClick={() => p.onDuplicateNode(node.key)}><Copy size={15} /></button>
            <button type="button" className="builder-btn builder-btn--text" title="Hapus" aria-label="Hapus langkah" onClick={() => p.onDeleteNode(node.key)}><Trash2 size={15} /></button>
            <button type="button" className="builder-btn builder-btn--text builder-config-close" onClick={p.onClose} aria-label="Tutup panel"><X size={16} /></button>
          </div>
          <p className="cfg-sub">Atur langkah ini. Ringkasan muncul di canvas.</p>
          {node.disabled && (
            <p style={{ fontSize: "0.78rem", color: "var(--md-sys-color-on-surface-variant)" }}>
              Langkah nonaktif — dilewati executor (tercatat skipped).
            </p>
          )}
          <NodeTest workflowId={p.workflowId} node={node} />
          <LastData workflowId={p.workflowId} nodeId={node.id} />
          <NodeForm
            bare
            node={node}
            index={index}
            nodes={draft.nodes}
            stepIds={draft.nodes.map((x) => x.id)}
            onChange={updateNode}
            onDelete={() => p.onDeleteNode(node.key)}
            onDuplicate={() => p.onDuplicateNode(node.key)}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            isFirst
            isLast
          />
        </>
      )}
    </aside>
  );
}

function NodeTest({ workflowId, node }: { workflowId?: string; node: DraftNode }) {
  const [st, setSt] = useState<{ loading?: boolean; output?: any; error?: string }>({});
  if (!workflowId) return null;
  return (
    <div style={{ margin: "8px 0" }}>
      <button
        type="button"
        className="md3-button md3-button--tonal"
        disabled={st.loading}
        onClick={async () => {
          setSt({ loading: true });
          try {
            const out = await testNode(workflowId, node.id, {});
            setSt({ output: out.output });
          } catch (e: any) {
            setSt({ error: e?.response?.data?.error || e.message });
          }
        }}
      >
        <Play size={14} aria-hidden /> {st.loading ? "Menjalankan…" : "Uji node ini"}
      </button>
      <div style={{ fontSize: "0.72rem", color: "var(--md-sys-color-on-surface-variant)", marginTop: 4 }}>
        Node aksi dikirim asli (mis. pesan terkirim). Uji aman untuk log/condition/transform.
      </div>
      {st.error && <div className="md3-error" style={{ marginTop: 6 }}>✕ {st.error}</div>}
      {st.output !== undefined && (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.72rem", background: "var(--md-sys-color-surface-container-low)", padding: 8, borderRadius: 8, marginTop: 6, maxHeight: 200, overflow: "auto" }}>
          {JSON.stringify(st.output, null, 2).slice(0, 2000)}
        </pre>
      )}
    </div>
  );
}

function leafPaths(v: unknown, prefix: string, out: Array<{ path: string; sample: string }>, depth = 0): void {
  if (depth > 4 || out.length > 60) return;
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v);
    if (entries.length === 0) {
      out.push({ path: prefix, sample: "{}" });
      return;
    }
    for (const [k, val] of entries.slice(0, 20)) {
      leafPaths(val, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    }
    return;
  }
  out.push({
    path: prefix,
    sample: typeof v === "string" ? `“${String(v).slice(0, 40)}”` : String(v),
  });
}

function copyText(t: string) {
  navigator.clipboard?.writeText(t).catch(() => {});
}

function LastData({ workflowId, nodeId }: { workflowId?: string; nodeId: string }) {
  const [data, setData] = useState<{ trigger: any; steps: Array<{ nodeId: string; output: any }> } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!workflowId || !open || data) return;
    (async () => {
      try {
        const list = await listExecutions({ workflow_id: workflowId, limit: 1 });
        if (!list.executions[0]) {
          setData({ trigger: null, steps: [] });
          return;
        }
        const full = await getExecution(list.executions[0].id);
        const ex = full.execution;
        const trig = JSON.parse(ex.inputData || ex.input_data || "{}");
        setData({
          trigger: trig,
          steps: (full.steps || []).map((s: any) => ({
            nodeId: s.node_id ?? s.nodeId,
            output: JSON.parse(s.output_data ?? s.outputData ?? "null"),
          })),
        });
      } catch {
        setData({ trigger: null, steps: [] });
      }
    })();
  }, [workflowId, open]);
  if (!workflowId) return null;
  const paths: Array<{ path: string; sample: string }> = [];
  if (data?.trigger) leafPaths(data.trigger, "trigger", paths);
  const stepOut = data?.steps.find((s) => s.nodeId === nodeId)?.output;
  return (
    <details style={{ margin: "8px 0" }} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary style={{ cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}>Data terakhir (klik untuk salin path)</summary>
      {!data ? (
        <p style={{ fontSize: "0.75rem" }}>Memuat…</p>
      ) : !data.trigger && data.steps.length === 0 ? (
        <p style={{ fontSize: "0.75rem" }}>Belum ada execution. Jalankan Test dulu.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {paths.slice(0, 40).map(({ path, sample }) => {
            const ref = `{{${path}}}`;
            return (
              <button
                key={ref}
                type="button"
                onClick={() => copyText(ref)}
                title="Klik untuk salin"
                style={{
                  textAlign: "left", fontFamily: "monospace", fontSize: "0.72rem",
                  background: "transparent", border: "1px solid var(--md-sys-color-outline-variant)",
                  borderRadius: 6, padding: "4px 8px", cursor: "copy", color: "var(--md-sys-color-on-surface)",
                }}
              >
                {ref} <span style={{ color: "var(--md-sys-color-on-surface-variant)" }}>{sample}</span>
              </button>
            );
          })}
          {stepOut !== undefined && stepOut !== null && (
            <div style={{ fontSize: "0.72rem" }}>
              <div style={{ fontWeight: 600, margin: "4px 0" }}>Output node ini:</div>
              <pre style={{ whiteSpace: "pre-wrap", background: "var(--md-sys-color-surface-container-low)", padding: 8, borderRadius: 8, maxHeight: 180, overflow: "auto" }}>
                {JSON.stringify(stepOut, null, 2).slice(0, 1500)}
              </pre>
            </div>
          )}
        </div>
      )}
    </details>
  );
}
