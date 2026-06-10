export type Stage = "observer" | "familiar" | "intimate";

export type PortraitDimension = {
  dimension: string;
  observation: string;
  addedAt: string;
};

export type Portrait = {
  dimensions: PortraitDimension[];
  stage: Stage;
  stageStartedAt: string;
  dimensionCount: number;
};

export type BehaviorSegment = {
  timeRange: string;
  primaryApp: string;
  inputChars: number;
  deleteRate: number;
  browsingDomains: string[];
  typedText?: string;
};

export type DailyBehaviorSummary = {
  date: string;
  segments: BehaviorSegment[];
  totalInputChars: number;
  totalDeleteRate: number;
  uniqueApps: string[];
  uniqueDomains: string[];
};

export type CharacterCard = {
  id: string;
  date: string;
  roleName: string;
  sketch: string;
  newPuzzle: string;
  feedback: string;
  confidence: number;
  stageAtTime: Stage;
  imageBase64?: string;
};

export type AppSettings = {
  apiKey: string;
  llmProvider: "anthropic" | "openai" | "deepseek" | "glm" | "kimi" | "doubao" | "apimart";
  model: string;
  imageApiKey: string;
  imageModel: string;
  trackingEnabled: boolean;
  ignoredApps: string[];
  ignoredDomains: string[];
  morningReportTime: string;
  randomNudgeEnabled: boolean;
  randomNudgeFrequency: "occasional" | "rare";
  widgetOpacity: number;
  capsuleWidth: number;
  characterHeight: number;
  widgetLocked: boolean;
  archiveDir: string;
  personalityTraits: string[];
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  llmProvider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  imageApiKey: "",
  imageModel: "gemini-3-pro-image-preview",
  trackingEnabled: true,
  ignoredApps: [],
  ignoredDomains: [],
  morningReportTime: "08:00",
  randomNudgeEnabled: false,
  randomNudgeFrequency: "rare",
  widgetOpacity: 0.72,
  capsuleWidth: 220,
  characterHeight: 90,
  widgetLocked: false,
  archiveDir: "",
  personalityTraits: []
};
