import { ExecutionContext } from "./context";

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function isPrivilegedRef(path: string): boolean {
  return path === "secrets" || path.startsWith("secrets.") || path === "connector" || path.startsWith("connector.");
}

export function resolveValue(value: unknown, ctx: ExecutionContext): unknown {
  if (typeof value === "string") {
    const full = value.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/);
    if (full) {
      const v = ctx.getPath(full[1]);
      if (v === undefined && isPrivilegedRef(full[1])) {
        const kind = full[1].startsWith("secrets") ? "Secret" : "Connector";
        throw Object.assign(new Error(`${kind} '${full[1]}' tidak ditemukan`), { status: 400 });
      }
      return v;
    }
    return value.replace(PLACEHOLDER, (_m, p1: string) => {
      const v = ctx.getPath(p1);
      if (v === undefined || v === null) {
        if (isPrivilegedRef(p1)) {
          const kind = p1.startsWith("secrets") ? "Secret" : "Connector";
          throw Object.assign(new Error(`${kind} '${p1}' tidak ditemukan`), { status: 400 });
        }
        return "";
      }
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveValue(v, ctx);
    return out;
  }
  return value;
}

export function resolveConfig(config: Record<string, any>, ctx: ExecutionContext): Record<string, any> {
  return resolveValue(config, ctx) as Record<string, any>;
}
