import type { ExecutionContext } from "../context";

const FORBIDDEN =
  /\b(process|require|global|globalThis|Function|eval|import|module|exports|child_process|fs|net|Deno|Bun|constructor|__proto__|prototype)\b/;

function toValue(token: string, ctx: ExecutionContext): unknown {
  const t = token.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (t === "undefined") return undefined;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  // Sudah di-resolve oleh interpolator jadi literal, atau path mentah
  const v = ctx.getPath(t);
  return v !== undefined ? v : t;
}

// Mendukung: perbandingan tunggal atau digabung && || ! dan parentheses sederhana.
// Contoh: "{{trigger.count}} > 5 && {{step_1.body.ok}} === true"
export function evalCondition(rawExpr: string, ctx: ExecutionContext): boolean {
  if (FORBIDDEN.test(rawExpr)) {
    throw Object.assign(new Error("Expression mengandung kata terlarang"), { status: 400 });
  }

  // Pecah OR
  const orParts = splitTop(rawExpr, "||");
  for (const orPart of orParts) {
    const andParts = splitTop(orPart, "&&");
    let andResult = true;
    for (const andPart of andParts) {
      if (!evalSingle(andPart.trim(), ctx)) {
        andResult = false;
        break;
      }
    }
    if (andResult) return true;
  }
  return false;
}

function splitTop(expr: string, op: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && expr.slice(i, i + op.length) === op) {
      parts.push(cur);
      cur = "";
      i += op.length - 1;
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function evalSingle(expr: string, ctx: ExecutionContext): boolean {
  let e = expr.trim();
  let negated = false;
  while (e.startsWith("!")) {
    negated = !negated;
    e = e.slice(1).trim();
  }
  if (e.startsWith("(") && e.endsWith(")")) {
    const inner = evalCondition(e.slice(1, -1), ctx);
    return negated ? !inner : inner;
  }
  const m = e.match(/^(.+?)\s*(===|!==|>=|<=|>|<)\s*(.+)$/);
  let result: boolean;
  if (!m) {
    result = Boolean(toValue(e, ctx));
  } else {
    const [, l, op, r] = m;
    const lv: any = toValue(l, ctx);
    const rv: any = toValue(r, ctx);
    switch (op) {
      case "===": result = lv === rv; break;
      case "!==": result = lv !== rv; break;
      case ">": result = lv > rv; break;
      case "<": result = lv < rv; break;
      case ">=": result = lv >= rv; break;
      case "<=": result = lv <= rv; break;
      default: result = false;
    }
  }
  return negated ? !result : result;
}

function isEmptyVal(v: unknown): boolean {
  return v === undefined || v === null || v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
}

function applyOperator(op: string, fieldVal: unknown, cmpVal: unknown): boolean {
  switch (op) {
    case "equals": return fieldVal === cmpVal;
    case "not_equals": return fieldVal !== cmpVal;
    case "contains":
      if (typeof fieldVal === "string") return fieldVal.includes(String(cmpVal ?? ""));
      if (Array.isArray(fieldVal)) return fieldVal.includes(cmpVal);
      return false;
    case "not_contains":
      if (typeof fieldVal === "string") return !fieldVal.includes(String(cmpVal ?? ""));
      if (Array.isArray(fieldVal)) return !fieldVal.includes(cmpVal);
      return true;
    case "starts_with":
      return typeof fieldVal === "string" && fieldVal.startsWith(String(cmpVal ?? ""));
    case "ends_with":
      return typeof fieldVal === "string" && fieldVal.endsWith(String(cmpVal ?? ""));
    case "is_empty": return isEmptyVal(fieldVal);
    case "is_not_empty": return !isEmptyVal(fieldVal);
    case "gt":
      return typeof fieldVal === "number" && typeof cmpVal === "number" && fieldVal > cmpVal;
    case "gte":
      return typeof fieldVal === "number" && typeof cmpVal === "number" && fieldVal >= cmpVal;
    case "lt":
      return typeof fieldVal === "number" && typeof cmpVal === "number" && fieldVal < cmpVal;
    case "lte":
      return typeof fieldVal === "number" && typeof cmpVal === "number" && fieldVal <= cmpVal;
    case "is_true": return fieldVal === true;
    case "is_false": return fieldVal === false;
    case "exists": return fieldVal !== undefined;
    case "not_exists": return fieldVal === undefined;
    default:
      throw Object.assign(new Error(`Operator tak dikenal: ${op}`), { status: 400 });
  }
}

/**
 * Kondisi terstruktur: [{field: "{{...}}", operator, value}] + all/any.
 * Field di-resolve ke NILAI ASLI (tipe terjaga: number tetap number).
 */
export function evalStructured(
  conditions: Array<{ field: string; operator: string; value?: unknown }>,
  combinator: string,
  ctx: ExecutionContext
): boolean {
  const results = conditions.map((c) => {
    const m = String(c.field || "").trim().match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/);
    const fieldVal = m ? ctx.getPath(m[1]) : c.field;
    return applyOperator(c.operator, fieldVal, c.value);
  });
  return combinator === "any" ? results.some(Boolean) : results.every(Boolean);
}

export async function conditionHandler(
  config: Record<string, any>,
  ctx: ExecutionContext
): Promise<Record<string, any>> {
  if (Array.isArray(config.conditions) && config.conditions.length > 0) {
    const met = evalStructured(config.conditions, config.combinator === "any" ? "any" : "all", ctx);
    return { conditionMet: met, conditions: config.conditions, combinator: config.combinator || "all" };
  }
  const expr = String(config.expression || "");
  if (!expr) throw Object.assign(new Error("condition.expression wajib diisi"), { status: 400 });
  const met = evalCondition(expr, ctx);
  return { conditionMet: met, expression: expr };
}
