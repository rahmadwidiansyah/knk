import type { ExecutionContext } from "../context";

export interface HandlerResult {
  output: Record<string, any>;
  next?: string;
}

export type NodeHandler = (
  config: Record<string, any>,
  ctx: ExecutionContext
) => Promise<Record<string, any>>;
