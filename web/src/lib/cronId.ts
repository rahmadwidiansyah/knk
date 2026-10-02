export interface CronPreset {
  label: string;
  cron: string;
}

export const CRON_PRESETS: CronPreset[] = [
  { label: "Tiap menit", cron: "* * * * *" },
  { label: "Tiap jam", cron: "0 * * * *" },
  { label: "Tiap hari 00:00", cron: "0 0 * * *" },
  { label: "Tiap hari jam 07:00", cron: "0 7 * * *" },
  { label: "Tiap hari jam 22:00", cron: "0 22 * * *" },
  { label: "Tiap Senin jam 08:00", cron: "0 8 * * 1" },
];

const HARI: Record<string, string> = {
  "0": "Minggu",
  "1": "Senin",
  "2": "Selasa",
  "3": "Rabu",
  "4": "Kamis",
  "5": "Jumat",
  "6": "Sabtu",
  "7": "Minggu",
};

function pad(n: string): string {
  return n.length === 1 ? `0${n}` : n;
}

function partText(v: string, singular: string, plural: string): string {
  const t = v.trim();
  if (t === "*") return `tiap ${plural}`;
  if (t.startsWith("*/")) return `tiap ${t.slice(2)} ${plural}`;
  if (t.includes(",")) return `pada ${t} ${plural}`;
  return `${singular} ${t}`;
}

/** "0 22 * * *" → "tiap hari jam 22:00". Invalid → null. */
export function cronToIndonesian(cron: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [menit, jam, tanggal, bulan, hari] = parts;
  const num = /[\d*,/-]+/;
  if (!parts.every((p) => num.test(p))) return null;

  const jamSpesifik = jam !== "*" && !jam.includes("/") && !jam.includes(",") && !jam.includes("-");
  const menitSpesifik = menit !== "*" && !menit.includes("/") && !menit.includes(",") && !menit.includes("-");

  let kapan = "";
  if (hari !== "*") {
    const names = hari.split(",").map((h) => HARI[h] || `hari ke-${h}`);
    kapan = `tiap ${names.join(", ")}`;
  } else if (tanggal !== "*") {
    kapan = tanggal === "1" ? "tiap tanggal 1" : `tiap tanggal ${tanggal}`;
    if (bulan !== "*") kapan += ` bulan ${bulan}`;
  } else if (bulan !== "*") {
    kapan = `tiap bulan ${bulan}`;
  } else {
    kapan = "tiap hari";
  }

  const harian = tanggal === "*" && bulan === "*" && hari === "*";
  if (harian && jam === "*" && menit.startsWith("*/")) {
    return `tiap ${menit.slice(2)} menit`;
  }
  if (harian && menit === "0" && jam.startsWith("*/")) {
    return `tiap ${jam.slice(2)} jam`;
  }

  let waktu = "";
  if (jamSpesifik && menitSpesifik) {
    waktu = ` jam ${pad(jam)}:${pad(menit)}`;
  } else if (jamSpesifik) {
    waktu = ` jam ${pad(jam)} ${partText(menit, "menit", "menit")}`;
  } else if (menitSpesifik) {
    waktu = ` menit ${menit} ${partText(jam, "jam", "jam")}`;
  } else {
    const detail: string[] = [];
    if (menit !== "*") detail.push(partText(menit, "menit", "menit"));
    if (jam !== "*") detail.push(partText(jam, "jam", "jam"));
    if (detail.length > 0) waktu = ` (${detail.join(", ")})`;
  }
  return kapan + waktu;
}

export function splitCron(cron: string): [string, string, string, string, string] {
  const p = cron.trim().split(/\s+/);
  while (p.length < 5) p.push("*");
  return [p[0], p[1], p[2], p[3], p[4]];
}

export function joinCron(parts: [string, string, string, string, string]): string {
  return parts.map((p) => (p.trim() === "" ? "*" : p.trim())).join(" ");
}
