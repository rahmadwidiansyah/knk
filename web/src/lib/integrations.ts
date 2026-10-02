import { api } from "./api";

export async function listSecrets(): Promise<Array<{ id: string; key: string; has_value: boolean; created_at: string }>> {
  const res = await api.get("/api/secrets");
  return res.data.secrets;
}

export async function upsertSecret(key: string, value: string) {
  const res = await api.post("/api/secrets", { key, value });
  return res.data;
}

export async function deleteSecret(id: string) {
  const res = await api.delete(`/api/secrets/${id}`);
  return res.data;
}

export interface Connector {
  id: string;
  type: "telegram" | "waha";
  name: string;
  config: Record<string, any>;
  has_config: boolean;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export async function listConnectors(): Promise<Connector[]> {
  const res = await api.get("/api/connectors");
  return res.data.connectors;
}

export async function createConnector(input: { type: string; name: string; config: any }) {
  const res = await api.post("/api/connectors", input);
  return res.data;
}

export async function updateConnector(id: string, input: { name?: string; config?: any; is_active?: number }) {
  const res = await api.put(`/api/connectors/${id}`, input);
  return res.data.connector as Connector;
}

export async function deleteConnector(id: string) {
  const res = await api.delete(`/api/connectors/${id}`);
  return res.data;
}

export async function testConnector(id: string) {
  const res = await api.post(`/api/connectors/${id}/test`);
  return res.data;
}

export function receiverUrl(kind: "telegram" | "waha", id: string): string {
  return `${location.origin}/wh/${kind}/${id}`;
}
