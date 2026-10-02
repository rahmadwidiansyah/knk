/** Model ramah-manusia untuk schedule. Satu-satunya yang dikirim ke backend
 *  tetap { cron, timezone } — file ini murni adapter UI ↔ cron. */

export type SchedulePattern =
  | "daily"
  | "weekly"
  | "workdays"
  | "weekend"
  | "monthly"
  | "once";

export interface ScheduleModel {
  pattern: SchedulePattern;
  /** 0=Minggu..6=Sabtu (cron). Untuk daily diabaikan. */
  days: number[];
  hour: number;
  minute: number;
  /** Untuk monthly/once. */
  dayOfMonth: number;
  /** Untuk once: { y, m (1-12), d }. Untuk monthly: { m } = bulan acuan. */
  once?: { y: number; m: number; d: number };
  timezone: string;
}

export const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const clamp = (v: number, lo: number, hi: number, fb: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.trunc(v))) : fb;

function parseNumList(part: string, lo: number, hi: number): number[] | null {
  const out = new Set<number>();
  for (const seg of part.split(",")) {
    const m = seg.trim().match(/^(\d+)(?:-(\d+))?(?:\/(\d+))?$/);
    if (!m) return null;
    const step = m[3] ? parseInt(m[3], 10) : 1;
    const a = parseInt(m[1], 10);
    const b = m[2] !== undefined ? parseInt(m[2], 10) : a;
    if (a < lo || b > hi || step < 1) return null;
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return [...out].sort((x, y) => x - y);
}

/** cron 5-field → model. null bila di luar pola yang didukung UI. */
export function cronToModel(cron: string, timezone = "Asia/Jakarta"): ScheduleModel | null {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return null;
  const [mi, hh, dom, mon, dow] = p;
  if (mi.includes(",") || mi.includes("-") || hh.includes(",") || hh.includes("-")) return null;
  const minute = parseNumList(mi, 0, 59);
  const hour = parseNumList(hh, 0, 23);
  if (!minute || !hour || minute.length !== 1 || hour.length !== 1) return null;

  const base = { hour: hour[0], minute: minute[0], timezone };

  // Sekali (tanggal spesifik, tiap tahun): m h D M *
  if (dom !== "*" && mon !== "*" && dow === "*") {
    const d = parseNumList(dom, 1, 31);
    const mo = parseNumList(mon, 1, 12);
    if (d && mo && d.length === 1 && mo.length === 1) {
      return { ...base, pattern: "once", days: [], dayOfMonth: d[0], once: { y: new Date().getFullYear(), m: mo[0], d: d[0] } };
    }
    return null;
  }
  // Bulanan: m h D * *
  if (dom !== "*" && mon === "*" && dow === "*") {
    const d = parseNumList(dom, 1, 31);
    if (d && d.length === 1) return { ...base, pattern: "monthly", days: [], dayOfMonth: d[0] };
    return null;
  }
  // Mingguan / harian: dom & mon harus *
  if (dom !== "*" || mon !== "*") return null;
  if (dow === "*") return { ...base, pattern: "daily", days: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: 1 };
  const days = parseNumList(dow.replace(/7/g, "0"), 0, 6);
  if (!days || days.length === 0) return null;
  const key = days.join(",");
  const pattern: SchedulePattern =
    key === "0,1,2,3,4,5,6" ? "daily"
    : key === "1,2,3,4,5" ? "workdays"
    : key === "0,6" ? "weekend"
    : "weekly";
  return { ...base, pattern, days, dayOfMonth: 1 };
}

/** model → cron 5-field (format yang sudah dipakai backend). */
export function modelToCron(m: ScheduleModel): string {
  const mi = clamp(m.minute, 0, 59, 0);
  const hh = clamp(m.hour, 0, 23, 7);
  switch (m.pattern) {
    case "daily":
      return `${mi} ${hh} * * *`;
    case "monthly": {
      const d = clamp(m.dayOfMonth, 1, 31, 1);
      return `${mi} ${hh} ${d} * *`;
    }
    case "once": {
      // Jujur: cron tak bisa sekali-murni; ini berulang tiap tahun di tanggal tsb.
      const o = m.once;
      const d = o ? clamp(o.d, 1, 31, 1) : clamp(m.dayOfMonth, 1, 31, 1);
      const mo = o ? clamp(o.m, 1, 12, 1) : 1;
      return `${mi} ${hh} ${d} ${mo} *`;
    }
    default: {
      const days = [...new Set(m.days)].sort((a, b) => a - b).join(",");
      return `${mi} ${hh} * * ${days || "*"}`;
    }
  }
}

function jam(m: ScheduleModel): string {
  return `${String(clamp(m.hour, 0, 23, 0)).padStart(2, "0")}:${String(clamp(m.minute, 0, 59, 0)).padStart(2, "0")}`;
}

function daftarHari(days: number[]): string {
  const s = [...new Set(days)].sort((a, b) => a - b);
  if (s.join(",") === "0,1,2,3,4,5,6") return "setiap hari";
  if (s.join(",") === "1,2,3,4,5") return "setiap hari kerja";
  if (s.join(",") === "0,6") return "setiap akhir pekan";
  // Senin..Minggu berurutan → rentang
  const rot = s.map((d) => (d + 6) % 7).sort((a, b) => a - b); // Senin=0
  const contig = rot.every((v, i) => i === 0 || v === rot[i - 1] + 1);
  if (contig && rot.length >= 3) {
    const a = HARI_PANJANG[(rot[0] + 1) % 7];
    const b = HARI_PANJANG[(rot[rot.length - 1] + 1) % 7];
    return `setiap ${a}–${b}`;
  }
  const names = s.map((d) => HARI_PANJANG[d]);
  if (names.length === 1) return `setiap ${names[0]}`;
  return `setiap ${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}`;
}

/** Ringkasan panjang bahasa Indonesia. */
export function scheduleSummary(m: ScheduleModel): string {
  switch (m.pattern) {
    case "daily":
      return `Setiap hari pukul ${jam(m)}`;
    case "monthly":
      return `Setiap tanggal ${clamp(m.dayOfMonth, 1, 31, 1)} pukul ${jam(m)}`;
    case "once": {
      const o = m.once;
      if (!o) return `Sekali pukul ${jam(m)}`;
      return `Sekali pada ${o.d} ${BULAN[clamp(o.m, 1, 12, 1) - 1]} ${o.y} pukul ${jam(m)}`;
    }
    default:
      return `${cap(daftarHari(m.days))} pukul ${jam(m)}`;
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ringkasan pendek untuk kartu canvas. Cron mentah tak pernah ditampilkan. */
export function scheduleShort(cron: string): string {
  const m = cronToModel(cron);
  if (!m) return "Jadwal khusus";
  const t = jam(m);
  switch (m.pattern) {
    case "daily":
      return `Tiap hari · ${t}`;
    case "monthly":
      return `Tgl ${m.dayOfMonth} · ${t}`;
    case "once":
      return m.once ? `${m.once.d}/${m.once.m} · ${t}` : t;
    default: {
      const s = [...new Set(m.days)].sort((a, b) => a - b);
      const key = s.join(",");
      if (key === "1,2,3,4,5") return `Sen–Jum · ${t}`;
      if (key === "0,6") return `Sab–Min · ${t}`;
      if (key === "0,1,2,3,4,5,6") return `Tiap hari · ${t}`;
      return `${s.map((d) => HARI_PENDEK[d]).join(", ")} · ${t}`;
    }
  }
}

// ---------- next runs (matematika tanggal untuk pola UI; bukan engine baru) ----------

function tzOffsetMinutes(zone: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
    );
    return Math.round((asUTC - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/** Wall-clock (y,mo,d,h,mi) di zone → Date UTC. */
function zonedToUtc(zone: string, y: number, mo: number, d: number, h: number, mi: number): Date {
  let guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  for (let i = 0; i < 2; i++) {
    guess = new Date(Date.UTC(y, mo - 1, d, h, mi) - tzOffsetMinutes(zone, guess) * 60000);
  }
  return guess;
}

function wallParts(zone: string, at: Date): { y: number; mo: number; d: number; dow: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "numeric", day: "numeric", weekday: "short",
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>;
  return { y: Number(parts.year), mo: Number(parts.month), d: Number(parts.day), dow: wd[parts.weekday] ?? 0 };
}

export interface NextRun {
  at: Date;
  label: string;
}

function idLabel(at: Date, zone: string): string {
  try {
    const hari = new Intl.DateTimeFormat("id-ID", { timeZone: zone, weekday: "long" }).format(at);
    const tgl = new Intl.DateTimeFormat("id-ID", { timeZone: zone, day: "numeric", month: "long" }).format(at);
    const jam = new Intl.DateTimeFormat("id-ID", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
    const capH = hari.charAt(0).toUpperCase() + hari.slice(1);
    return `${capH}, ${tgl} · ${jam.replace(".", ":")}`;
  } catch {
    return at.toISOString();
  }
}

/** 3 jadwal berikutnya dari model. null bila tak terhitung. */
export function nextRuns(m: ScheduleModel, n = 3): NextRun[] | null {
  try {
    const zone = m.timezone || "Asia/Jakarta";
    const now = new Date();
    const out: NextRun[] = [];
    const hh = clamp(m.hour, 0, 23, 0);
    const mi = clamp(m.minute, 0, 59, 0);

    if (m.pattern === "once" && m.once) {
      const at = zonedToUtc(zone, m.once.y, m.once.m, m.once.d, hh, mi);
      if (at.getTime() <= now.getTime()) return [];
      return [{ at, label: idLabel(at, zone) }];
    }

    let day = new Date(now.getTime());
    for (let i = 0; i < 400 && out.length < n; i++) {
      const w = wallParts(zone, day);
      let ok = false;
      if (m.pattern === "daily") ok = true;
      else if (m.pattern === "monthly") ok = w.d === clamp(m.dayOfMonth, 1, 31, 1);
      else ok = m.days.includes(w.dow);
      if (ok) {
        const at = zonedToUtc(zone, w.y, w.mo, w.d, hh, mi);
        if (at.getTime() > now.getTime()) out.push({ at, label: idLabel(at, zone) });
      }
      day = new Date(day.getTime() + 24 * 3600 * 1000);
    }
    return out;
  } catch {
    return null;
  }
}
