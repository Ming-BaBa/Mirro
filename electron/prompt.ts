import type { DailyBehaviorSummary, Portrait, Stage, BehaviorSegment, PortraitDimension } from "../shared/types.js";

// ── Stage 1: Text Restoration ───────────────────────────────

export function buildTextSummaryPrompt(sanitizedText: string): string {
  return `你是一个语言还原助手。用户在电脑上输入文字，由于键盘监听只捕获物理按键，中文输入法场景下只能拿到拼音序列。

你的任务：根据拼音序列 + 应用上下文，推断用户实际输入的中文内容。

规则：
1. 每段文本前标注了来源应用（如 [VS Code]、[Chrome]、[微信]），结合应用判断内容类型
2. VS Code/终端中的内容可能是：代码注释、终端命令、搜索关键词
3. Chrome 中的内容可能是：搜索关键词、表单输入
4. 微信/聊天工具中的内容可能是：聊天消息
5. 对于拼音序列，结合上下文推断最可能的中文。如果无法确定，保留原始拼音并用括号标注可能的中文
6. 跳过纯代码、快捷键、无意义重复
7. 按应用分组输出，每组1-3句话概括用户在做什么
8. 总字数控制在100-200字

输入内容（已脱敏，含应用标签）：

${sanitizedText.slice(0, 4000)}`;
}

// ── Stage 2: Behavior Analysis & Card Generation ────────────

export function buildSystemPrompt(): string {
  return `你是一个行为分析师。你收到用户的电脑行为数据：应用使用统计、输入量、删改率、浏览记录，以及还原后的输入内容摘要。

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
- 不用比喻、不拟人、不写故事`;
}

function formatSummaryTable(summary: DailyBehaviorSummary): string {
  const header = "时间段      | 主应用      | 输入(字) | 删字率 | 浏览域名";
  const rows = summary.segments.map((seg: import("../shared/types.js").BehaviorSegment) => {
    const domains = seg.browsingDomains.length > 0 ? seg.browsingDomains.join(", ") : "-";
    const deletePct = `${Math.round(seg.deleteRate * 100)}%`;
    return `${seg.timeRange.padEnd(12)} | ${seg.primaryApp.padEnd(10)} | ${String(seg.inputChars).padEnd(9)} | ${deletePct.padEnd(6)} | ${domains}`;
  });
  return [header, ...rows].join("\n");
}

export function buildDailyCardPrompt(
  summary: DailyBehaviorSummary,
  portrait: Portrait,
  stage: Stage,
  textSummary?: string
): string {
  const table = formatSummaryTable(summary);
  const portraitStr = portrait.dimensions.length > 0
    ? portrait.dimensions.map((d: import("../shared/types.js").PortraitDimension) => `- ${d.dimension}: ${d.observation}`).join("\n")
    : "（尚无画像维度）";

  const textBlock = textSummary
    ? `\n输入内容摘要（拼音已还原为中文）：\n${textSummary}\n`
    : "";

  return `以下是用户今天的行为数据：

${table}
${textBlock}
当前用户画像：
${portraitStr}

当前关系阶段：${stage}

请根据以上数据生成今日卡片。输出必须为严格 JSON 格式：

{
  "roleName": "今日状态描述（3-8字，描述整体工作状态，如'深夜调试模式''高效产出日''碎片浏览日'）",
  "sketch": "行为描述（200-400字，按时间段客观叙述：主要用了什么应用、做了什么类型的工作、输入量如何、有没有明显的行为模式。不同时段之间如果无明显关联就分别描述，不要强行串联）",
  "newPuzzle": "基于今天数据的新发现（一句话，基于事实，不确定就写'数据不足')",
  "feedback": "阶段反馈（观察期用陈述式，熟悉期可引用历史，亲密期可给建议）",
  "confidence": 0.8
}`;
}

export function buildPortraitUpdatePrompt(
  summary: DailyBehaviorSummary,
  portrait: Portrait
): string {
  const portraitStr = portrait.dimensions.length > 0
    ? JSON.stringify(portrait.dimensions, null, 2)
    : "[]";

  const table = formatSummaryTable(summary);

  return `行为摘要：
${table}

当前画像维度：
${portraitStr}

当前阶段：${portrait.stage}

请判断是否需要更新画像。画像维度不做预定义，你自行决定加什么、删什么。
输出必须为严格 JSON 格式：

{
  "additions": [{"dimension": "维度名", "observation": "观察依据"}],
  "modifications": [{"dimension": "维度名", "updatedTo": "更新后的观察"}],
  "removals": ["理由：...（要移除的维度名）"],
  "stageRecommendation": "stay"
}`;
}
