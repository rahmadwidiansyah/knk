import { Check, CircleAlert, Minus } from "../icons";
import { isConfigured, nodeSummary, triggerSummary } from "../../lib/nodeSummary";
import { NODE_LABELS, TRIGGER_LABELS, type DraftNode, type DraftTrigger } from "../../lib/workflowDraft";
import { NodeTypeIcon } from "../icons";

interface TriggerProps {
  trigger: DraftTrigger;
  selected: boolean;
  onSelect: () => void;
}

export function TriggerCard({ trigger, selected, onSelect }: TriggerProps) {
  const meta = TRIGGER_LABELS[trigger.type];
  const sum = triggerSummary(trigger.type, trigger.config);
  return (
    <button
      type="button"
      className={`canvas-node canvas-node--trigger${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <div className="canvas-node-top">
        <span className="ic" style={{ display: "flex" }}><NodeTypeIcon type={trigger.type} size={18} /></span>
        <span className="canvas-node-name">{meta.label}</span>
        <span className="canvas-node-badge">trigger</span>
      </div>
      {sum.map((s, i) => (
        <p key={i} className="canvas-node-sum">{s}</p>
      ))}
    </button>
  );
}

interface NodeProps {
  node: DraftNode;
  selected: boolean;
  hasError?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function CanvasNode({ node, selected, hasError, invalid, disabled, onSelect }: NodeProps) {
  const meta = NODE_LABELS[node.type] || { label: node.type };
  const sum = nodeSummary(node);
  const ok = !node.unsupported && isConfigured(node);
  return (
    <button
      type="button"
      className={`canvas-node${selected ? " selected" : ""}${hasError ? " canvas-node--error" : ""}${invalid ? " canvas-node--invalid" : ""}${disabled ? " canvas-node--disabled" : ""}`}
      onClick={onSelect}
      aria-label={`${node.name}${disabled ? " (nonaktif)" : ""}`}
    >
      <div className="canvas-node-top">
        <span className="ic" style={{ display: "flex" }}>
          {node.unsupported ? <CircleAlert size={18} aria-hidden /> : <NodeTypeIcon type={node.type} size={18} />}
        </span>
        <span className="canvas-node-name">{node.name}</span>
        <span className="canvas-node-badge">{node.id}</span>
      </div>
      {sum.map((s, i) => (
        <p key={i} className="canvas-node-sum">{s}</p>
      ))}
      <p className={`canvas-node-ok${ok ? "" : " missing"}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {disabled ? <Minus size={13} aria-hidden /> : ok ? <Check size={13} aria-hidden /> : <Minus size={13} aria-hidden />}
        {disabled ? "Nonaktif — dilewati" : ok ? "Siap" : "Belum lengkap"}
      </p>
    </button>
  );
}
