import { useEffect, useRef, useState } from "react";
import { listConnectors, listSecrets } from "../lib/integrations";

interface Props {
  /** Ref ke input/textarea target sisipan. */
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  /** ID node-step sebelumnya (untuk saran {{step_id}}). */
  stepIds?: string[];
  onInsert: (text: string) => void;
}

export interface VarItem {
  group: string;
  label: string;
  value: string;
}

const TRIGGER_VARS = [
  { label: "trigger.text — isi pesan", value: "{{trigger.text}}" },
  { label: "trigger.chat_id — pengirim", value: "{{trigger.chat_id}}" },
  { label: "trigger.from — info pengirim", value: "{{trigger.from}}" },
  { label: "trigger.body — mentah webhook", value: "{{trigger.body}}" },
  { label: "trigger.count — contoh angka", value: "{{trigger.count}}" },
];

/** Daftar variabel untuk picker & autocomplete {{. */
export function useVarItems(stepIds: string[] = []) {
  const [items, setItems] = useState<VarItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([listConnectors().catch(() => []), listSecrets().catch(() => [])]).then(([conns, secs]) => {
      if (!alive) return;
      setItems([
        ...TRIGGER_VARS.map((t) => ({ group: "Trigger", ...t })),
        ...(conns as any[]).map((c: any) => ({
          group: "Konektor",
          label: `${c.name} (${c.type})`,
          value: `{{connector.${c.name}}}`,
        })),
        ...(secs as any[]).map((s: any) => ({ group: "Secret", label: s.key, value: `{{secrets.${s.key}}}` })),
        ...stepIds.map((id) => ({ group: "Step", label: `${id} — output langkah`, value: `{{${id}}}` })),
        { group: "Lainnya", label: "execution.id", value: "{{execution.id}}" },
        { group: "Lainnya", label: "error.message (jalur on_error)", value: "{{error.message}}" },
      ]);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIds.join(",")]);
  return { items, loaded };
}

export default function VarPicker({ targetRef, stepIds = [], onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const { items } = useVarItems(stepIds);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open ]);

  function pick(value: string) {
    const el = targetRef.current;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + value + el.value.slice(end);
      onInsert(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + value.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      onInsert(value);
    }
    setOpen(false);
  }

  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <div ref={boxRef} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="md3-button md3-button--text" onClick={() => setOpen((o) => !o)} style={{ minHeight: 32, padding: "0 12px", fontSize: "0.8rem" }}>
        + Sisip
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            zIndex: 30,
            width: 300,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--md-sys-color-surface-container-high)",
            border: "1px solid var(--md-sys-color-outline-variant)",
            borderRadius: "var(--md-sys-shape-corner-small)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            padding: 8,
          }}
        >
          {groups.length === 0 && <div style={{ fontSize: "0.8rem", padding: 8 }}>Memuat...</div>}
          {groups.map((g) => (
            <div key={g}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--md-sys-color-on-surface-variant)", padding: "6px 8px 2px" }}>
                {g}
              </div>
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <button
                    key={i.value + i.label}
                    type="button"
                    onClick={() => pick(i.value)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: "0.8rem",
                      color: "var(--md-sys-color-on-surface)",
                      padding: "6px 8px",
                      borderRadius: 6,
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "var(--md-sys-color-surface-container-highest)")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "transparent")}
                  >
                    {i.label}
                    <code style={{ display: "block", fontSize: "0.7rem", color: "var(--md-sys-color-on-surface-variant)" }}>{i.value}</code>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
