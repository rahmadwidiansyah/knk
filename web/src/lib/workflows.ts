import { api } from "./api";

export interface WorkflowListItem {
  id: string;
  user_id: string;
  name: string;
  description: string;
  json_config: any;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export async function listWorkflows(): Promise<WorkflowListItem[]> {
  const res = await api.get("/api/workflows");
  return res.data.workflows;
}

export async function getWorkflow(id: string): Promise<WorkflowListItem> {
  const res = await api.get(`/api/workflows/${id}`);
  return res.data.workflow;
}

export async function createWorkflow(input: { name: string; description?: string; json_config: any }) {
  const res = await api.post("/api/workflows", input);
  return res.data;
}

export async function updateWorkflow(
  id: string,
  input: { name?: string; description?: string; json_config?: any; is_active?: number }
) {
  const res = await api.put(`/api/workflows/${id}`, input);
  return res.data.workflow as WorkflowListItem;
}

export async function deleteWorkflow(id: string) {
  const res = await api.delete(`/api/workflows/${id}`);
  return res.data;
}

export async function toggleWorkflow(id: string, isActive: boolean) {
  const res = await api.post(`/api/workflows/${id}/toggle`, { is_active: isActive ? 1 : 0 });
  return res.data.workflow as WorkflowListItem;
}

export async function testWorkflow(id: string, input: any = {}) {
  const res = await api.post(`/api/workflows/${id}/test`, { input }, { timeout: 35000 });
  return res.data as { execution: any; steps: any[] };
}

export interface ExecutionFilters {
  workflow_id?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function listExecutions(params?: ExecutionFilters) {
  const res = await api.get("/api/executions", { params });
  return res.data as { executions: any[]; total: number; limit: number; offset: number };
}

export async function getWorkflowWebhook(id: string) {
  const res = await api.get(`/api/workflows/${id}/webhook`);
  return res.data as { webhook: { path: string; url: string; is_active: number } | null; scheduled: boolean };
}

export async function regenerateWebhook(id: string) {
  const res = await api.post(`/api/workflows/${id}/webhook/regenerate`);
  return res.data.webhook as { path: string; url: string };
}

export async function getExecution(id: string) {
  const res = await api.get(`/api/executions/${id}`);
  return res.data as { execution: any; steps: any[] };
}

export async function testNode(id: string, nodeId: string, input: any = {}) {
  const res = await api.post(`/api/workflows/${id}/nodes/${nodeId}/test`, { input }, { timeout: 35000 });
  return res.data as { node_id: string; output: any; duration_ms: number };
}

export function sampleWahaReply(connectorName = "waha_main"): any {
  return {
    name: "Auto Reply WhatsApp",
    description: "Balas pesan WA yang mengandung halo",
    trigger: { type: "waha_event", config: { filter: { text_contains: "halo", is_group: false } } },
    nodes: [
      {
        id: "step_1",
        type: "send_waha",
        name: "Balas ke WA",
        config: { connector_id: `{{connector.${connectorName}}}`, to: "{{trigger.chat_id}}", text: "Halo juga! Pesanmu: {{trigger.text}}" },
        next: "step_end",
      },
    ],
  };
}

export function sampleWorkflow(name = "Contoh Manual"): any {
  return {
    name,
    description: "Contoh Fase 2: condition + transform + log",
    trigger: { type: "manual", config: {} },
    nodes: [
      {
        id: "step_1",
        type: "condition",
        name: "Cek count",
        config: { expression: "{{trigger.count}} > 5" },
        next_true: "step_2",
        next_false: "step_end",
      },
      {
        id: "step_2",
        type: "transform",
        name: "Kali dua",
        config: { code: "return { doubled: input.trigger.count * 2 };" },
        next: "step_3",
      },
      {
        id: "step_3",
        type: "log",
        name: "Catat hasil",
        config: { message: "Hasil: {{step_2.doubled}}" },
        next: "step_end",
      },
    ],
  };
}
