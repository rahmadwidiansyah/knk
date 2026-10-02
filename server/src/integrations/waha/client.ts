import axios from "axios";

export interface WahaConfig {
  base_url: string;
  api_key?: string;
  session?: string;
}

function base(cfg: WahaConfig): string {
  return cfg.base_url.replace(/\/$/, "");
}

function headers(cfg: WahaConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.api_key) h["X-Api-Key"] = cfg.api_key;
  return h;
}

export async function wahaGetSessions(cfg: WahaConfig): Promise<any[]> {
  const res = await axios.get(`${base(cfg)}/api/sessions`, {
    headers: headers(cfg),
    timeout: 15000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw Object.assign(new Error(`WAHA sessions gagal HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`), {
      status: 502,
    });
  }
  return Array.isArray(res.data) ? res.data : [];
}

export async function wahaSendText(
  cfg: WahaConfig,
  chatId: string,
  text: string,
  session?: string
): Promise<any> {
  const res = await axios.post(
    `${base(cfg)}/api/sendText`,
    { chatId, text, session: session || cfg.session || "default" },
    { headers: headers(cfg), timeout: 15000, validateStatus: () => true }
  );
  if (res.status >= 400) {
    throw Object.assign(new Error(`WAHA sendText gagal HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 500)}`), {
      status: 502,
    });
  }
  return res.data;
}

/** Kirim gambar/file via URL publik. kind: 'image' → /api/sendImage, 'file' → /api/sendFile. */
export async function wahaSendMedia(
  cfg: WahaConfig,
  chatId: string,
  mediaUrl: string,
  opts: { kind: "image" | "file"; caption?: string; filename?: string; session?: string }
): Promise<any> {
  const session = opts.session || cfg.session || "default";
  const endpoint = opts.kind === "file" ? "/api/sendFile" : "/api/sendImage";
  const file: Record<string, string> = { url: mediaUrl };
  if (opts.filename) file.filename = opts.filename;
  const body: Record<string, any> = { chatId, file, session };
  if (opts.caption) body.caption = opts.caption;
  const res = await axios.post(`${base(cfg)}${endpoint}`, body, {
    headers: headers(cfg),
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw Object.assign(
      new Error(`WAHA ${endpoint} gagal HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 500)}`),
      { status: 502 }
    );
  }
  return res.data;
}

export async function wahaServerVersion(cfg: WahaConfig): Promise<string | null> {
  try {
    const res = await axios.get(`${base(cfg)}/api/server/version`, {
      headers: headers(cfg),
      timeout: 10000,
      validateStatus: () => true,
    });
    if (res.status === 200 && res.data) return String((res.data as any).version ?? res.data);
  } catch {
    // abaikan — kapabilitas dianggap dasar
  }
  return null;
}
