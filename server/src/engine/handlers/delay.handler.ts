import type { ExecutionContext } from "../context";
import { MAX_DELAY_MS_TEST } from "../../types/workflow.types";
import { sleep } from "../retry";

export async function delayHandler(
  config: Record<string, any>,
  _ctx: ExecutionContext
): Promise<Record<string, any>> {
  let ms = Number(config.delay_ms || 0);
  if (!Number.isFinite(ms) || ms < 0) {
    throw Object.assign(new Error("delay.delay_ms harus angka >= 0"), { status: 400 });
  }
  let clamped = false;
  if (ms > MAX_DELAY_MS_TEST) {
    ms = MAX_DELAY_MS_TEST;
    clamped = true;
  }
  await sleep(Math.min(ms, MAX_DELAY_MS_TEST));
  return { delayed_ms: ms, clamped };
}
