import { lookup } from "node:dns/promises";
import axios from "axios";
import type { ExecutionContext } from "../context";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 127) ||
    (a === 169 && b === 254) || // link-local (termasuk metadata cloud)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (p[2] === 0 || p[2] === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && ((b === 18 || b === 19) || (b === 51 && p[2] === 100))) ||
    (a === 203 && b === 0 && p[2] === 113) ||
    a >= 224 // multicast + reserved
  );
}

function isPrivateIP(ip: string): boolean {
  const v = ip.toLowerCase();
  // IPv6 mapped / loopback / local
  if (v.includes(":")) {
    if (v === "::1" || v === "::") return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateV4(mapped[1]);
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
    if (v.startsWith("fe80")) return true; // link-local
    return false;
  }
  return isPrivateV4(v);
}

/** Validasi hostname LEWAT hasil resolusi DNS (kebal desimal/heks/literal + DNS rebinding). */
async function assertResolvesPublic(hostname: string): Promise<void> {
  let address: string;
  try {
    ({ address } = await lookup(hostname));
  } catch {
    throw Object.assign(new Error(`Hostname tidak bisa di-resolve: ${hostname}`), { status: 400 });
  }
  if (isPrivateIP(address)) {
    throw Object.assign(new Error(`URL resolve ke IP privat (${address}), diblokir`), { status: 400 });
  }
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw Object.assign(new Error(`URL tidak valid: ${raw}`), { status: 400 });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error("URL harus http(s)"), { status: 400 });
  }
  if (u.username || u.password) {
    throw Object.assign(new Error("URL tidak boleh mengandung kredensial"), { status: 400 });
  }
  await assertResolvesPublic(u.hostname);
  return u;
}

export async function httpRequestHandler(
  config: Record<string, any>,
  _ctx: ExecutionContext
): Promise<Record<string, any>> {
  let url = String(config.url || "");
  await assertPublicUrl(url);
  const method = String(config.method || "GET").toUpperCase();
  const headers = (config.headers || {}) as Record<string, string>;
  const timeout = Math.min(Math.max(Number(config.timeout_ms || 15000), 1000), 15000);

  // Redirect diikuti manual agar tiap hop divalidasi ulang (anti SSRF via redirect).
  let res: any = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try {
      res = await axios.request({
        url,
        method: method as any,
        headers,
        data: config.body,
        timeout,
        maxRedirects: 0,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        validateStatus: () => true,
      });
    } catch (e: any) {
      if (e?.code === "ERR_BAD_RESPONSE" || /maxContentLength/i.test(e?.message || "")) {
        throw Object.assign(new Error(`Respon melebihi batas ${MAX_BYTES / 1024 / 1024} MB`), { status: 502 });
      }
      throw e;
    }
    if (res.status >= 300 && res.status < 400 && res.headers?.location && hop < MAX_REDIRECTS) {
      url = new URL(String(res.headers.location), url).toString();
      await assertPublicUrl(url);
      continue;
    }
    break;
  }

  if (res.status >= 400) {
    throw Object.assign(new Error(`HTTP ${res.status} dari ${url}`), {
      status: 502,
      responseBody: res.data,
    });
  }

  return { status: res.status, headers: res.headers, body: res.data };
}
