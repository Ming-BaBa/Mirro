import type { AppSettings } from "../shared/types.js";
import { ProxyAgent } from "undici";
import { execSync } from "node:child_process";
import type { AgentDefinition, AgentMessage, AgentRunConfig, ToolCall } from "./agents/types.js";

function detectProxy(): string | null {
  try {
    const out = execSync("scutil --proxy", { encoding: "utf8", timeout: 2000 });
    const host = out.match(/HTTPSProxy\s*:\s*(\S+)/);
    const port = out.match(/HTTPSPort\s*:\s*(\d+)/);
    if (host && port) return `http://${host[1]}:${port[1]}`;
  } catch { /* not macOS */ }
  return null;
}

const proxyUri = detectProxy();

function proxiedFetch(url: string, init?: RequestInit): Promise<Response> {
  if (proxyUri) {
    const agent = new ProxyAgent({ uri: proxyUri });
    return fetch(url, { ...init, dispatcher: agent } as RequestInit & { dispatcher: unknown });
  }
  return fetch(url, init);
}

const PROVIDER_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  glm: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  kimi: "https://api.moonshot.ai/v1/chat/completions",
  doubao: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  apimart: "https://api.apimart.ai/v1/chat/completions",
};

// ── Simple LLM call (no tools) ──────────────────────────────

export async function callLLM(
  settings: AppSettings,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!settings.apiKey) throw new Error("API key not configured");

  if (settings.llmProvider === "anthropic") {
    return callAnthropic(settings.apiKey, settings.model, systemPrompt, userPrompt);
  }

  const url = PROVIDER_URLS[settings.llmProvider];
  if (!url) throw new Error(`Unknown provider: ${settings.llmProvider}`);
  return callOpenAICompatible(url, settings.apiKey, settings.model, systemPrompt, userPrompt);
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await proxiedFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === "text")?.text || "";
}

async function callOpenAICompatible(url: string, apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await proxiedFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content || "";
}

// ── Agent runtime (Tool Calling loop) ───────────────────────

export async function runAgent(
  settings: AppSettings,
  agent: AgentDefinition,
  userMessage: string,
  config?: Partial<AgentRunConfig>
): Promise<string> {
  if (!settings.apiKey) throw new Error("API key not configured");

  const maxIterations = config?.maxIterations ?? 10;
  const model = config?.model ?? settings.model;

  const messages: AgentMessage[] = [
    { role: "system", content: agent.systemPrompt },
    { role: "user", content: userMessage }
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = settings.llmProvider === "anthropic"
      ? await callAnthropicWithTools(settings.apiKey, model, messages, agent.tools)
      : await callOpenAIWithTools(
          PROVIDER_URLS[settings.llmProvider] || `https://api.${settings.llmProvider}.com/v1/chat/completions`,
          settings.apiKey, model, messages, agent.tools
        );

    messages.push(response);

    // If no tool calls, we're done — return the text content
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response.content;
    }

    // Execute tool calls and add results to messages
    for (const tc of response.toolCalls) {
      const tool = agent.tools.find(t => t.name === tc.name);
      if (!tool) {
        messages.push({ role: "tool", content: `Error: unknown tool "${tc.name}"`, toolCallId: tc.id });
        continue;
      }

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.arguments);
      } catch {
        args = {};
      }

      try {
        const result = await tool.execute(args);
        messages.push({ role: "tool", content: result, toolCallId: tc.id });
      } catch (err) {
        messages.push({ role: "tool", content: `Error: ${String(err)}`, toolCallId: tc.id });
      }
    }
  }

  // Hit max iterations — return last assistant message
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
  return lastAssistant?.content || "Agent reached max iterations without completing.";
}

// ── OpenAI-compatible Tool Calling ──────────────────────────

function toolsToOpenAIFormat(tools: AgentDefinition["tools"]) {
  return tools.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          t.parameters.map(p => [p.name, { type: p.type, description: p.description }])
        ),
        required: t.parameters.filter(p => p.required !== false).map(p => p.name)
      }
    }
  }));
}

async function callOpenAIWithTools(
  url: string, apiKey: string, model: string,
  messages: AgentMessage[], tools: AgentDefinition["tools"]
): Promise<AgentMessage> {
  const openaiMessages = messages.map(m => {
    if (m.role === "tool") {
      return { role: "tool" as const, content: m.content, tool_call_id: m.toolCallId };
    }
    if (m.role === "assistant" && m.toolCalls) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: m.toolCalls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments }
        }))
      };
    }
    return { role: m.role, content: m.content };
  });

  const res = await proxiedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: openaiMessages,
      tools: toolsToOpenAIFormat(tools)
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI Tool Calling error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
  };

  const msg = data.choices[0]?.message;
  const toolCalls: ToolCall[] = (msg?.tool_calls || []).map(tc => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments
  }));

  return {
    role: "assistant",
    content: msg?.content || "",
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined
  };
}

// ── Anthropic Tool Calling ──────────────────────────────────

function toolsToAnthropicFormat(tools: AgentDefinition["tools"]) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        t.parameters.map(p => [p.name, { type: p.type, description: p.description }])
      ),
      required: t.parameters.filter(p => p.required !== false).map(p => p.name)
    }
  }));
}

async function callAnthropicWithTools(
  apiKey: string, model: string,
  messages: AgentMessage[], tools: AgentDefinition["tools"]
): Promise<AgentMessage> {
  const systemMsg = messages.find(m => m.role === "system")?.content || "";
  const nonSystem = messages.filter(m => m.role !== "system");

  const anthropicMessages: unknown[] = [];
  for (const m of nonSystem) {
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const content: unknown[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: JSON.parse(tc.arguments) });
      }
      anthropicMessages.push({ role: "assistant", content });
    } else if (m.role === "tool") {
      anthropicMessages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }]
      });
    } else {
      anthropicMessages.push({ role: m.role, content: m.content });
    }
  }

  const res = await proxiedFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemMsg,
      messages: anthropicMessages,
      tools: toolsToAnthropicFormat(tools)
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic Tool Calling error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[]
  };

  const textParts = data.content.filter(c => c.type === "text").map(c => c.text).join("");
  const toolUseParts = data.content.filter(c => c.type === "tool_use");

  const toolCalls: ToolCall[] = toolUseParts.map(c => ({
    id: c.id!,
    name: c.name!,
    arguments: JSON.stringify(c.input || {})
  }));

  return {
    role: "assistant",
    content: textParts,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined
  };
}

// ── Image generation ────────────────────────────────────────

const APIMART_BASE = "https://api.apimart.ai/v1beta/models";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export async function generateImage(settings: AppSettings, prompt: string): Promise<string> {
  if (!settings.imageApiKey) throw new Error("Image API key not configured");

  const model = settings.imageModel || "gemini-3-pro-image-preview";
  const url = `${APIMART_BASE}/${model}:generateContent`;
  const res = await proxiedFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.imageApiKey}`
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.text) {
      const m = part.text.match(/!\[.*?\]\(data:image\/\w+;base64,([A-Za-z0-9+/=]+)\)/);
      if (m) return m[1];
    }
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }

  throw new Error("No image data in response");
}

export function parseJSONFromLLMResponse(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```$/i, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    const preview = text.slice(0, 500);
    throw new Error(`No JSON found in LLM response. Raw (first 500 chars): ${preview}`);
  }

  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`JSON parse error: ${String(e)}. JSON string (first 500 chars): ${jsonStr.slice(0, 500)}`);
  }
}
