import type { AgentDefinition } from "./types.js";
import type { AppSettings } from "../../shared/types.js";
import { callLLM } from "../llm.js";

export function createInterpreterAgent(settings: AppSettings): AgentDefinition {
  return {
    name: "text_interpreter",
    description: "语言还原师，将拼音/英文输入结合应用上下文还原为中文内容摘要",
    systemPrompt: `你是一个语言还原助手。用户在电脑上输入文字，由于键盘监听只捕获物理按键，中文输入法场景下只能拿到拼音序列。

你的任务：根据拼音序列 + 应用上下文，推断用户实际输入的中文内容。

规则：
1. 每段文本前标注了来源应用，结合应用判断内容类型
2. VS Code/终端 → 可能是代码注释、终端命令、搜索关键词
3. Chrome → 可能是搜索关键词、表单输入
4. 微信/聊天工具 → 可能是聊天消息
5. 拼音序列结合上下文推断最可能的中文，无法确定的保留原始拼音
6. 跳过纯代码、快捷键、无意义重复
7. 按应用分组输出，每组1-3句话概括用户在做什么
8. 总字数控制在100-200字

直接输出中文摘要，不要输出 JSON。`,

    tools: [
      {
        name: "restore_pinyin",
        description: "将一段拼音文本还原为最可能的中文",
        parameters: [
          { name: "text", type: "string", description: "拼音文本", required: true },
          { name: "app", type: "string", description: "来源应用名", required: true }
        ],
        execute: async (args) => {
          const text = String(args.text);
          const app = String(args.app);
          // Use LLM to restore pinyin — but as a simple tool, we return the raw text
          // with app context hint so the parent agent can use it
          return `[${app}] ${text}`;
        }
      },
      {
        name: "summarize_content",
        description: "将多段还原后的内容生成简洁摘要",
        parameters: [
          { name: "items", type: "string", description: "各应用的内容，JSON数组格式", required: true }
        ],
        execute: async (args) => {
          try {
            const items = JSON.parse(String(args.items));
            const lines = items.map((it: { app: string; content: string }) => `[${it.app}] ${it.content}`);
            return lines.join("\n");
          } catch {
            return String(args.items);
          }
        }
      }
    ]
  };
}

// Convenience function: run interpreter as a direct LLM call (no tool loop needed)
export async function runInterpreter(settings: AppSettings, sanitizedText: string): Promise<string> {
  if (!sanitizedText || sanitizedText.trim().length === 0) return "";

  const prompt = `以下是用户全天在不同应用中的输入记录（已脱敏，含应用标签）。
由于键盘监听只捕获物理按键，中文输入法下显示为拼音。

请按应用分组，推断用户在做什么，每组1-3句中文概括。跳过无意义内容。100-200字。

${sanitizedText.slice(0, 4000)}`;

  return callLLM(settings, createInterpreterAgent(settings).systemPrompt, prompt);
}
