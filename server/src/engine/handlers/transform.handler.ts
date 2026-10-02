import type { ExecutionContext } from "../context";

const FORBIDDEN =
  /\b(process|require|global|globalThis|Function|eval|import|module|exports|child_process|fs|net|Deno|Bun|fetch|axios|XMLHttpRequest|constructor|__proto__|prototype)\b/;

function frozenCopy(value: unknown): unknown {
  let clone: unknown;
  try {
    clone = JSON.parse(JSON.stringify(value));
  } catch {
    clone = value;
  }
  const freeze = (v: unknown): void => {
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) freeze((v as Record<string, unknown>)[k]);
      Object.freeze(v);
    }
  };
  freeze(clone);
  return clone;
}

export async function transformHandler(
  config: Record<string, any>,
  ctx: ExecutionContext
): Promise<Record<string, any>> {
  const code = String(config.code || "");
  if (!code) throw Object.assign(new Error("transform.code wajib diisi"), { status: 400 });
  if (FORBIDDEN.test(code)) {
    throw Object.assign(new Error("transform.code mengandung kata terlarang"), { status: 400 });
  }
  if (code.length > 8192) {
    throw Object.assign(new Error("transform.code terlalu panjang"), { status: 400 });
  }

  // Salinan beku: user code hanya baca, tak bisa mutasi context / capai constructor.
  const input = frozenCopy(ctx.getAll());
  let fn: Function;
  try {
    fn = new Function("input", `"use strict";\n${code}`);
  } catch (e: any) {
    throw Object.assign(new Error(`transform.code syntax error: ${e.message}`), { status: 400 });
  }

  const out = await Promise.race([
    (async () => fn(input))(),
    new Promise((_, rej) => setTimeout(() => rej(new Error("transform timeout 5s")), 5000)),
  ]);

  if (out !== null && typeof out === "object" && !Array.isArray(out)) return out as Record<string, any>;
  return { result: out };
}
