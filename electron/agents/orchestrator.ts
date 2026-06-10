import type { AgentDefinition } from "./types.js";
import type Database from "better-sqlite3";
import { createDbTools } from "../tools/db-queries.js";
import { sanitizeSegments } from "../sanitizer.js";

export function createOrchestrator(db: ReturnType<typeof Database>): AgentDefinition {
  const dbTools = createDbTools(db);

  return {
    name: "orchestrator",
    description: "分析协调员，规划每日分析任务并协调子 Agent 执行",
    systemPrompt: `你是 Mirro 的分析协调员。每天你收到任务，需要规划分析步骤并调用工具完成。

你的工作流程：
1. 先查询今日的行为数据和文本数据
2. 根据数据量决定分析深度：
   - 数据极少（总输入 < 100 字）→ 只生成简化卡片
   - 数据正常 → 完整执行文本解读 → 行为分析 → 画像更新
3. 调用子 Agent 完成具体分析任务
4. 保存最终结果

决策原则：
- 数据不足就直说，不要编造
- 某个步骤失败就跳过继续
- 最终输出必须是有效的 JSON`,

    tools: [
      {
        name: "query_behavior",
        description: "查询指定日期的行为统计数据（应用使用、输入量、删改率、浏览域名）",
        parameters: [
          { name: "date", type: "string", description: "日期，格式 YYYY-MM-DD", required: true }
        ],
        execute: async (args) => {
          const data = dbTools.queryBehavior(String(args.date));
          return data ? JSON.stringify(data) : "No data found for this date.";
        }
      },
      {
        name: "query_text",
        description: "查询指定日期的脱敏输入文本",
        parameters: [
          { name: "date", type: "string", description: "日期，格式 YYYY-MM-DD", required: true }
        ],
        execute: async (args) => {
          const raw = dbTools.queryText(String(args.date));
          if (!raw) return "No typed text found.";
          // Run sanitizer
          const segments = raw.split("\n").map(line => {
            const match = line.match(/^\[(.+?)\] (.+)$/);
            return { typedText: match?.[2] || line, primaryApp: match?.[1] || "Unknown" };
          });
          return sanitizeSegments(segments) || "No meaningful text after sanitization.";
        }
      },
      {
        name: "query_portrait",
        description: "查询当前用户画像（维度列表、关系阶段）",
        parameters: [],
        execute: async () => {
          return JSON.stringify(dbTools.queryPortrait());
        }
      },
      {
        name: "get_today_date",
        description: "获取今天的日期",
        parameters: [],
        execute: async () => {
          return dbTools.getTodayDate();
        }
      }
    ]
  };
}
