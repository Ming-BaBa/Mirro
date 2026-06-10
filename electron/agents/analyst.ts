import type { AgentDefinition } from "./types.js";
import type { DailyBehaviorSummary, Portrait, Stage } from "../../shared/types.js";
import { callLLM, parseJSONFromLLMResponse } from "../llm.js";

export function createAnalystAgent(): AgentDefinition {
  return {
    name: "behavior_analyst",
    description: "行为分析师，基于多维数据生成客观的角色卡",
    systemPrompt: `你是一个行为分析师。你收到用户的电脑行为数据：应用使用统计、输入量、删改率、浏览记录，以及还原后的输入内容摘要。

你的工作是从数据中发现行为模式，不做文学创作。

分析维度：
- 工作效率：从输入量、删改率、专注时长判断
- 关注主题：从还原的输入内容和浏览域名判断
- 行为节奏：从时间段分布和切换频率判断
- 状态推断：从数据模式判断用户的大致状态（专注/碎片/探索/调试等）

输出原则：
- roleName 是状态描述（如"深夜调试模式""高效产出日"），不是动物或拟人
- sketch 是基于数据的客观描述，分段叙述不同时段的行为，不编造因果关联
- 不确定的直接说"数据不足"
- 不用比喻、不拟人、不写故事`,

    tools: [
      {
        name: "calc_statistics",
        description: "计算行为统计指标",
        parameters: [
          { name: "data", type: "string", description: "行为数据 JSON", required: true }
        ],
        execute: async (args) => {
          try {
            const data = JSON.parse(String(args.data));
            const segs = data.segments || [];
            const totalInput = segs.reduce((s: number, seg: { inputChars: number }) => s + seg.inputChars, 0);
            const avgDelete = segs.length > 0
              ? segs.reduce((s: number, seg: { deleteRate: number }) => s + seg.deleteRate, 0) / segs.length
              : 0;
            const apps = [...new Set(segs.map((seg: { primaryApp: string }) => seg.primaryApp))];
            return JSON.stringify({ totalInput, avgDeleteRate: Math.round(avgDelete * 100) + "%", uniqueApps: apps, segmentCount: segs.length });
          } catch {
            return "Error parsing data.";
          }
        }
      }
    ]
  };
}

export async function runAnalyst(
  settings: import("../../shared/types.js").AppSettings,
  summary: DailyBehaviorSummary,
  portrait: Portrait,
  textSummary?: string
): Promise<Record<string, unknown>> {
  const agent = createAnalystAgent();

  const header = "时间段      | 主应用      | 输入(字) | 删字率 | 浏览域名";
  const rows = summary.segments.map(seg => {
    const domains = seg.browsingDomains.length > 0 ? seg.browsingDomains.join(", ") : "-";
    const deletePct = `${Math.round(seg.deleteRate * 100)}%`;
    return `${seg.timeRange.padEnd(12)} | ${seg.primaryApp.padEnd(10)} | ${String(seg.inputChars).padEnd(9)} | ${deletePct.padEnd(6)} | ${domains}`;
  });

  const table = [header, ...rows].join("\n");
  const portraitStr = portrait.dimensions.length > 0
    ? portrait.dimensions.map(d => `- ${d.dimension}: ${d.observation}`).join("\n")
    : "（尚无画像维度）";

  const textBlock = textSummary ? `\n输入内容摘要（拼音已还原）：\n${textSummary}\n` : "";

  const userPrompt = `以下是用户今天的行为数据：

${table}
${textBlock}
当前用户画像：
${portraitStr}

当前关系阶段：${portrait.stage}

请根据以上数据生成今日卡片。输出必须为严格 JSON 格式：

{
  "roleName": "今日状态描述（3-8字，如'深夜调试模式''高效产出日'）",
  "sketch": "行为描述（200-400字，按时间段客观叙述，不编造因果）",
  "newPuzzle": "基于今天数据的新发现（一句话）",
  "feedback": "阶段反馈",
  "confidence": 0.8
}`;

  const result = await callLLM(settings, agent.systemPrompt, userPrompt);
  return parseJSONFromLLMResponse(result);
}
