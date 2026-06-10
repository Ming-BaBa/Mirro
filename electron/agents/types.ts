// Agent type definitions for Mirro's Tool Calling architecture.

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolDefinition[];
}

// LLM protocol types (provider-agnostic)

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string; // for role="tool" messages
}

export interface AgentRunConfig {
  maxIterations: number;
  model?: string;
}
