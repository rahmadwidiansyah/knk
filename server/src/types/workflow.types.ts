export type TriggerType = "webhook" | "schedule" | "manual" | "telegram_event" | "waha_event";
export type NodeType =
  | "http_request"
  | "condition"
  | "transform"
  | "delay"
  | "log"
  | "send_telegram"
  | "send_waha"
  | "send_waha_media"
  | "ai_chat";

export interface RetryConfig {
  max?: number;
  delay_ms?: number;
}

export type ConditionOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "starts_with" | "ends_with"
  | "is_empty" | "is_not_empty"
  | "gt" | "gte" | "lt" | "lte"
  | "is_true" | "is_false"
  | "exists" | "not_exists";

export interface StructuredCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface BaseNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, any>;
  next?: string;
  next_true?: string;
  next_false?: string;
  /** Fan-out: jalankan SEMUA cabang berikut setelah node sukses. */
  next_all?: string[];
  on_error?: string;
  /** Node nonaktif dilewati executor (tercatat 'skipped'). */
  disabled?: boolean;
  retry?: RetryConfig;
}

export interface WorkflowTrigger {
  type: string;
  config?: Record<string, any>;
}

export interface WorkflowConfig {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  nodes: BaseNode[];
}

export interface ExecutionResult {
  execution: {
    id: string;
    workflow_id: string;
    status: string;
    trigger_type: string;
    input_data: string | null;
    output_data: string | null;
    error_message: string | null;
    started_at: string;
    finished_at: string | null;
  };
  steps: Array<{
    id: string;
    node_id: string;
    node_name: string;
    node_type: string;
    status: string;
    input_data: string | null;
    output_data: string | null;
    error_message: string | null;
    retry_count: number;
    started_at: string | null;
    finished_at: string | null;
  }>;
}

export const END_NODE = "step_end";
export const TEST_TIMEOUT_MS = 35000;
export const MAX_DELAY_MS_TEST = 30000;
