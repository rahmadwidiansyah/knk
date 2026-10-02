import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createWorkflow,
  deleteWorkflow,
  listExecutions,
  listWorkflows,
  toggleWorkflow,
  type WorkflowListItem,
} from "../lib/workflows";
import { TEMPLATES } from "../lib/templates";
import { flowLine, triggerLine } from "../lib/workflowMeta";
import { timeAgo } from "../lib/format";
import { Clock, History, Loader2, Plus, TemplateIcon, WorkflowIcon, Workflow as WorkflowMetaIcon } from "../components/icons";
import OverflowMenu from "../components/OverflowMenu";

export default function Workflows() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WorkflowListItem[]>([]);
  const [lastRun, setLastRun] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [wf, ex] = await Promise.all([
        listWorkflows(),
        listExecutions({ limit: 200 }).catch(() => ({ executions: [] })),
      ]);
      setItems(wf);
      const map: Record<string, string> = {};
      for (const e of (ex as any).executions || []) {
        if (!map[e.workflowId]) map[e.workflowId] = e.startedAt;
      }
      setLastRun(map);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createFrom(json: any) {
    setError("");
    setCreating(true);
    try {
      const out = await createWorkflow({ name: json.name, description: json.description, json_config: json });
      navigate(`/workflows/${out.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
      setCreating(false);
    }
  }

  function createBlank() {
    createFrom({
      name: `Workflow ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      description: "",
      trigger: { type: "manual", config: {} },
      nodes: [{ id: "step_1", type: "log", name: "Langkah pertama", config: { message: "Mulai" }, next: "step_end" }],
    });
  }

  async function onToggle(w: WorkflowListItem) {
    try {
      const updated = await toggleWorkflow(w.id, w.is_active !== 1);
      setItems((prev) => prev.map((x) => (x.id === w.id ? updated : x)));
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  }

  async function onDelete(w: WorkflowListItem) {
    if (!confirm(`Hapus '${w.name}'?`)) return;
    try {
      await deleteWorkflow(w.id);
      setItems((prev) => prev.filter((x) => x.id !== w.id));
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  }

  return (
    <div className="lf-page">
      <div className="lf-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Workflows</h1>
          <p>Automations yang sedang berjalan</p>
        </div>
        <div className="spacer" />
        <button type="button" className="lf-btn lf-btn--primary" disabled={creating} onClick={() => setShowTemplates((s) => !s)}>
          <Plus size={15} aria-hidden /> Buat workflow
        </button>
      </div>
      {error && <div className="lf-error">{error}</div>}

      {showTemplates && (
        <div className="lf-card">
          <h3>Mulai dari…</h3>
          <p className="sub">Pilih template atau mulai kosong, lalu susun di canvas.</p>
          <div className="lf-grid">
            <button type="button" className="lf-row" style={{ cursor: "pointer", width: "100%", textAlign: "left" }} onClick={createBlank} disabled={creating}>
              <span style={{ display: "flex" }}><WorkflowMetaIcon size={19} aria-hidden /></span>
              <span className="grow">
                <span className="t1">Mulai kosong</span>
                <span className="t2" style={{ display: "block" }}>Trigger manual + 1 langkah</span>
              </span>
            </button>
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="lf-row" style={{ cursor: "pointer", width: "100%", textAlign: "left" }} onClick={() => createFrom(t.make())} disabled={creating}>
                <span style={{ display: "flex" }}><TemplateIcon icon={t.icon} size={19} /></span>
                <span className="grow">
                  <span className="t1">{t.title}</span>
                  <span className="t2" style={{ display: "block" }}>{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--md-sys-color-on-surface-variant)" }}><Loader2 size={15} className="lf-spin" aria-hidden /> Memuat…</p>
      ) : items.length === 0 && !showTemplates ? (
        <div className="lf-empty">
          <div className="e-ic" style={{ display: "flex", justifyContent: "center", color: "var(--md-sys-color-on-surface-variant)" }}><WorkflowIcon size={34} aria-hidden /></div>
          <h3>Belum ada workflow</h3>
          <p>Mulai dengan membuat automation pertamamu.</p>
          <button type="button" className="lf-btn lf-btn--primary" onClick={() => setShowTemplates(true)}>
            <Plus size={15} aria-hidden /> Buat workflow
          </button>
        </div>
      ) : (
        <div className="lf-grid">
          {items.map((w) => {
            const meta = flowLine(w.json_config);
            return (
              <div key={w.id} className="lf-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span className="lf-dot" style={{ background: w.is_active === 1 ? "var(--lf-success)" : "var(--md-sys-color-outline)" }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)" }}>
                    {w.is_active === 1 ? "Aktif" : "Nonaktif"}
                  </span>
                  <span style={{ flex: 1 }} />
                  <OverflowMenu
                    items={[
                      { label: "Buka", onClick: () => navigate(`/workflows/${w.id}`) },
                      { label: w.is_active === 1 ? "Nonaktifkan" : "Aktifkan", onClick: () => onToggle(w) },
                      { label: "Hapus", danger: true, onClick: () => onDelete(w) },
                    ]}
                  />
                </div>
                <h3 style={{ cursor: "pointer" }} onClick={() => navigate(`/workflows/${w.id}`)}>{w.name}</h3>
                {w.description && <p className="sub">{w.description}</p>}
                <p style={{ fontSize: "0.8rem", margin: "8px 0 2px", display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} aria-hidden /> {triggerLine(w.json_config)}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                  <WorkflowIcon size={14} aria-hidden /> {meta.flow} · {meta.steps} langkah
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <History size={14} aria-hidden /> {lastRun[w.id] ? `Terakhir jalan ${timeAgo(lastRun[w.id])}` : "Belum pernah jalan"}
                </p>
                <button type="button" className="lf-btn lf-btn--secondary" onClick={() => navigate(`/workflows/${w.id}`)}>
                  Buka
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
