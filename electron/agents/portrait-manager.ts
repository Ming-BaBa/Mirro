import type { AgentDefinition } from "./types.js";
import type { DailyBehaviorSummary, Portrait } from "../../shared/types.js";
import { callLLM, parseJSONFromLLMResponse } from "../llm.js";

export function createPortraitManagerAgent(): AgentDefinition {
  return {
    name: "portrait_manager",
    description: "画像管理员，根据数据判断是否需要更新用户画像维度",
    systemPrompt: `你是一个用户画像管理员。你收到今日的行为数据和当前画像，判断是否需要更新画像。

核心原则：
1. 优先修改（modifications）已有维度，而非新增。只有出现全新维度的信息时才 additions。
2. modifications 时，把新观察融入已有描述，形成累积总结，而非简单替换。
   例：已有"倾向于白天工作"→ 更新为"通常白天工作，但偶尔深夜也有活动高峰"。
3. 维度名保持宽泛，如"输入习惯""活跃时段""主要工具""注意力分布"，避免每天一个新维度名。
4. 如果今日数据与已有画像一致，不需要任何变更。输出空的 additions/modifications/removals。
5. 不要生成没有实质意义的更新。每条变更都必须包含新的信息增量。

删除维度要说明理由。`,

    tools: []
  };
}

export async function runPortraitUpdate(
  settings: import("../../shared/types.js").AppSettings,
  summary: DailyBehaviorSummary,
  portrait: Portrait
): Promise<Record<string, unknown>> {
  const agent = createPortraitManagerAgent();

  const header = "时间段      | 主应用      | 输入(字) | 删字率 | 浏览域名";
  const rows = summary.segments.map(seg => {
    const domains = seg.browsingDomains.length > 0 ? seg.browsingDomains.join(", ") : "-";
    const deletePct = `${Math.round(seg.deleteRate * 100)}%`;
    return `${seg.timeRange.padEnd(12)} | ${seg.primaryApp.padEnd(10)} | ${String(seg.inputChars).padEnd(9)} | ${deletePct.padEnd(6)} | ${domains}`;
  });
  const table = [header, ...rows].join("\n");

  const portraitStr = portrait.dimensions.length > 0
    ? JSON.stringify(portrait.dimensions, null, 2)
    : "[]";

  const userPrompt = `行为摘要：
${table}

当前画像维度（共 ${portrait.dimensions.length} 条）：
${portraitStr}

当前阶段：${portrait.stage}

请判断是否需要更新画像。输出必须为严格 JSON 格式：

{
  "additions": [{"dimension": "维度名", "observation": "观察依据"}],
  "modifications": [{"dimension": "已有维度名", "updatedTo": "融合新观察后的完整描述"}],
  "removals": ["要移除的维度名"],
  "stageRecommendation": "stay" | "advance" | "regress"
}

记住：优先 modifications 已有维度。无变化时所有数组留空。每条变更都必须有实质信息增量。`;

  const result = await callLLM(settings, agent.systemPrompt, userPrompt);
  return parseJSONFromLLMResponse(result);
}
