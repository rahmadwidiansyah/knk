import { useState } from "react";
import { NodeTypeIcon, Search } from "../icons";
import { NODE_LABELS, TRIGGER_LABELS, type NodeType, type TriggerType } from "../../lib/workflowDraft";

export interface LibEntry {
  kind: "trigger" | "node";
  type: string;
  label: string;
  desc: string;
}

const TRIGGERS: Array<{ type: TriggerType; desc: string }> = [
  { type: "manual", desc: "Jalan via Test" },
  { type: "webhook", desc: "POST publik" },
  { type: "schedule", desc: "Jadwal cron" },
  { type: "waha_event", desc: "Pesan WhatsApp" },
  { type: "telegram_event", desc: "Pesan Telegram" },
];

const ACTIONS: Array<{ type: NodeType; desc: string }> = [
  { type: "send_waha", desc: "Kirim WhatsApp" },
  { type: "send_waha_media", desc: "Kirim gambar/file WA" },
  { type: "send_telegram", desc: "Kirim Telegram" },
  { type: "http_request", desc: "Panggil API" },
];

const LOGIC: Array<{ type: NodeType; desc: string }> = [
  { type: "condition", desc: "Jika / maka" },
  { type: "delay", desc: "Tunggu" },
];

const UTILITY: Array<{ type: NodeType; desc: string }> = [
  { type: "transform", desc: "Olah data JS" },
  { type: "log", desc: "Catat log" },
];

export const LIB_SECTIONS: Array<{ title: string; items: LibEntry[] }> = [
  {
    title: "Trigger",
    items: TRIGGERS.map((t) => ({
      kind: "trigger",
      type: t.type,
      label: TRIGGER_LABELS[t.type].label,
      desc: t.desc,
    })),
  },
  {
    title: "Action",
    items: ACTIONS.map((a) => ({
      kind: "node",
      type: a.type,
      label: NODE_LABELS[a.type].label,
      desc: a.desc,
    })),
  },
  {
    title: "Logic",
    items: LOGIC.map((a) => ({
      kind: "node",
      type: a.type,
      label: NODE_LABELS[a.type].label,
      desc: a.desc,
    })),
  },
  {
    title: "Utility",
    items: UTILITY.map((a) => ({
      kind: "node",
      type: a.type,
      label: NODE_LABELS[a.type].label,
      desc: a.desc,
    })),
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (e: LibEntry) => void;
}

export default function NodeLibrary({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState("");

  const sections = LIB_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) => !q || `${i.label} ${i.desc} ${i.type}`.toLowerCase().includes(q.toLowerCase())
    ),
  })).filter((s) => s.items.length > 0);

  return (
    <aside className={`builder-lib${open ? " open" : ""}`}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", color: "var(--md-sys-color-on-surface-variant)" }}>
          <Search size={15} aria-hidden />
        </span>
        <input
          className="builder-search"
          placeholder="Cari node…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>
      {sections.map((s) => (
        <div key={s.title}>
          <h4>{s.title}</h4>
          {s.items.map((i) => (
            <button
              key={`${i.kind}:${i.type}`}
              type="button"
              className="builder-lib-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-lightflow", JSON.stringify({ kind: i.kind, type: i.type }));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onPick(i)}
            >
              <span className="ic" style={{ display: "flex" }}><NodeTypeIcon type={i.type} size={17} /></span>
              <span>
                <div>{i.label}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--md-sys-color-on-surface-variant)" }}>{i.desc}</div>
              </span>
            </button>
          ))}
        </div>
      ))}
      {sections.length === 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--md-sys-color-on-surface-variant)" }}>Tidak ketemu “{q}”.</p>
      )}
    </aside>
  );
}
