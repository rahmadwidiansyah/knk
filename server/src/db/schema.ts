import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// USERS
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  isActive: integer("is_active").notNull().default(1),
  displayName: text("display_name"), // nullable, optional
  themePreference: text("theme_preference").notNull().default("system"), // 'light' | 'dark' | 'system'
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// WORKFLOWS
export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  jsonConfig: text("json_config").notNull(),
  isActive: integer("is_active").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// EXECUTIONS
export const executions = sqliteTable("executions", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => workflows.id),
  status: text("status").notNull().default("running"),
  triggerType: text("trigger_type").notNull(),
  inputData: text("input_data"),
  outputData: text("output_data"),
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});

// EXECUTION STEPS
export const executionSteps = sqliteTable("execution_steps", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => executions.id),
  nodeId: text("node_id").notNull(),
  nodeName: text("node_name").notNull(),
  nodeType: text("node_type").notNull(),
  status: text("status").notNull().default("pending"),
  inputData: text("input_data"),
  outputData: text("output_data"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
});

// CONNECTORS
export const connectors = sqliteTable("connectors", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'telegram' | 'waha'
  name: text("name").notNull(),
  config: text("config").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// WEBHOOKS
export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => workflows.id),
  path: text("path").notNull().unique(),
  method: text("method").notNull().default("POST"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

// SECRETS
export const secrets = sqliteTable("secrets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  key: text("key").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt: text("created_at").notNull(),
});

export type UserRole = "admin" | "user";
