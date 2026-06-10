import * as cron from "node-cron";
import * as fs from "node:fs";
import * as path from "node:path";
import type Database from "better-sqlite3";
import type { AppSettings, CharacterCard, DailyBehaviorSummary, Stage } from "../shared/types.js";
import { getSettings, getDailySummary, insertCard, getPortrait, addPortraitDimension, removePortraitDimension, setPortraitStage, deleteBehaviorLog } from "./store.js";
import { clearChat, appendMemory } from "./memory.js";
import { callLLM, generateImage } from "./llm.js";
import { sanitizeSegments } from "./sanitizer.js";
import { runInterpreter } from "./agents/interpreter.js";
import { runAnalyst } from "./agents/analyst.js";
import { runPortraitUpdate } from "./agents/portrait-manager.js";
import type { BrowserWindow } from "electron";

export function exportCardToArchive(dir: string, card: CharacterCard): void {
  if (!dir) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const filename = `mirro-card-${card.date}.md`;
    const filepath = path.join(dir, filename);
    const lines = [
      `# ${card.roleName}`,
      `> ${card.date} · 置信度 ${Math.round(card.confidence * 100)}%`,
      "",
      "## 行为速写",
      card.sketch,
      "",
      "## 新发现",
      card.newPuzzle,
      "",
      "## 反馈",
      card.feedback,
      "",
    ];
    fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
  } catch {
    // archive export failure is non-fatal
  }
}

export function startScheduler(
  db: ReturnType<typeof Database>,
  widgetWindow: BrowserWindow | null,
  dataDir: string
): cron.ScheduledTask {
  const task = cron.schedule("* * * * *", async () => {
    const settings = getSettings(db);
    if (!settings.apiKey) return;

    const [targetHour, targetMin] = settings.morningReportTime.split(":").map(Number);
    const now = new Date();
    if (now.getHours() !== targetHour || now.getMinutes() !== targetMin) return;

    await runDailyGeneration(db, settings, widgetWindow, false, undefined, undefined, dataDir);
  });

  return task;
}

export type GenerationPhase = {
  percent: number;
  label: string;
};

export type PortraitProposal = {
  action: "add" | "modify" | "remove";
  dimension: string;
  detail: string;
};

export type GenerationResult = {
  card: CharacterCard;
  proposals: PortraitProposal[];
  stageRecommendation?: "advance" | "regress" | "hold";
};

export async function runDailyGeneration(
  db: ReturnType<typeof Database>,
  settings?: AppSettings,
  widgetWindow?: BrowserWindow | null,
  useToday = false,
  onProgress?: (phase: GenerationPhase) => void,
  signal?: { cancelled: boolean },
  dataDir?: string
): Promise<GenerationResult> {
  const s = settings ?? getSettings(db);
  const target = new Date();
  if (!useToday) target.setDate(target.getDate() - 1);
  const dateStr = target.toISOString().split("T")[0];

  onProgress?.({ percent: 5, label: "加载行为数据…" });

  const summary = getDailySummary(db, dateStr);
  if (!summary) {
    throw new Error(`No data for ${dateStr}${useToday ? ' — 请先使用电脑一段时间，让系统采集数据' : ''}`);
  }

  const portrait = getPortrait(db);

  // ── Agent 1: Text Interpreter ─────────────────────────────
  onProgress?.({ percent: 10, label: "文本解析（拼音还原）…" });
  const allTypedText = sanitizeSegments(summary.segments);
  let textSummary = "";
  if (allTypedText.length > 50) {
    try {
      textSummary = await runInterpreter(s, allTypedText);
      if (textSummary.length > 600) textSummary = textSummary.slice(0, 600);
    } catch {
      textSummary = allTypedText.slice(0, 600);
    }
  } else if (allTypedText.length > 0) {
    textSummary = allTypedText;
  }

  if (signal?.cancelled) throw new Error("cancelled");

  // ── Agent 2: Behavior Analyst ─────────────────────────────
  onProgress?.({ percent: 30, label: "行为分析（生成角色卡）…" });
  const cardJSON = await runAnalyst(s, summary, portrait, textSummary);

  const card: CharacterCard = {
    id: `card-${dateStr}`,
    date: dateStr,
    roleName: String(cardJSON.roleName || "未知"),
    sketch: String(cardJSON.sketch || ""),
    newPuzzle: String(cardJSON.newPuzzle || ""),
    feedback: String(cardJSON.feedback || ""),
    confidence: Number(cardJSON.confidence) || 0.5,
    stageAtTime: portrait.stage
  };

  insertCard(db, card);

  // Write daily insights to memory so chat can reference them
  if (dataDir) {
    const insightTime = new Date().toISOString();
    appendMemory(dataDir, {
      time: insightTime,
      summary: `每日行为素描：${card.sketch.slice(0, 200)}`,
      tags: ["daily-insight"]
    });
    if (card.newPuzzle) {
      appendMemory(dataDir, {
        time: insightTime,
        summary: `关于主人的新发现：${card.newPuzzle}`,
        tags: ["daily-insight"]
      });
    }
    if (card.feedback) {
      appendMemory(dataDir, {
        time: insightTime,
        summary: `阶段反馈：${card.feedback.slice(0, 200)}`,
        tags: ["daily-insight"]
      });
    }
  }

  if (signal?.cancelled) throw new Error("cancelled");

  // Generate image if configured
  if (s.imageApiKey && s.imageModel) {
    onProgress?.({ percent: 60, label: "生成配图…" });
    try {
      const imagePrompt = `A poetic, artistic illustration for a character card. Role: ${card.roleName}. Sketch: ${card.sketch}. Style: digital art, atmospheric, moody, abstract, non-literal. No text in the image.`;
      card.imageBase64 = await generateImage(s, imagePrompt);
      insertCard(db, card);
    } catch {
      // image generation failure is non-fatal
    }
  }

  // ── Agent 3: Portrait Manager ─────────────────────────────
  onProgress?.({ percent: 75, label: "分析用户画像…" });
  if (signal?.cancelled) throw new Error("cancelled");
  const proposals: PortraitProposal[] = [];
  let stageRecommendation: "advance" | "regress" | "hold" = "hold";

  try {
    const portraitJSON = await runPortraitUpdate(s, summary, portrait);

    if (Array.isArray(portraitJSON.additions)) {
      for (const add of portraitJSON.additions as { dimension: string; observation: string }[]) {
        proposals.push({ action: "add", dimension: add.dimension, detail: add.observation });
      }
    }
    if (Array.isArray(portraitJSON.modifications)) {
      for (const mod of portraitJSON.modifications as { dimension: string; updatedTo: string }[]) {
        proposals.push({ action: "modify", dimension: mod.dimension, detail: mod.updatedTo });
      }
    }
    if (Array.isArray(portraitJSON.removals)) {
      for (const dim of portraitJSON.removals as string[]) {
        proposals.push({ action: "remove", dimension: dim, detail: "" });
      }
    }

    if (portraitJSON.stageRecommendation === "advance" || portraitJSON.stageRecommendation === "regress") {
      stageRecommendation = portraitJSON.stageRecommendation;
    }
  } catch {
    // portrait update failure is non-fatal
  }

  onProgress?.({ percent: 92, label: "归档保存…" });

  // Apply stage progression
  if (stageRecommendation === "advance" || stageRecommendation === "regress") {
    const currentStage = getPortrait(db).stage;
    const stages: Stage[] = ["observer", "familiar", "intimate"];
    const idx = stages.indexOf(currentStage);
    if (stageRecommendation === "advance" && idx < stages.length - 1) {
      setPortraitStage(db, stages[idx + 1]);
    } else if (stageRecommendation === "regress" && idx > 0) {
      setPortraitStage(db, stages[idx - 1]);
    }
  }

  // Stagnation check: 7 days without new dimension
  const updatedPortrait = getPortrait(db);
  const daysSinceNewDim = updatedPortrait.dimensions.length > 0
    ? (Date.now() - new Date(updatedPortrait.dimensions.reduce((a, b) => a.addedAt > b.addedAt ? a : b).addedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  if (daysSinceNewDim > 7) {
    card.feedback += `\n\n⚠ 画像已${Math.round(daysSinceNewDim)}天无新增维度——我对你的了解似乎停滞了。`;
    insertCard(db, card);
  }

  // Notify widget
  widgetWindow?.webContents.send("card:new", card);

  // Archive to directory if configured
  exportCardToArchive(s.archiveDir, card);

  // Generate personalized nudges for tomorrow's interruptions
  if (dataDir && card.sketch) {
    try {
      const portraitBrief = updatedPortrait.dimensions.slice(0, 5).map(d => `${d.dimension}：${d.observation}`).join("；");
      const nudgePrompt = `根据今天的行为观察和用户画像，生成 5 条短消息（每条 8-15 个字），在主人工作间隙弹出提醒/关心主人。语气自然温暖，不要太说教，可以带点小猫的口吻。

今日观察：${card.roleName} - ${card.sketch.slice(0, 150)}
用户画像：${portraitBrief || "暂无"}
关系阶段：${updatedPortrait.stage}

输出格式：纯 JSON 字符串数组，不要任何其他文字。例：["休息一下吧","今天效率不错呢"]`;

      const nudgeResult = await callLLM(s, "你是一个 JSON 生成器。只输出 JSON 字符串数组，不要任何其他文字。", nudgePrompt);
      const parsed = JSON.parse(nudgeResult);
      if (Array.isArray(parsed) && parsed.length > 0) {
        fs.writeFileSync(path.join(dataDir, "nudges.json"), JSON.stringify(parsed.slice(0, 10)), "utf8");
      }
    } catch {
      // nudge generation failure is non-fatal
    }
  }

  // Clean up: raw behavior data already extracted into card/portrait/memory
  deleteBehaviorLog(db, dateStr);
  if (dataDir) {
    try { clearChat(dataDir, dateStr); } catch { /* skip */ }
  }

  onProgress?.({ percent: 100, label: "完成" });

  return { card, proposals, stageRecommendation };
}
