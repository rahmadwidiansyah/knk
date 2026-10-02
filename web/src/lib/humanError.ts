/** Ubah error teknis jadi bahasa manusia. Kembalikan { title, hint, technical }. */

export interface FriendlyError {
  title: string;
  hint: string;
  technical: string;
}

export function humanError(err: any): FriendlyError {
  const raw: string =
    err?.response?.data?.error || err?.message || "Terjadi kesalahan";
  const technical = err?.response?.data?.details
    ? `${raw}\n${JSON.stringify(err.response.data.details, null, 2).slice(0, 800)}`
    : raw;
  const low = raw.toLowerCase();

  if (!err?.response) {
    return {
      title: "Tidak dapat terhubung ke server",
      hint: "Server tidak merespons. Periksa container lightflow jalan dan koneksi jaringan.",
      technical,
    };
  }
  if (err?.response?.status === 401) {
    return { title: "Sesi berakhir", hint: "Silakan masuk kembali.", technical };
  }
  if (err?.response?.status === 504) {
    return {
      title: "Test kehabisan waktu",
      hint: "Workflow berjalan lebih dari ~35 detik (mungkin delay panjang). Cek halaman Runs untuk hasilnya.",
      technical,
    };
  }
  if (low.includes("timeout")) {
    return {
      title: "Tujuan tidak merespons dalam 15 detik",
      hint: "Periksa apakah layanan tujuan (mis. WAHA) aktif dan dapat diakses. Coba Test connector.",
      technical,
    };
  }
  if (low.includes("econnrefused") || low.includes("enotfound") || low.includes("network")) {
    return {
      title: "Tidak dapat terhubung ke server tujuan",
      hint: "Alamat tidak bisa dijangkau dari server LightFlow. Periksa URL dan jaringan.",
      technical,
    };
  }
  if (low.includes("session status is not as expected") || low.includes("session")) {
    return {
      title: "Session WhatsApp belum siap",
      hint: "Buka dashboard WAHA dan pastikan session berstatus WORKING (scan QR bila perlu), lalu coba lagi.",
      technical,
    };
  }
  if (low.includes("sendmessage") || low.includes("telegram")) {
    return {
      title: "Telegram menolak pesan",
      hint: "Periksa bot token, chat ID, dan apakah bot sudah di-start oleh penerima.",
      technical,
    };
  }
  if (low.includes("chat not found") || low.includes("can't parse")) {
    return {
      title: "Chat atau format pesan salah",
      hint: "Periksa chat ID tujuan dan isi pesan.",
      technical,
    };
  }
  if (low.includes("api key") || low.includes("unauthorized") || low.includes("401")) {
    return {
      title: "API key tidak valid",
      hint: "Periksa secret / API key yang dipakai workflow ini.",
      technical,
    };
  }
  if (low.includes("tidak valid") || err?.response?.status === 400) {
    return { title: "Ada yang belum benar", hint: raw, technical };
  }
  if (low.includes("tidak ditemukan") || err?.response?.status === 404) {
    return { title: "Data tidak ditemukan", hint: raw, technical };
  }
  return { title: "Terjadi kesalahan", hint: raw, technical };
}

/** Bersihkan prefix "[node_id] " dari error execution agar enak dibaca. */
export function cleanExecutionError(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/^\[[^\]]+\]\s*/, "").trim();
}

/** Error execution → kalimat manusiawi satu baris untuk list. */
export function executionErrorLine(raw?: string | null): string {
  const cleaned = cleanExecutionError(raw);
  if (!cleaned) return "";
  const friendly = humanError({ response: { data: { error: cleaned } } });
  return friendly.title === "Terjadi kesalahan" ? cleaned.slice(0, 90) : friendly.title;
}
