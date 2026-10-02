export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  max = 0,
  delayMs = 1000,
  onRetry?: (attempt: number, err: unknown) => void
): Promise<{ result: T; attempts: number }> {
  const cappedMax = Math.min(Math.max(max, 0), 3);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= cappedMax; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (e) {
      lastErr = e;
      if (attempt === cappedMax) break;
      onRetry?.(attempt, e);
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastErr;
}
