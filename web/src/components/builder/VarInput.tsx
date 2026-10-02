import { useRef, useState } from "react";
import { useVarItems, type VarItem } from "../VarPicker";
import { fieldStyle } from "../NodeForm";

interface Props {
  value: string;
  onChange: (v: string) => void;
  stepIds?: string[];
  placeholder?: string;
  mono?: boolean;
  rows?: number;
}

/** Input/textarea yang membuka daftar variabel saat mengetik "{{". */
export default function VarInput({ value, onChange, stepIds = [], placeholder, mono, rows }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [anchor, setAnchor] = useState(0);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const { items } = useVarItems(stepIds);

  const filtered: VarItem[] = open
    ? items.filter((i: VarItem) => !q || `${i.label} ${i.value}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
    : [];

  function handleChange(v: string, pos: number) {
    onChange(v);
    const before = v.slice(0, pos);
    const m = before.match(/\{\{\s*([a-zA-Z0-9_.]*)$/);
    if (m) {
      setAnchor(pos - m[0].length);
      setQ(m[1]);
      setHi(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  function pick(val: string) {
    const el = ref.current;
    const cur = value;
    // Ganti token "{{..." yang sedang diketik dengan value penuh
    const closeIdx = cur.indexOf("}}", anchor);
    const end = closeIdx >= 0 && closeIdx < anchor + 40 ? closeIdx + 2 : (ref.current?.selectionStart ?? cur.length);
    const next = cur.slice(0, anchor) + val + cur.slice(end);
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const p = anchor + val.length;
      el?.setSelectionRange(p, p);
    });
  }

  function keyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Escape") (e.target as HTMLElement).blur();
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && filtered[hi] && rows === undefined) {
      e.preventDefault();
      pick(filtered[hi].value);
    } else if (e.key === "Tab" && filtered[hi]) {
      e.preventDefault();
      pick(filtered[hi].value);
    }
  }

  const style = { ...fieldStyle, ...(mono ? { fontFamily: "monospace" } : {}) };
  const common = {
    ref: (el: any) => {
      ref.current = el;
    },
    value,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handleChange(e.target.value, e.target.selectionStart ?? e.target.value.length),
    onKeyDown: keyDown,
    onBlur: () => setTimeout(() => setOpen(false), 150),
    style,
  };

  return (
    <div className="varauto">
      {rows ? <textarea {...common} rows={rows} /> : <input {...common} />}
      {open && (
        <div className="varauto-drop">
          <div style={{ fontSize: "0.7rem", color: "var(--md-sys-color-on-surface-variant)", padding: "4px 8px" }}>
            Variabel — Enter untuk sisip, Esc tutup
          </div>
          {filtered.length === 0 && <div style={{ fontSize: "0.8rem", padding: "4px 8px" }}>Tidak ada yang cocok.</div>}
          {filtered.map((i: VarItem, idx: number) => (
            <button
              key={i.value}
              type="button"
              className={`palette-item${idx === hi ? " active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(i.value);
              }}
              onMouseEnter={() => setHi(idx)}
            >
              <span>
                <div style={{ fontSize: "0.8rem" }}>{i.label}</div>
                <div className="d" style={{ fontSize: "0.7rem", color: "var(--md-sys-color-on-surface-variant)" }}>{i.value}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
