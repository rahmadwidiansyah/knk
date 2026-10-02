export class ExecutionContext {
  private store = new Map<string, any>();

  set(key: string, value: any): void {
    this.store.set(key, value);
  }

  get(key: string): any {
    return this.store.get(key);
  }

  getPath(dotted: string): any {
    const parts = dotted.split(".");
    let cur: any = Object.fromEntries(this.store.entries());
    for (const p of parts) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.store.entries());
  }
}
