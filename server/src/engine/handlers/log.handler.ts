import type { ExecutionContext } from "../context";

export async function logHandler(
  config: Record<string, any>,
  _ctx: ExecutionContext
): Promise<Record<string, any>> {
  const message = String(config.message ?? "");
  return { message, logged_at: new Date().toISOString() };
}

export async function futureNodeHandler(
  nodeType: string
): Promise<never> {
  const phase =
    nodeType === "ai_chat" ? "Fase 5" : "Fase 4";
  throw Object.assign(new Error(`Node '${nodeType}' belum didukung di Fase 2 (${phase})`), {
    status: 400,
  });
}
