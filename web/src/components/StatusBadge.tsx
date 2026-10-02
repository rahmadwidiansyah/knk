import { Check, CircleX, Clock3, Minus } from "./icons";

/** Status subtle: ikon Lucide + teks, bukan pill agresif. */

const MAP: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  success: { cls: "lf-status--ok", icon: <Check size={13} aria-hidden />, label: "Berhasil" },
  failed: { cls: "lf-status--err", icon: <CircleX size={13} aria-hidden />, label: "Gagal" },
  running: { cls: "lf-status--warn", icon: <Clock3 size={13} aria-hidden />, label: "Jalan" },
  active: { cls: "lf-status--ok", icon: <span className="lf-dot" />, label: "Aktif" },
  inactive: { cls: "lf-status--muted", icon: <span className="lf-dot" />, label: "Nonaktif" },
  pending: { cls: "lf-status--warn", icon: <Clock3 size={13} aria-hidden />, label: "Menunggu" },
  skipped: { cls: "lf-status--muted", icon: <Minus size={13} aria-hidden />, label: "Dilewati" },
  cancelled: { cls: "lf-status--muted", icon: <Minus size={13} aria-hidden />, label: "Batal" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] || MAP.inactive;
  return (
    <span className={`lf-status ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}
