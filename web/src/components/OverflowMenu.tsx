import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "./icons";

export interface MenuItem {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

/** Tombol menu (MoreVertical) + dropdown. Tutup saat klik di luar / Esc. */
export default function OverflowMenu({ items, label = "Aksi lainnya" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open ]);

  return (
    <div className="lf-menu-wrap" ref={ref}>
      <button type="button" className="lf-icon-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreVertical size={17} aria-hidden />
      </button>
      {open && (
        <div className="lf-menu" role="menu">
          {items.map((i) => (
            <button
              key={i.label}
              type="button"
              role="menuitem"
              className={i.danger ? "danger" : undefined}
              onClick={() => {
                setOpen(false);
                i.onClick();
              }}
            >
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
