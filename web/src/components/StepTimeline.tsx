function ms(a?: string | null, b?: string | null): string {
  if (!a || !b) return "";
  const d = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(d) || d < 0) return "";
  if (d < 1000) return `${d}ms`;
  return `${(d / 1000).toFixed(1)}s`;
}

function dot(status: string): string {
  if (status === "success") return "var(--md-sys-color-primary)";
  if (status === "failed") return "var(--md-sys-color-error)";
  return "var(--md-sys-color-secondary)";
}

export interface Step {
  id: string;
  node_id?: string;
  nodeId?: string;
  node_name?: string;
  nodeName?: string;
  node_type?: string;
  nodeType?: string;
  status: string;
  input_data?: string | null;
  inputData?: string | null;
  output_data?: string | null;
  outputData?: string | null;
  error_message?: string | null;
  errorMessage?: string | null;
  retry_count?: number;
  retryCount?: number;
  started_at?: string | null;
  startedAt?: string | null;
  finished_at?: string | null;
  finishedAt?: string | null;
}

export default function StepTimeline({ steps }: { steps: Step[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {steps.map((s: any, i) => {
        const nodeId = s.node_id ?? s.nodeId;
        const nodeName = s.node_name ?? s.nodeName;
        const nodeType = s.node_type ?? s.nodeType;
        const retry = s.retry_count ?? s.retryCount;
        const inData = s.input_data ?? s.inputData;
        const outData = s.output_data ?? s.outputData;
        const errMsg = s.error_message ?? s.errorMessage;
        const started = s.started_at ?? s.startedAt;
        const finished = s.finished_at ?? s.finishedAt;
        const last = i === steps.length - 1;
        return (
          <div key={s.id} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: dot(s.status),
                  marginTop: 4,
                  flexShrink: 0,
                }}
              />
              {!last && (
                <div style={{ width: 2, flex: 1, minHeight: 16, background: "var(--md-sys-color-outline-variant)" }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.875rem" }}>
                  {i + 1}. {nodeId} · {nodeName}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--md-sys-color-on-surface-variant)" }}>
                  {nodeType} · {s.status}
                  {retry ? ` · retry ${retry}` : ""} · {ms(started, finished)}
                </span>
              </div>
              <details style={{ marginTop: 6, border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 8, padding: 8 }}>
                <summary style={{ fontSize: "0.8rem", cursor: "pointer" }}>input / output</summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", margin: "8px 0 0" }}>
                  in: {inData || "-"}
                  {"\n"}out: {outData || "-"}
                  {errMsg ? `\nerr: ${errMsg}` : ""}
                </pre>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}
