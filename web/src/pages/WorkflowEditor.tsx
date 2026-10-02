import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../builder.css";
import { ArrowLeft, Check, Play, Plus, Power, TemplateIcon, WorkflowIcon } from "../components/icons";
import JsonEditor from "../components/JsonEditor";
import ConfigPanel, { type Selection } from "../components/builder/ConfigPanel";
import NodePicker from "../components/builder/NodePicker";
import NodeLibrary, { type LibEntry } from "../components/builder/NodeLibrary";
import TestDrawer from "../components/builder/TestDrawer";
import WorkflowHeader, { type SaveState } from "../components/builder/WorkflowHeader";
import { CanvasNode, TriggerCard } from "../components/builder/CanvasNode";
import { TEMPLATES } from "../lib/templates";
import {
  getWorkflow,
  getWorkflowWebhook,
  regenerateWebhook,
  testNode,
  testWorkflow,
  toggleWorkflow,
  updateWorkflow,
} from "../lib/workflows";
import {
  buildDraftFromJson,
  defaultTriggerConfig,
  draftToJson,
  makeNode,
  validateDraftClient,
  type Draft,
  type TriggerType,
} from "../lib/workflowDraft";

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isActive, setIsActive] = useState(0);
  const [lastSaved, setLastSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [palette, setPalette] = useState<null | { mode: "trigger" | "node" | "any"; insertAfterKey?: string | null; askBranch?: boolean; branch?: "true" | "false" }>(null);
  const [activationIssues, setActivationIssues] = useState<Array<{ nodeId: string | null; message: string }>>([]);
  const [nodeTest, setNodeTest] = useState<Record<string, { loading?: boolean; output?: any; error?: string }>>({});
  const [libOpen, setLibOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState("{}");
  const [drawer, setDrawer] = useState(false);
  const [testInput, setTestInput] = useState('{\n  "count": 10\n}');
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<{ execution: any; steps: any[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [rawTestError, setRawTestError] = useState<any>(null);
  const [bannerError, setBannerError] = useState("");
  const [info, setInfo] = useState("");
  const [webhook, setWebhook] = useState<{ path: string; url: string; is_active: number } | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    getWorkflow(id)
      .then((w) => {
        const d = buildDraftFromJson(w.json_config);
        setDraft(d);
        setRawText(pretty(w.json_config));
        setLastSaved(pretty(draftToJson(d)));
        setIsActive(w.is_active);
      })
      .catch((e) => setBannerError(e?.response?.data?.error || e.message));
    getWorkflowWebhook(id)
      .then((d) => {
        setWebhook(d.webhook);
        setScheduled(d.scheduled);
      })
      .catch(() => {});
  }, [id]);

  const dirty = draft ? pretty(draftToJson(draft)) !== lastSaved : false;
  const saveState: SaveState = saving ? "saving" : dirty ? "dirty" : "saved";

  function updateDraft(d: Draft) {
    setDraft(d);
  }

  // ---------- node ops (relasi next dipertahankan) ----------
  function insertNode(type: string, afterKey?: string | null, branch?: "true" | "false") {
    if (!draft) return;
    const nn = makeNode(type, draft.nodes.length, draft.nodes);
    const nodes = [...draft.nodes];
    if (afterKey) {
      const idx = nodes.findIndex((x) => x.key === afterKey);
      if (idx >= 0) {
        const prev = nodes[idx];
        if (prev.type === "condition") {
          const field = branch === "false" ? "next_false" : "next_true";
          nn.next = (prev as any)[field] && (prev as any)[field] !== "step_end" ? (prev as any)[field] : "step_end";
          (prev as any)[field] = nn.id;
        } else {
          nn.next = prev.next && prev.next !== "step_end" ? prev.next : "step_end";
          prev.next = nn.id;
        }
        nodes.splice(idx + 1, 0, nn);
        updateDraft({ ...draft, nodes });
        setSelection({ kind: "node", key: nn.key });
        return;
      }
    }
    nodes.push(nn);
    updateDraft({ ...draft, nodes });
    setSelection({ kind: "node", key: nn.key });
  }

  function deleteNode(key: string) {
    if (!draft) return;
    const gone = draft.nodes.find((x) => x.key === key);
    if (gone && !confirm(`Hapus langkah '${gone.name}'?`)) return;
    const rest = draft.nodes.filter((x) => x.key !== key);
    if (gone) {
      for (const n of rest) {
        for (const f of ["next", "next_true", "next_false", "on_error"] as const) {
          if ((n as any)[f] === gone.id) (n as any)[f] = f === "on_error" ? undefined : "step_end";
        }
        if (Array.isArray(n.next_all)) {
          n.next_all = n.next_all.filter((t) => t !== gone.id);
          if (n.next_all.length === 0) n.next_all = undefined;
        }
      }
    }
    updateDraft({ ...draft, nodes: rest });
    setSelection(null);
  }

  function toggleNodeDisabled(key: string) {
    if (!draft) return;
    updateDraft({
      ...draft,
      nodes: draft.nodes.map((x) => (x.key === key ? { ...x, disabled: !x.disabled } : x)),
    });
  }

  async function testSingleNode(key: string) {
    if (!draft || !id) return;
    const n = draft.nodes.find((x) => x.key === key);
    if (!n) return;
    setNodeTest((p) => ({ ...p, [key]: { loading: true } }));
    try {
      const out = await testNode(id, n.id, {});
      setNodeTest((p) => ({ ...p, [key]: { output: out.output } }));
    } catch (e: any) {
      setNodeTest((p) => ({ ...p, [key]: { error: e?.response?.data?.error || e.message } }));
    }
  }

  function duplicateNode(key: string) {
    if (!draft) return;
    const src = draft.nodes.find((x) => x.key === key);
    if (!src) return;
    const taken = new Set(draft.nodes.map((x) => x.id));
    let nid = `${src.id}_copy`;
    let i = 1;
    while (taken.has(nid)) {
      i++;
      nid = `${src.id}_copy${i}`;
    }
    const idx = draft.nodes.findIndex((x) => x.key === key);
    const copy = { ...JSON.parse(JSON.stringify(src)), key: `n${Date.now().toString(36)}${i}`, id: nid };
    const nodes = [...draft.nodes.slice(0, idx + 1), copy, ...draft.nodes.slice(idx + 1)];
    updateDraft({ ...draft, nodes });
    setSelection({ kind: "node", key: copy.key });
  }

  function onLibraryPick(e: LibEntry) {
    if (!draft) return;
    if (e.kind === "trigger") {
      updateDraft({ ...draft, trigger: { type: e.type as TriggerType, config: defaultTriggerConfig(e.type as TriggerType) } });
      setSelection({ kind: "trigger" });
    } else {
      insertNode(e.type, null);
    }
    setLibOpen(false);
  }

  function onPalettePick(e: LibEntry) {
    if (!draft || !palette) return;
    if (e.kind === "trigger") {
      updateDraft({ ...draft, trigger: { type: e.type as TriggerType, config: defaultTriggerConfig(e.type as TriggerType) } });
      setSelection({ kind: "trigger" });
    } else {
      insertNode(e.type, palette.insertAfterKey ?? null, palette.branch);
    }
    setPalette(null);
  }

  /** Klik "+" sesudah kartu: bila sebelumnya IF, tanya cabang dulu. */
  function openPaletteAfter(prevKey: string | null) {
    if (!draft || !prevKey) {
      setPalette({ mode: "node", insertAfterKey: null });
      return;
    }
    const prev = draft.nodes.find((x) => x.key === prevKey);
    if (prev?.type === "condition") {
      setPalette({ mode: "node", insertAfterKey: prevKey, askBranch: true });
    } else {
      setPalette({ mode: "node", insertAfterKey: prevKey });
    }
  }

  function applyTemplate(tid: string) {
    if (!draft) return;
    const t = TEMPLATES.find((x) => x.id === tid);
    if (!t) return;
    const nd = buildDraftFromJson(t.make());
    updateDraft({ ...draft, trigger: nd.trigger, nodes: nd.nodes });
    setSelection(null);
    setInfo(`Template “${t.title}” dimuat. Sesuaikan lalu Save.`);
  }

  // ---------- drop dari library ----------
  function onDropInsert(e: React.DragEvent, afterKey: string | null) {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/x-lightflow"));
      if (data.kind === "node") insertNode(data.type, afterKey);
      else if (draft) {
        updateDraft({ ...draft, trigger: { type: data.type as TriggerType, config: defaultTriggerConfig(data.type as TriggerType) } });
        setSelection({ kind: "trigger" });
      }
    } catch {
      // abaikan drop asing
    }
  }

  // ---------- save / toggle / test ----------
  function currentJson(): any {
    if (showJson && rawMode) {
      try {
        return JSON.parse(rawText);
      } catch {
        throw new Error("Workflow JSON bukan JSON valid");
      }
    }
    if (!draft) throw new Error("Draft belum dimuat");
    return draftToJson(draft);
  }

  async function onSave() {
    if (!id) return;
    setBannerError("");
    setInfo("");
    setSaving(true);
    try {
      const cfg = currentJson();
      if (draft && !(showJson && rawMode)) {
        const errs = validateDraftClient(draft);
        if (errs.length > 0) throw new Error(errs.join("\n"));
      }
      const updated = await updateWorkflow(id, {
        name: draft?.name || cfg.name,
        description: draft?.description ?? cfg.description,
        json_config: cfg,
      });
      setIsActive(updated.is_active);
      const nd = buildDraftFromJson(updated.json_config);
      setDraft(nd);
      setRawText(pretty(updated.json_config));
      setLastSaved(pretty(draftToJson(nd)));
      setActivationIssues([]);
      setInfo("Tersimpan.");
      setTimeout(() => setInfo(""), 2500);
    } catch (e: any) {
      const details = e?.response?.data?.details;
      setBannerError(details ? `${e?.response?.data?.error}: ${pretty(details)}` : e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onToggle() {
    if (!id) return;
    try {
      const updated = await toggleWorkflow(id, isActive !== 1);
      setIsActive(updated.is_active);
      setActivationIssues([]);
      if (!isActive) setInfo("Workflow aktif.");
    } catch (e: any) {
      const issues = e?.response?.data?.details?.issues;
      if (Array.isArray(issues)) {
        setActivationIssues(issues);
        setBannerError("Workflow belum siap diaktifkan — perbaiki yang bertanda merah.");
      } else {
        setBannerError(e?.response?.data?.error || e.message);
      }
    }
  }

  async function onTest() {
    if (!id) return;
    setTestError(null);
    setRawTestError(null);
    setLastResult(null);
    setTesting(true);
    try {
      let input: any = {};
      try {
        input = JSON.parse(testInput);
      } catch {
        throw new Error("Input test bukan JSON valid");
      }
      const out = await testWorkflow(id, input);
      setLastResult(out);
    } catch (e: any) {
      const details = e?.response?.data?.details;
      const msg = details ? `${e?.response?.data?.error}: ${pretty(details)}` : e?.response?.data?.error || e.message;
      setTestError(msg);
      setRawTestError(e);
    } finally {
      setTesting(false);
    }
  }

  async function onRegenerate() {
    if (!id) return;
    try {
      const wh = await regenerateWebhook(id);
      setWebhook({ ...wh, is_active: 1 });
      setInfo("Webhook URL baru dibuat. URL lama sudah mati.");
      setTimeout(() => setInfo(""), 2500);
    } catch (e: any) {
      setBannerError(e?.response?.data?.error || e.message);
    }
  }

  function copyUrl() {
    if (!webhook?.url) return;
    navigator.clipboard?.writeText(webhook.url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setBannerError("Gagal menyalin URL")
    );
  }

  if (!draft) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button className="md3-button md3-button--text" onClick={() => navigate("/workflows")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={15} aria-hidden /> Kembali
        </button>
        {bannerError ? <div className="md3-error">{bannerError}</div> : <div className="md3-card md3-card--outlined">Memuat…</div>}
      </div>
    );
  }

  const failedIds = new Set(
    (lastResult?.steps || []).filter((s: any) => s.status === "failed").map((s: any) => s.node_id ?? s.nodeId)
  );

  return (
    <div className="builder">
      <WorkflowHeader
        name={draft.name}
        description={draft.description}
        isActive={isActive === 1}
        saveState={saveState}
        testing={testing}
        saving={saving}
        showJson={showJson}
        onName={(v) => updateDraft({ ...draft, name: v })}
        onDescription={(v) => updateDraft({ ...draft, description: v })}
        onBack={() => navigate("/workflows")}
        onTest={() => setDrawer(true)}
        onSave={onSave}
        onToggle={onToggle}
        onToggleJson={() => setShowJson((s) => !s)}
        onOpenLibrary={() => setLibOpen(true)}
      />
      {bannerError && <div className="md3-error" style={{ margin: "8px 16px 0", whiteSpace: "pre-wrap" }}>{bannerError}</div>}
      {info && (
        <div style={{ margin: "8px 16px 0", background: "var(--md-sys-color-primary-container)", color: "var(--md-sys-color-on-primary-container)", padding: "8px 14px", borderRadius: 8, fontSize: "0.85rem" }}>
          {info}
        </div>
      )}

      {showJson ? (
        <div style={{ padding: 16, overflowY: "auto" }}>
          <div className="md3-card md3-card--outlined">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h3 className="md3-card__title" style={{ flex: 1, margin: 0 }}>Workflow JSON</h3>
              {!rawMode ? (
                <button type="button" className="builder-btn builder-btn--tonal" onClick={() => { setRawText(pretty(draftToJson(draft))); setRawMode(true); }}>
                  Edit Mentah
                </button>
              ) : (
                <button
                  type="button"
                  className="builder-btn builder-btn--filled"
                  onClick={() => {
                    try {
                      const cfg = JSON.parse(rawText);
                      setDraft(buildDraftFromJson(cfg));
                      setRawMode(false);
                      setBannerError("");
                    } catch {
                      setBannerError("JSON belum valid — perbaiki dulu.");
                    }
                  }}
                >
                  Terapkan ke Form
                </button>
              )}
            </div>
            {!rawMode ? (
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", fontFamily: "monospace", background: "var(--md-sys-color-surface-container-low)", padding: 12, borderRadius: 8, maxHeight: 480, overflowY: "auto" }}>
                {pretty(draftToJson(draft))}
              </pre>
            ) : (
              <JsonEditor value={rawText} onChange={setRawText} />
            )}
          </div>
        </div>
      ) : (
        <div className="builder-body">
          <NodeLibrary open={libOpen} onClose={() => setLibOpen(false)} onPick={onLibraryPick} />
          <div
            className="builder-canvas"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropInsert(e, draft.nodes.length > 0 ? draft.nodes[draft.nodes.length - 1].key : null)}
          >
            <div className="builder-canvas-inner">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  onDropInsert(e, null);
                }}
              >
                <TriggerCard
                  trigger={draft.trigger}
                  selected={selection?.kind === "trigger"}
                  onSelect={() => setSelection({ kind: "trigger" })}
                />
              </div>

              {draft.nodes.length === 0 ? (
                <div className="builder-empty">
                  <div className="big" style={{ display: "flex", justifyContent: "center", color: "var(--md-sys-color-on-surface-variant)" }}><WorkflowIcon size={36} aria-hidden /></div>
                  <h3>Bangun workflow-mu</h3>
                  <p>Mulai dengan satu trigger di atas,<br />lalu tambahkan langkah berikutnya.</p>
                  <button type="button" className="builder-btn builder-btn--filled" onClick={() => setPalette({ mode: "node", insertAfterKey: null })}>
                    <Plus size={15} aria-hidden /> Tambah Langkah
                  </button>
                  <div style={{ fontSize: "0.8rem", color: "var(--md-sys-color-on-surface-variant)", marginTop: 14 }}>atau mulai dari template</div>
                  <div className="builder-templates">
                    {TEMPLATES.map((t) => (
                      <button key={t.id} type="button" className="builder-template" onClick={() => applyTemplate(t.id)}>
                        <div className="t-ic" style={{ display: "flex" }}><TemplateIcon icon={t.icon} size={22} /></div>
                        <div className="t-ti">{t.title}</div>
                        <div className="t-de">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {draft.nodes.map((n, i) => {
                    const prevKey = i === 0 ? null : draft.nodes[i - 1].key;
                    const prev = i === 0 ? null : draft.nodes[i - 1];
                    const branchLabel =
                      prev?.type === "condition"
                        ? n.id === prev.next_true
                          ? "ya"
                          : n.id === prev.next_false
                            ? "tidak"
                            : null
                        : null;
                    const isSel = selection?.kind === "node" && selection.key === n.key;
                    const actErr = activationIssues.find((a) => a.nodeId === n.id);
                    const t = nodeTest[n.key];
                    return (
                      <div key={n.key}>
                        <div
                          className="canvas-link"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation();
                            onDropInsert(e, prevKey);
                          }}
                        >
                          <span className="line" />
                          {branchLabel && <span className="lbl">{branchLabel}</span>}
                          <button
                            type="button"
                            className="canvas-insert"
                            title="Sisipkan langkah di sini"
                            onClick={() => openPaletteAfter(prevKey)}
                            aria-label="Sisipkan langkah di sini"
                          >
                            <Plus size={13} aria-hidden />
                          </button>
                          <span className="line" />
                        </div>
                        <CanvasNode
                          node={n}
                          selected={isSel}
                          hasError={failedIds.has(n.id)}
                          invalid={Boolean(actErr)}
                          disabled={n.disabled === true}
                          onSelect={() => setSelection({ kind: "node", key: n.key })}
                        />
                        {n.next_all && n.next_all.length > 0 && (
                          <div className="canvas-branches" aria-label="Cabang tambahan">
                            {n.next_all.map((t) => (
                              <span key={t} className="canvas-branch">⑂ {t}</span>
                            ))}
                          </div>
                        )}
                        {actErr && <div className="canvas-acterr">{actErr.message}</div>}
                        {isSel && (
                          <div className="canvas-quick" role="toolbar" aria-label="Aksi cepat">
                            <button type="button" title="Nonaktif/aktifkan" aria-label={n.disabled ? "Aktifkan langkah" : "Nonaktifkan langkah"}
                              onClick={() => toggleNodeDisabled(n.key)}>
                              <Power size={14} aria-hidden /> {n.disabled ? "Aktifkan" : "Matikan"}
                            </button>
                            <button type="button" title="Uji node ini (eksekusi asli)" aria-label="Uji node ini"
                              onClick={() => testSingleNode(n.key)}>
                              <Play size={14} aria-hidden /> Uji
                            </button>
                          </div>
                        )}
                        {t && (t.loading || t.output || t.error) && (
                          <div className="canvas-nodetest">
                            {t.loading ? "Menjalankan…" : t.error ? `✕ ${t.error}` : (
                              <pre>{pretty(t.output).slice(0, 600)}</pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="canvas-link">
                    <span className="line" />
                    <button
                      type="button"
                      className="canvas-insert"
                      title="Tambah langkah"
                      onClick={() => openPaletteAfter(draft.nodes[draft.nodes.length - 1].key)}
                      aria-label="Tambah langkah"
                    >
                      <Plus size={13} aria-hidden />
                    </button>
                    <span className="line" />
                  </div>
                  <div className="canvas-end"><Check size={13} aria-hidden /> Selesai</div>
                </>
              )}
            </div>
          </div>

          {(libOpen || selection) && (
            <div className="builder-scrim" onClick={() => { setLibOpen(false); }} />
          )}
          <ConfigPanel
            open={selection !== null}
            selection={selection}
            draft={draft}
            workflowId={id}
            webhookUrl={webhook?.url}
            scheduled={scheduled}
            copied={copied}
            onCopyWebhook={copyUrl}
            onRegenerateWebhook={onRegenerate}
            onClose={() => setSelection(null)}
            onDraft={updateDraft}
            onDeleteNode={deleteNode}
            onDuplicateNode={duplicateNode}
            onToggleDisabled={toggleNodeDisabled}
          />
        </div>
      )}

      {palette?.askBranch ? (
        <div className="palette-backdrop" onMouseDown={() => setPalette(null)}>
          <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 8px", fontSize: "0.9rem", fontWeight: 600 }}>Sisipkan ke cabang…</p>
            <button type="button" className="palette-item" onClick={() => setPalette({ ...palette, askBranch: false, branch: "true" })}>
              <span><div>Benar (TRUE)</div><div className="d">Lanjut jalur benar</div></span>
            </button>
            <button type="button" className="palette-item" onClick={() => setPalette({ ...palette, askBranch: false, branch: "false" })}>
              <span><div>Salah (FALSE)</div><div className="d">Lanjut jalur salah</div></span>
            </button>
          </div>
        </div>
      ) : (
        <NodePicker open={palette} onClose={() => setPalette(null)} onPick={onPalettePick} />
      )}
      <TestDrawer
        open={drawer}
        testing={testing}
        testInput={testInput}
        onInput={setTestInput}
        onRun={onTest}
        onClose={() => setDrawer(false)}
        result={lastResult}
        error={testError}
        rawError={rawTestError}
        triggerType={draft?.trigger.type}
        onOpenDetail={(eid) => navigate(`/executions/${eid}`)}
      />
    </div>
  );
}
