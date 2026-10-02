import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CircleX, Clock3, Loader2, ScrollText } from "../components/icons";
import StatusBadge from "../components/StatusBadge";
import { listExecutions, listWorkflows } from "../lib/workflows";
import { executionErrorLine } from "../lib/humanError";
import { formatDateTime } from "../lib/format";

const PAGE_SIZE = 20;
const TRIGGER_ID: Record<string, string> = {
  manual: "Manual",
  webhook: "Webhook",
  schedule: "Jadwal",
  telegram_event: "Telegram",
  waha_event: "WhatsApp",
};

export default function Executions() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [fWorkflow, setFWorkflow] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    listWorkflows().then(setWorkflows).catch(() => {});
  }, []);

  async function load(nextOffset = offset) {
    setLoading(true);
    setError("");
    try {
      const out = await listExecutions({
        workflow_id: fWorkflow || undefined,
        status: fStatus || undefined,
        from: fFrom ? new Date(fFrom).toISOString() : undefined,
        to: fTo ? new Date(fTo).toISOString() : undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setItems(out.executions);
      setTotal(out.total);
      setOffset(nextOffset);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setFWorkflow("");
    setFStatus("");
    setFFrom("");
    setFTo("");
    setOffset(0);
    listExecutions({ limit: PAGE_SIZE, offset: 0 })
      .then((out) => {
        setItems(out.executions);
        setTotal(out.total);
      })
      .catch((e: any) => setError(e?.response?.data?.error || e.message));
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="lf-page">
      <div className="lf-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Executions</h1>
          <p>Riwayat workflow yang pernah dijalankan</p>
        </div>
      </div>

      <div className="lf-filters">
        <label className="lf-field">
          <span>Workflow</span>
          <select className="lf-input" value={fWorkflow} onChange={(e) => setFWorkflow(e.target.value)}>
            <option value="">Semua workflow</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
        <label className="lf-field">
          <span>Status</span>
          <select className="lf-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Semua status</option>
            <option value="success">Berhasil</option>
            <option value="failed">Gagal</option>
            <option value="running">Jalan</option>
          </select>
        </label>
        <label className="lf-field">
          <span>Dari</span>
          <input className="lf-input" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </label>
        <label className="lf-field">
          <span>Sampai</span>
          <input className="lf-input" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </label>
        <button type="button" className="lf-btn lf-btn--primary" onClick={() => load(0)}>Filter</button>
        <button type="button" className="lf-btn lf-btn--tertiary" onClick={reset}>Reset</button>
        <span style={{ fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)" }}>
          {total} hasil · hal {page}/{pages}
        </span>
      </div>

      {error && <div className="lf-error">{error}</div>}
      {loading ? (
        <p style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--md-sys-color-on-surface-variant)" }}>
          <Loader2 size={15} className="lf-spin" aria-hidden /> Memuat…
        </p>
      ) : items.length === 0 ? (
        <div className="lf-empty">
          <div className="e-ic" style={{ display: "flex", justifyContent: "center", color: "var(--md-sys-color-on-surface-variant)" }}>
            <ScrollText size={34} aria-hidden />
          </div>
          <h3>Belum ada runs</h3>
          <p>Jalankan Test dari workflow atau tunggu jadwal berjalan.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((e) => {
              const errLine = e.status === "failed" ? executionErrorLine(e.errorMessage) : "";
              return (
                <Link key={e.id} to={`/executions/${e.id}`} className="lf-row">
                  <span style={{ display: "flex", color: e.status === "success" ? "var(--lf-success)" : e.status === "failed" ? "var(--lf-error)" : "var(--lf-warning)" }}>
                    {e.status === "success" ? <Check size={16} aria-hidden /> : e.status === "failed" ? <CircleX size={16} aria-hidden /> : <Clock3 size={16} aria-hidden />}
                  </span>
                  <span className="grow">
                    <span className="t1">{e.workflowName || "Workflow"}</span>
                    <span className="t2" style={{ display: "block" }}>
                      {TRIGGER_ID[e.triggerType] || e.triggerType}
                      {e.simulated ? " · Tes manual" : ""} · {formatDateTime(e.startedAt)}
                      {errLine ? ` · ${errLine}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={e.status} />
                </Link>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
            <button type="button" className="lf-btn lf-btn--tertiary" disabled={offset === 0} onClick={() => load(offset - PAGE_SIZE)}>
              <ArrowLeft size={14} aria-hidden /> Prev
            </button>
            <button
              type="button"
              className="lf-btn lf-btn--tertiary"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => load(offset + PAGE_SIZE)}
            >
              Next <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
