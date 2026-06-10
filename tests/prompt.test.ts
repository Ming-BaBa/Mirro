import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildDailyCardPrompt, buildPortraitUpdatePrompt } from "../electron/prompt";
import type { DailyBehaviorSummary, Portrait } from "../shared/types";

const emptyPortrait: Portrait = {
  dimensions: [],
  stage: "observer",
  stageStartedAt: "2026-06-07T00:00:00Z",
  dimensionCount: 0
};

const sampleSummary: DailyBehaviorSummary = {
  date: "2026-06-07",
  segments: [{
    timeRange: "09:00-09:30",
    primaryApp: "VS Code",
    inputChars: 500,
    deleteRate: 0.2,
    browsingDomains: []
  }],
  totalInputChars: 500,
  totalDeleteRate: 0.2,
  uniqueApps: ["VS Code"],
  uniqueDomains: []
};

describe("buildSystemPrompt", () => {
  it("includes behavior analyst identity and anti-fiction rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("行为分析师");
    expect(prompt).toContain("不做文学创作");
    expect(prompt).toContain("不用比喻");
  });
});

describe("buildDailyCardPrompt", () => {
  it("includes behavior summary and stage", () => {
    const prompt = buildDailyCardPrompt(sampleSummary, emptyPortrait, "observer");
    expect(prompt).toContain("VS Code");
    expect(prompt).toContain("observer");
  });

  it("returns JSON schema in the prompt", () => {
    const prompt = buildDailyCardPrompt(sampleSummary, emptyPortrait, "observer");
    expect(prompt).toContain("roleName");
    expect(prompt).toContain("confidence");
  });
});

describe("buildPortraitUpdatePrompt", () => {
  it("includes current portrait dimensions", () => {
    const portraitWithDims: Portrait = {
      dimensions: [{ dimension: "夜型", observation: "工作到深夜", addedAt: "2026-06-06T00:00:00Z" }],
      stage: "familiar",
      stageStartedAt: "2026-06-01T00:00:00Z",
      dimensionCount: 1
    };
    const prompt = buildPortraitUpdatePrompt(sampleSummary, portraitWithDims);
    expect(prompt).toContain("夜型");
    expect(prompt).toContain("additions");
  });
});
