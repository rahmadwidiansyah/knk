import { useMemo, useState } from "react";
import { Check, Clock } from "../icons";
import {
  HARI_PENDEK,
  cronToModel,
  modelToCron,
  nextRuns,
  scheduleSummary,
  type ScheduleModel,
} from "../../lib/scheduleModel";

interface Props {
  cron: string;
  timezone: string;
  scheduled?: boolean;
  onChange: (cron: string, timezone: string) => void;
}



const TZ_OPTS = [
  { id: "Asia/Jakarta", label: "WIB · Asia/Jakarta" },
  { id: "Asia/Makassar", label: "WITA · Asia/Makassar" },
  { id: "Asia/Jayapura", label: "WIT · Asia/Jayapura" },
  { id: "UTC", label: "UTC" },
];

/** HARI (checklist) → WAKTU → RINGKASAN. Output tetap { cron, timezone } ke backend. */
export default function ScheduleBuilder({ cron, timezone, scheduled, onChange }: Props) {
  const tz = timezone || "Asia/Jakarta";
  const parsed = useMemo(() => cronToModel(cron, tz), [cron, tz]);
  const [customTz, setCustomTz] = useState(!TZ_OPTS.some((o) => o.id === tz));

  const weeklyLike =
    !!parsed && ["daily", "weekly", "workdays", "weekend"].includes(parsed.pattern);
  const model: ScheduleModel = weeklyLike
    ? (parsed as ScheduleModel)
    : {
        pattern: "daily",
        days: [0, 1, 2, 3, 4, 5, 6],
        hour: 7,
        minute: 0,
        dayOfMonth: 1,
        timezone: tz,
      };

  function emit(m: ScheduleModel) {
    onChange(modelToCron(m), m.timezone);
  }
  function patch(p: Partial<ScheduleModel>) {
    emit({ ...model, ...p });
  }

  function toggleDay(d: number) {
    const has = model.days.includes(d);
    const next = has ? model.days.filter((x) => x !== d) : [...model.days, d];
    patch({ pattern: "weekly", days: next });
  }

  function applyDayPreset(which: "all" | "work" | "end") {
    if (which === "all") patch({ pattern: "daily", days: [0, 1, 2, 3, 4, 5, 6] });
    else if (which === "work") patch({ pattern: "workdays", days: [1, 2, 3, 4, 5] });
    else patch({ pattern: "weekend", days: [0, 6] });
  }

  function switchToDays() {
    const src = parsed || model;
    emit({ pattern: "weekly", days: [1], hour: src.hour, minute: src.minute, dayOfMonth: 1, timezone: tz });
  }

  const runs = useMemo(
    () => (weeklyLike ? nextRuns({ ...model, pattern: "weekly", timezone: tz }) : null),
    [weeklyLike, cron, tz]
  );
  const errors: string[] = [];
  if (weeklyLike && model.days.length === 0) errors.push("Pilih minimal satu hari — workflow hanya jalan di hari yang dipilih.");

  return (
    <div className="sched">
      {!weeklyLike ? (
        <div className="sched-note" style={{ background: "var(--md-sys-color-surface-container-high)", padding: "10px 12px", borderRadius: 8 }}>
          Jadwal ini bertipe {model.pattern === "monthly" ? "bulanan" : model.pattern === "once" ? "sekali" : "khusus"}.
          <br />
          <button type="button" className="md3-button md3-button--tonal" style={{ marginTop: 8 }} onClick={switchToDays}>
            Ganti ke pilihan hari
          </button>
        </div>
      ) : (
        <>
          <div className="sched-daypresets">
            <button type="button" className="sched-chip" onClick={() => applyDayPreset("all")}>Setiap hari</button>
            <button type="button" className="sched-chip" onClick={() => applyDayPreset("work")}>Hari kerja</button>
            <button type="button" className="sched-chip" onClick={() => applyDayPreset("end")}>Akhir pekan</button>
          </div>
          <div className="sched-label">Jalan di hari</div>
          <div className="sched-days" role="group" aria-label="Pilih hari">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = model.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`sched-day${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                >
                  {on && <Check size={11} aria-hidden />}

                  {HARI_PENDEK[d]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {weeklyLike && (
        <>
          <div className="sched-label">Waktu</div>
          <div className="sched-time">
            <input
              type="number"
              min={0}
              max={23}
              value={model.hour}
              onChange={(e) => {
                const v = Math.max(0, Math.min(23, Number(e.target.value)));
                if (Number.isFinite(v)) patch({ hour: v });
              }}
              aria-label="Jam (0-23)"
            />
            <span>:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={String(model.minute).padStart(2, "0")}
              onChange={(e) => {
                const v = Math.max(0, Math.min(59, Number(e.target.value)));
                if (Number.isFinite(v)) patch({ minute: v });
              }}
              aria-label="Menit (0-59)"
            />
          </div>

          {errors.map((e) => (
            <p key={e} className="sched-error">{e}</p>
          ))}

          <div className="sched-summary">
            <div className="sched-summary-ic" style={{ display: "flex" }}><Clock size={24} aria-hidden /></div>
            <div>
              <div className="sched-summary-main">{scheduleSummary({ ...model, pattern: "weekly" })}.</div>
              {runs && runs.length > 0 && (
                <div className="sched-summary-next">
                  Berikutnya: {runs[0].label}
                  {runs.slice(1).map((r) => (
                    <span key={r.at.getTime()}><br />Lalu: {r.label}</span>
                  ))}
                </div>
              )}
              {scheduled !== undefined && (
                <div className="sched-summary-next">{scheduled ? "Terjadwal" : "Belum terjadwal (aktifkan workflow)"}</div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="sched-tz">
        <span>Timezone</span>
        {!customTz ? (
          <select
            className="sched-tz-select"
            value={TZ_OPTS.some((o) => o.id === tz) ? tz : "__custom"}
            onChange={(e) => {
              if (e.target.value === "__custom") setCustomTz(true);
              else onChange(cron, e.target.value);
            }}
          >
            {TZ_OPTS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
            {!TZ_OPTS.some((o) => o.id === tz) && <option value="__custom">{tz} (kustom)</option>}
          </select>
        ) : (
          <input
            className="sched-tz-select"
            value={tz}
            onChange={(e) => onChange(cron, e.target.value)}
            placeholder="Asia/Jakarta"
          />
        )}
      </div>

      <details className="builder-advanced">
        <summary>Pengaturan lanjutan ▾</summary>
        <p className="sched-note">
          Cron: <code>{weeklyLike ? modelToCron(model) : cron}</code> · presisi menit.
        </p>
      </details>
    </div>
  );
}
