import { z } from "zod";

const retrySchema = z
  .object({
    max: z.number().int().min(0).max(3).optional(),
    delay_ms: z.number().int().min(0).max(30000).optional(),
  })
  .strict()
  .optional();

const baseNode = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(128),
  config: z.record(z.any()).default({}),
  next: z.string().min(1).max(64).optional(),
  next_true: z.string().min(1).max(64).optional(),
  next_false: z.string().min(1).max(64).optional(),
  next_all: z.array(z.string().min(1).max(64)).max(10).optional(),
  on_error: z.string().min(1).max(64).optional(),
  disabled: z.boolean().optional(),
  retry: retrySchema,
});

const CONDITION_OPERATORS = [
  "equals", "not_equals",
  "contains", "not_contains",
  "starts_with", "ends_with",
  "is_empty", "is_not_empty",
  "gt", "gte", "lt", "lte",
  "is_true", "is_false",
  "exists", "not_exists",
] as const;

const structuredCondition = z.object({
  field: z.string().min(1).max(1024),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.any().optional(),
});

const httpRequestNode = baseNode.extend({
  type: z.literal("http_request"),
  config: z
    .object({
      url: z.string().min(1).max(2048),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
      headers: z.record(z.string()).optional().default({}),
      body: z.any().optional(),
      timeout_ms: z.number().int().min(1000).max(15000).optional(),
    })
    .passthrough(),
  next: z.string().min(1).max(64).optional(),
});

const conditionNode = baseNode.extend({
  type: z.literal("condition"),
  config: z
    .object({
      expression: z.string().min(1).max(2048).optional(),
      conditions: z.array(structuredCondition).min(1).max(10).optional(),
      combinator: z.enum(["all", "any"]).optional().default("all"),
    })
    .passthrough()
    .superRefine((c: any, ctx) => {
      const hasExpr = typeof c.expression === "string" && c.expression.trim().length > 0;
      const hasStruct = Array.isArray(c.conditions) && c.conditions.length > 0;
      if (!hasExpr && !hasStruct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "condition butuh expression atau conditions terstruktur",
          path: ["expression"],
        });
      }
    }),
  next_true: z.string().min(1).max(64),
  next_false: z.string().min(1).max(64),
});

const transformNode = baseNode.extend({
  type: z.literal("transform"),
  config: z.object({ code: z.string().min(1).max(8192) }).passthrough(),
  next: z.string().min(1).max(64).optional(),
});

const delayNode = baseNode.extend({
  type: z.literal("delay"),
  config: z.object({ delay_ms: z.number().int().min(0).max(600000) }).passthrough(),
  next: z.string().min(1).max(64).optional(),
});

const logNode = baseNode.extend({
  type: z.literal("log"),
  config: z.object({ message: z.string().min(1).max(2048) }).passthrough(),
  next: z.string().min(1).max(64).optional(),
});

const sendTelegramNode = baseNode.extend({
  type: z.literal("send_telegram"),
  config: z
    .object({
      connector_id: z.string().min(1).max(128),
      chat_id: z.union([z.string().min(1).max(64), z.number()]).optional(),
      chatId: z.union([z.string().min(1).max(64), z.number()]).optional(),
      text: z.string().min(1).max(4000),
      parse_mode: z.enum(["HTML", "Markdown", "MarkdownV2"]).optional(),
    })
    .passthrough()
    .superRefine((c: any, ctx) => {
      if (c.chat_id === undefined && c.chatId === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "send_telegram butuh chat_id", path: ["chat_id"] });
      }
    }),
  next: z.string().min(1).max(64).optional(),
});

const sendWahaNode = baseNode.extend({
  type: z.literal("send_waha"),
  config: z
    .object({
      connector_id: z.string().min(1).max(128),
      to: z.string().min(1).max(64).optional(),
      chat_id: z.string().min(1).max(64).optional(),
      chatId: z.string().min(1).max(64).optional(),
      text: z.string().min(1).max(4000),
      session: z.string().min(1).max(64).optional(),
    })
    .passthrough()
    .superRefine((c: any, ctx) => {
      if (!c.to && !c.chat_id && !c.chatId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "send_waha butuh to/chat_id", path: ["to"] });
      }
    }),
  next: z.string().min(1).max(64).optional(),
});

const sendWahaMediaNode = baseNode.extend({
  type: z.literal("send_waha_media"),
  config: z
    .object({
      connector_id: z.string().min(1).max(128),
      to: z.string().min(1).max(64).optional(),
      chat_id: z.string().min(1).max(64).optional(),
      chatId: z.string().min(1).max(64).optional(),
      media_url: z.string().min(1).max(2048),
      media_type: z.enum(["image", "file"]).optional().default("image"),
      caption: z.string().max(1024).optional(),
      session: z.string().min(1).max(64).optional(),
    })
    .passthrough()
    .superRefine((c: any, ctx) => {
      if (!c.to && !c.chat_id && !c.chatId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "send_waha_media butuh to/chat_id", path: ["to"] });
      }
    }),
  next: z.string().min(1).max(64).optional(),
});

// AI: tetap placeholder Fase 5
const futureNode = baseNode.extend({
  type: z.enum(["ai_chat"]),
});

const nodeSchema = z.discriminatedUnion("type", [
  httpRequestNode,
  conditionNode,
  transformNode,
  delayNode,
  logNode,
  sendTelegramNode,
  sendWahaNode,
  sendWahaMediaNode,
  futureNode,
]);

const CRON_5FIELD =
  /^\s*(\*|(?:\*\/\d+)|(?:\d+(?:-\d+)?(?:\/\d+)?)(?:,\d+(?:-\d+)?(?:\/\d+)?)*)\s+(\*|(?:\*\/\d+)|(?:\d+(?:-\d+)?(?:\/\d+)?)(?:,\d+(?:-\d+)?(?:\/\d+)?)*)\s+(\*|(?:\*\/\d+)|(?:\d+(?:-\d+)?(?:\/\d+)?)(?:,\d+(?:-\d+)?(?:\/\d+)?)*)\s+(\*|(?:\*\/\d+)|(?:\d+(?:-\d+)?(?:\/\d+)?)(?:,\d+(?:-\d+)?(?:\/\d+)?)*)\s+(\*|(?:\*\/\d+)|(?:\d+(?:-\d+)?(?:\/\d+)?)(?:,\d+(?:-\d+)?(?:\/\d+)?)*)\s*$/;

const triggerSchema = z
  .object({
    type: z.enum(["webhook", "schedule", "manual", "telegram_event", "waha_event"]),
    config: z.record(z.any()).optional().default({}),
  })
  .superRefine((t, ctx) => {
    if (t.type === "webhook") {
      const methods = (t.config as any)?.methods;
      if (methods !== undefined) {
        if (!Array.isArray(methods) || methods.length === 0 || methods.length > 5 ||
          methods.some((m: any) => !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(m))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "trigger.config.methods harus subset dari GET/POST/PUT/PATCH/DELETE",
            path: ["config", "methods"],
          });
        }
      }
      const secret = (t.config as any)?.secret;
      if (secret !== undefined && (typeof secret !== "string" || !secret.trim() || secret.length > 256)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "trigger.config.secret harus string tak-kosong maks 256 char",
          path: ["config", "secret"],
        });
      }
    }
    if (t.type === "schedule") {
      const cron = (t.config as any)?.cron;
      if (typeof cron !== "string" || !cron.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "trigger.config.cron wajib diisi (contoh '*/5 * * * *')",
          path: ["config", "cron"],
        });
        return;
      }
      if (cron.trim().startsWith("@")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Format @reboot/@daily tidak didukung, pakai 5 field eksplisit",
          path: ["config", "cron"],
        });
        return;
      }
      if (!CRON_5FIELD.test(cron.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Format cron harus 5 field: menit jam tanggal bulan hari (contoh '*/5 * * * *')",
          path: ["config", "cron"],
        });
      }
      const tz = (t.config as any)?.timezone;
      if (tz !== undefined && (typeof tz !== "string" || !tz.trim() || tz.length > 64)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "trigger.config.timezone harus string IANA valid (contoh 'Asia/Jakarta')",
          path: ["config", "timezone"],
        });
      }
    }
    if (t.type === "telegram_event" || t.type === "waha_event") {
      const cid = (t.config as any)?.connector_id;
      if (cid !== undefined && (typeof cid !== "string" || !cid.trim() || cid.length > 128)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "trigger.config.connector_id harus string tak-kosong maks 128 char",
          path: ["config", "connector_id"],
        });
      }
      const f = (t.config as any)?.filter;
      if (f !== undefined) {
        if (typeof f !== "object" || Array.isArray(f)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "trigger.config.filter harus object",
            path: ["config", "filter"],
          });
          return;
        }
        if (f.chats !== undefined && (!Array.isArray(f.chats) || f.chats.some((c: any) => typeof c !== "string"))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "filter.chats harus array string chat_id",
            path: ["config", "filter", "chats"],
          });
        }
        for (const k of ["connector_id", "text_contains", "text_equals"] as const) {
          if (f[k] !== undefined && typeof f[k] !== "string") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `filter.${k} harus string`,
              path: ["config", "filter", k],
            });
          }
        }
        if (f.is_group !== undefined && typeof f.is_group !== "boolean") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "filter.is_group harus boolean",
            path: ["config", "filter", "is_group"],
          });
        }
      }
    }
  });

export const workflowConfigSchema = z
  .object({
    name: z.string().min(1).max(128),
    description: z.string().max(1024).optional().default(""),
    trigger: triggerSchema,
    nodes: z.array(nodeSchema).min(1).max(50),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.nodes.map((n) => n.id));
    if (ids.size !== cfg.nodes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Node id harus unik", path: ["nodes"] });
    }
    const validTarget = (t?: string) => !t || t === "step_end" || ids.has(t);
    for (let i = 0; i < cfg.nodes.length; i++) {
      const n: any = cfg.nodes[i];
      for (const f of ["next", "next_true", "next_false", "on_error"] as const) {
        if (!validTarget(n[f])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Node '${n.id}.${f}' menunjuk ke id tak dikenal '${n[f]}'`,
            path: ["nodes", i, f],
          });
        }
      }
      const nextAll: unknown = (n as any).next_all;
      if (nextAll !== undefined) {
        if (!Array.isArray(nextAll)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Node '${n.id}.next_all' harus array id node`,
            path: ["nodes", i, "next_all"],
          });
        } else {
          const seen = new Set<string>();
          for (const t of nextAll as string[]) {
            if (!validTarget(t)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Node '${n.id}.next_all' menunjuk ke id tak dikenal '${t}'`,
                path: ["nodes", i, "next_all"],
              });
            } else if (t !== "step_end") {
              if (seen.has(t)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Node '${n.id}.next_all' duplikat target '${t}'`,
                  path: ["nodes", i, "next_all"],
                });
              }
              seen.add(t);
            }
          }
        }
      }
    }
    // Deteksi siklus pada jalur normal (on_error dikecualikan: itu jalur error, bukan loop).
    const adj = new Map<string, string[]>();
    for (const n of cfg.nodes as any[]) {
      const outs: string[] = [];
      for (const f of ["next", "next_true", "next_false"] as const) {
        if (n[f] && n[f] !== "step_end" && ids.has(n[f])) outs.push(n[f]);
      }
      if (Array.isArray(n.next_all)) {
        for (const t of n.next_all) {
          if (t !== "step_end" && ids.has(t)) outs.push(t);
        }
      }
      adj.set(n.id, outs);
    }
    const state = new Map<string, number>(); // 0=unvisited,1=in-stack,2=done
    const stack: string[] = [];
    let cycle: string[] | null = null;
    const visit = (id: string): boolean => {
      state.set(id, 1);
      stack.push(id);
      for (const t of adj.get(id) || []) {
        if (state.get(t) === 1) {
          cycle = [...stack.slice(stack.indexOf(t)), t];
          return true;
        }
        if (!state.get(t) && visit(t)) return true;
      }
      stack.pop();
      state.set(id, 2);
      return false;
    };
    for (const n of cfg.nodes) {
      if (!state.get(n.id) && visit(n.id)) break;
    }
    const foundCycle: string[] = Array.isArray(cycle) ? cycle : [];
    if (foundCycle.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Siklus terdeteksi (tak didukung): ${foundCycle.join(" → ")}. Putus salah satu koneksi.`,
        path: ["nodes"],
      });
    }
  });

export type WorkflowConfigInput = z.infer<typeof workflowConfigSchema>;

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional().default(""),
  json_config: z.any(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(1024).optional(),
  json_config: z.any().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});
