import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, CircleX, Clock3 } from "../components/icons";
import StatusBadge from "../components/StatusBadge";
import { getExecution } from "../lib/workflows";
import { cleanExecutionError, humanError } from "../lib/humanError";
import { durationMs, formatDateTime } from "../lib/format";

export default function ExecutionDetail() {
  const { id } = useParams();
  const [data, setData] = useState<{ execution: any; steps: any[] } | null>(null);
  const [error, setError] = useState("");
  const [showTech, setShowTech] = useState(false);

  useEffect(() => {
    if (!id) return;
    getExecution(id)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || e.message));
  }, [id]);

  if (error) return <div className="lf-error">{error}</div>;
  if (!data) return <p style={{ color: "var(--md-sys-color-on-surface-variant)" }}>Memuat…</p>;

  const ex = data.execution;
  const isTest = (() => {
    try {
      return (JSON.parse(ex.input_data ?? ex.inputData ?? "null") as any)?.simulated === true;
    } catch {
      return false;
    }
  })();
  const started = ex.started_at ?? ex.startedAt;
  const finished = ex.finished_at ?? ex.finishedAt;
  const errMsg = cleanExecutionError(ex.error_message ?? ex.errorMessage);
  const friendly = errMsg ? humanError({ response: { data: { error: errMsg } } }) : null;
  const showFriendly = friendly && friendly.title !== "Terjadi kesalahan";

  return (
    <div className="lf-page">
      <Link to="/executions" style={{ color: "var(--md-sys-color-primary)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowLeft size={14} aria-hidden /> Kembali
      </Link>
      <div className="lf-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Execution</h1>
          <p>{ex.workflow_id ?? ex.workflowId}</p>
        </div>
        <div className="spacer" />
        <StatusBadge status={ex.status} />
      </div>

      <div className="lf-card" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--md-sys-color-on-surface-variant)" }}>Mulai</div>
          <div style={{ fontSize: "0.88rem" }}>{formatDateTime(started)}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--md-sys-color-on-surface-variant)" }}>Durasi</div>
          <div style={{ fontSize: "0.88rem" }}>{durationMs(started, finished)}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--md-sys-color-on-surface-variant)" }}>Pemicu</div>
          <div style={{ fontSize: "0.88rem" }}>
            {ex.trigger_type ?? ex.triggerType}
            {isTest ? " · Tes manual" : ""}
          </div>
        </div>
      </div>

      {errMsg && (
        <div className="lf-card" style={{ borderColor: "var(--md-sys-color-error)" }}>
          <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
            <CircleX size={15} aria-hidden /> {showFriendly ? friendly.title : "Gagal"}
          </p>
          <p style={{ fontSize: "0.83rem", color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 8px" }}>
            {showFriendly ? friendly.hint : errMsg}
          </p>
          <button type="button" className="lf-btn lf-btn--tertiary" onClick={() => setShowTech((s) => !s)}>
            {showTech ? "Sembunyikan detail teknis" : "Lihat detail teknis"}
          </button>
          {showTech && (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.72rem", background: "var(--md-sys-color-surface-container-high)", padding: 10, borderRadius: 8, marginTop: 8 }}>
              {showFriendly ? friendly.technical : errMsg}
            </pre>
          )}
        </div>
      )}

      <h2 className="lf-section-title">Timeline</h2>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {data.steps.map((s: any, i: number) => {
          const name = s.node_name ?? s.nodeName ?? s.node_id ?? s.nodeId;
          const st = s.status;
          const sErr = cleanExecutionError(s.error_message ?? s.errorMessage);
          const last = i === data.steps.length - 1;
          return (
            <div key={s.id} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: st === "success" ? "var(--lf-success)" : st === "failed" ? "var(--lf-error)" : "var(--lf-warning)",
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                {!last && <div style={{ width: 2, flex: 1, minHeight: 14, background: "var(--md-sys-color-outline-variant)" }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 14 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "0.86rem" }}>{i + 1}. {name}</strong>
                  <span style={{ fontSize: "0.72rem", color: "var(--md-sys-color-on-surface-variant)" }}>
                    {formatDateTime(s.started_at ?? s.startedAt)} · {durationMs(s.started_at ?? s.startedAt, s.finished_at ?? s.finishedAt)}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", marginTop: 2, color: st === "failed" ? "var(--lf-error)" : "var(--md-sys-color-on-surface-variant)", display: "flex", alignItems: "center", gap: 5 }}>
                  {st === "success" ? <Check size={13} aria-hidden /> : st === "failed" ? <CircleX size={13} aria-hidden /> : <Clock3 size={13} aria-hidden />}
                  {st === "success" ? "Selesai" : st === "failed" ? (sErr || "Gagal") : st}
                </div>
                <details style={{ marginTop: 4 }}>
                  <summary style={{ fontSize: "0.76rem", cursor: "pointer", color: "var(--md-sys-color-primary)" }}>
                    Request / response
                  </summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.72rem", background: "var(--md-sys-color-surface-container-high)", padding: 10, borderRadius: 8 }}>
                    in: {s.input_data ?? s.inputData ?? "-"}
                    {"\n"}out: {s.output_data ?? s.outputData ?? "-"}
                  </pre>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
