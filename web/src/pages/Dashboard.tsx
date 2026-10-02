import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { listExecutions, listWorkflows, type WorkflowListItem } from "../lib/workflows";
import { timeAgo } from "../lib/format";
import { triggerLine } from "../lib/workflowMeta";
import { Check, CircleX, Clock3, ScrollText } from "../components/icons";
import StatusBadge from "../components/StatusBadge";

interface ServerStats {
  users: number;
  workflows: number;
  workflows_active: number;
  executions: number;
  executions_24h: number;
  success_rate_24h: number | null;
}

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      listWorkflows().catch(() => [] as WorkflowListItem[]),
      listExecutions({ limit: 5 }).catch(() => ({ executions: [], total: 0 })),
      api.get("/api/stats").then((r) => r.data as ServerStats).catch(() => null),
      api.get("/health").then(() => true).catch(() => false),
    ])
      .then(([wf, ex, st, ok]) => {
        setWorkflows(wf);
        setRecent(ex.executions || []);
        setStats(st);
        setBackendOk(ok);
      })
      .catch((e: any) => setError(e?.response?.data?.error || e.message));
  }, []);

  const active = workflows.filter((w) => w.is_active === 1);

  return (
    <div className="lf-page">
      <div className="lf-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Dashboard</h1>
          <p>Ringkasan otomatisasi kamu</p>
        </div>
      </div>
      {error && <div className="lf-error">{error}</div>}

      <div className="lf-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        <div className="lf-card lf-metric">
          <div className="v">{stats ? stats.workflows : workflows.length}</div>
          <div className="l">Workflows · {stats ? stats.workflows_active : active.length} aktif</div>
        </div>
        <div className="lf-card lf-metric">
          <div className="v">{stats ? stats.executions : "—"}</div>
          <div className="l">Total runs{stats ? ` · ${stats.executions_24h} / 24 jam` : ""}</div>
        </div>
        <div className="lf-card lf-metric">
          <div className="v">{!stats || stats.success_rate_24h === null ? "—" : `${stats.success_rate_24h}%`}</div>
          <div className="l">Success rate (24 jam)</div>
        </div>
      </div>

      <section>
        <h2 className="lf-section-title">Aktivitas terbaru</h2>
        {recent.length === 0 ? (
          <p style={{ fontSize: "0.83rem", color: "var(--md-sys-color-on-surface-variant)" }}>
            Belum ada runs. Aktifkan workflow atau jalankan Test.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map((e: any) => (
              <Link key={e.id} to={`/executions/${e.id}`} className="lf-row">
                <span style={{ display: "flex", color: e.status === "success" ? "var(--lf-success)" : e.status === "failed" ? "var(--lf-error)" : "var(--lf-warning)" }}>{e.status === "success" ? <Check size={16} aria-hidden /> : e.status === "failed" ? <CircleX size={16} aria-hidden /> : <Clock3 size={16} aria-hidden />}</span>
                <span className="grow">
                  <span className="t1">{e.workflowName || "Workflow"}</span>
                  <span className="t2" style={{ display: "block" }}>{timeAgo(e.startedAt)}</span>
                </span>
                <StatusBadge status={e.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="lf-section-title">Workflows aktif</h2>
        {active.length === 0 ? (
          <p style={{ fontSize: "0.83rem", color: "var(--md-sys-color-on-surface-variant)" }}>
            Belum ada yang aktif. Buka Flows untuk mengaktifkan.
          </p>
        ) : (
          <div className="lf-grid">
            {active.slice(0, 4).map((w) => (
              <Link key={w.id} to={`/workflows/${w.id}`} className="lf-row" style={{ alignItems: "flex-start" }}>
                <span className="grow">
                  <span className="t1">{w.name}</span>
                  <span className="t2" style={{ display: "block" }}>{triggerLine(w.json_config)}</span>
                </span>
                <span className="lf-dot" style={{ background: "var(--lf-success)", marginTop: 6 }} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <p style={{ fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)", display: "flex", alignItems: "center", gap: 6 }}>
        <span className="lf-dot" style={{ background: backendOk ? "var(--lf-success)" : backendOk === false ? "var(--lf-error)" : "var(--lf-warning)" }} />
        {backendOk === null ? "Memeriksa backend…" : backendOk ? "Backend operational" : "Backend tidak terjangkau"}
      </p>
    </div>
  );
}
