import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, CharacterCard, DailyBehaviorSummary, Portrait } from "../shared/types.js";

export type MirroApi = {
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<void>;
  getTodaySummary: () => Promise<DailyBehaviorSummary | null>;
  getCards: (limit?: number) => Promise<CharacterCard[]>;
  getCard: (date: string) => Promise<CharacterCard | null>;
  getPortrait: () => Promise<Portrait>;
  removePortraitDimension: (dimension: string) => Promise<void>;
  deleteDay: (date: string) => Promise<void>;
  wipeAll: () => Promise<void>;
  exportPortrait: () => Promise<string>;
  generateCardNow: () => Promise<{
    card: CharacterCard;
    proposals: { action: string; dimension: string; detail: string }[];
    stageRecommendation?: string;
  } | null>;
  cancelGenerate: () => Promise<void>;
  openSettings: () => Promise<void>;
  openCard: () => Promise<void>;
  openChat: () => Promise<void>;
  sendChatMessage: (messages: { role: string; content: string }[]) => Promise<string>;
  loadChatHistory: () => Promise<{ role: string; content: string; time: string }[]>;
  getChatMemories: () => Promise<{ time: string; summary: string; tags: string[] }[]>;
  testApiConnection: () => Promise<{ ok: boolean; error?: string }>;
  testImageConnection: () => Promise<{ ok: boolean; error?: string }>;
  setWidgetAppearance: (opts: { capsuleWidth: number; characterHeight: number }) => Promise<void>;
  getWindowPosition: () => Promise<[number, number]>;
  setWindowPosition: (x: number, y: number) => Promise<void>;
  snapToBounds: () => Promise<void>;
  resizeWindow: (deltaX: number, edge: "left" | "right") => Promise<void>;
  onSettingsChanged: (cb: (partial: Partial<AppSettings>) => void) => () => void;
  onTrackingToggle: (cb: (enabled: boolean) => void) => () => void;
  onCardNew: (cb: (card: CharacterCard) => void) => () => void;
  onKeystroke: (cb: (char: string) => void) => () => void;
  onKeystrokeAnim: (cb: (anim: string) => void) => () => void;
  onNudge: (cb: (msg: string) => void) => () => void;
  onGenerationProgress: (cb: (phase: { percent: number; label: string }) => void) => () => void;
  applyPortraitProposal: (proposal: { action: string; dimension: string; detail: string }) => Promise<void>;
  pickDirectory: () => Promise<string | null>;
};

const api: MirroApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (s) => ipcRenderer.invoke("settings:set", s),
  getTodaySummary: () => ipcRenderer.invoke("data:today-summary"),
  getCards: (limit) => ipcRenderer.invoke("data:cards", limit),
  getCard: (date) => ipcRenderer.invoke("data:card", date),
  getPortrait: () => ipcRenderer.invoke("data:portrait"),
  removePortraitDimension: (dim) => ipcRenderer.invoke("data:remove-portrait-dim", dim),
  deleteDay: (date) => ipcRenderer.invoke("data:delete-day", date),
  wipeAll: () => ipcRenderer.invoke("data:wipe"),
  exportPortrait: () => ipcRenderer.invoke("data:export"),
  generateCardNow: () => ipcRenderer.invoke("scheduler:generate-now"),
  cancelGenerate: () => ipcRenderer.invoke("scheduler:cancel-generate"),
  openSettings: () => ipcRenderer.invoke("settings:open"),
  openCard: () => ipcRenderer.invoke("card:open"),
  openChat: () => ipcRenderer.invoke("chat:open"),
  sendChatMessage: (messages) => ipcRenderer.invoke("chat:send", messages),
  loadChatHistory: () => ipcRenderer.invoke("chat:load"),
  getChatMemories: () => ipcRenderer.invoke("chat:get-memories"),
  testApiConnection: () => ipcRenderer.invoke("settings:test-api"),
  testImageConnection: () => ipcRenderer.invoke("settings:test-image"),
  setWidgetAppearance: (opts) => ipcRenderer.invoke("widget:set-appearance", opts),
  getWindowPosition: () => ipcRenderer.invoke("window:get-position"),
  setWindowPosition: (x, y) => ipcRenderer.invoke("window:set-position", x, y),
  snapToBounds: () => ipcRenderer.invoke("window:snap-to-bounds"),
  resizeWindow: (dx, edge) => ipcRenderer.invoke("window:resize", dx, edge),
  onSettingsChanged: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, partial: Partial<AppSettings>) => cb(partial);
    ipcRenderer.on("settings:changed", handler);
    return () => ipcRenderer.removeListener("settings:changed", handler);
  },
  onTrackingToggle: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, enabled: boolean) => cb(enabled);
    ipcRenderer.on("tracking:toggle", handler);
    return () => ipcRenderer.removeListener("tracking:toggle", handler);
  },
  onCardNew: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, card: CharacterCard) => cb(card);
    ipcRenderer.on("card:new", handler);
    return () => ipcRenderer.removeListener("card:new", handler);
  },
  onKeystroke: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, char: string) => cb(char);
    ipcRenderer.on("keystroke:char", handler);
    return () => ipcRenderer.removeListener("keystroke:char", handler);
  },
  onKeystrokeAnim: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, anim: string) => cb(anim);
    ipcRenderer.on("keystroke:anim", handler);
    return () => ipcRenderer.removeListener("keystroke:anim", handler);
  },
  onNudge: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg);
    ipcRenderer.on("nudge:show", handler);
    return () => ipcRenderer.removeListener("nudge:show", handler);
  },
  onGenerationProgress: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, phase: { percent: number; label: string }) => cb(phase);
    ipcRenderer.on("generation:progress", handler);
    return () => ipcRenderer.removeListener("generation:progress", handler);
  },
  applyPortraitProposal: (proposal) => ipcRenderer.invoke("portrait:apply-proposal", proposal),
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory")
};

contextBridge.exposeInMainWorld("mirro", api);
