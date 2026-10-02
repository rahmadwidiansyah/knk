import { useEffect, useRef, useState } from "react";
import { NodeTypeIcon, Search } from "../icons";
import { LIB_SECTIONS, type LibEntry } from "./NodeLibrary";

interface Props {
  /** null = tertutup. mode menentukan apa yang bisa dipilih. */
  open: null | { mode: "trigger" | "node" | "any"; insertAfterKey?: string | null };
  onClose: () => void;
  onPick: (e: LibEntry) => void;
}

export default function NodePicker({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setHi(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const sections = LIB_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) =>
        (open.mode === "any" || (open.mode === "trigger" ? i.kind === "trigger" : i.kind === "node")) &&
        (!q || `${i.label} ${i.desc} ${i.type}`.toLowerCase().includes(q.toLowerCase()))
    ),
  })).filter((s) => s.items.length > 0);

  const flat = sections.flatMap((s) => s.items);

  function keyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, flat.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    }
    if (e.key === "Enter" && flat[hi]) onPick(flat[hi]);
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={keyDown}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", color: "var(--md-sys-color-on-surface-variant)" }}>
            <Search size={15} aria-hidden />
          </span>
          <input ref={inputRef} placeholder="Cari action…" value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} style={{ paddingLeft: 34 }} />
        </div>
        {sections.map((s) => (
          <div key={s.title}>
            <div className="palette-cat">{s.title}</div>
            {s.items.map((i) => {
              const idx = flat.indexOf(i);
              return (
                <button
                  key={`${i.kind}:${i.type}`}
                  type="button"
                  className={`palette-item${idx === hi ? " active" : ""}`}
                  onMouseEnter={() => setHi(idx)}
                  onClick={() => onPick(i)}
                >
                  <span style={{ display: "flex", color: "var(--md-sys-color-on-surface-variant)" }}><NodeTypeIcon type={i.type} size={17} /></span>
                  <span>
                    <div>{i.label}</div>
                    <div className="d">{i.desc}</div>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {flat.length === 0 && <p style={{ fontSize: "0.85rem" }}>Tidak ketemu. Tekan Esc untuk tutup.</p>}
      </div>
    </div>
  );
}
