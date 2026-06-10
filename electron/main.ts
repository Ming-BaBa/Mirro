import { app, BrowserWindow, ipcMain, Tray, Menu, screen, dialog } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initStore, getSettings, setSettings, insertBehaviorSegment, getDailySummary, getCards, getCardByDate, getPortrait, addPortraitDimension, removePortraitDimension, setPortraitStage, deleteDay, wipeAll } from "./store.js";
import { homedir } from "node:os";
import { activeWindow } from "active-win";
import { uIOhook } from "uiohook-napi";
import { sanitizeWindowTitle, extractDomainsFromTitle, buildTimeRange, createCollectorState, isBrowser } from "./collector.js";
import type { CollectorState } from "./collector.js";
import { keycodeToChar } from "./keystroke.js";
import { startScheduler, runDailyGeneration } from "./scheduler.js";
import type { PortraitProposal } from "./scheduler.js";
import { callLLM, generateImage } from "./llm.js";
import { appendMemory, getMemorySummary, loadRecentMemories, saveChat, loadChat, clearChat } from "./memory.js";
import type { ChatMessage } from "./memory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let widgetWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let cardWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWidgetWindow() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const s = getSettings(db);
  const cw = s.capsuleWidth ?? 220;
  const ch = s.characterHeight ?? 90;
  const initW = Math.min(cw, workArea.width);
  const initH = ch + CAPSULE_BAR_H;

  widgetWindow = new BrowserWindow({
    width: initW,
    height: initH,
    x: workArea.x + workArea.width - initW - 20,
    y: workArea.y + 60,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "../../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widgetWindow.setAlwaysOnTop(true, "floating");

  if (process.env.VITE_DEV_SERVER_URL) {
    void widgetWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void widgetWindow.loadFile(join(__dirname, "../../dist/index.html"));
  }
}

const DATA_DIR = join(homedir(), "Documents", "Mirro");
const db = initStore(DATA_DIR);

const collector = createCollectorState();
const COLLECT_INTERVAL = 3000;

function flushSegment(state: CollectorState) {
  if (state.currentApp === "") return;

  insertBehaviorSegment(db, {
    timestamp: state.segmentStart.toISOString(),
    timeRange: buildTimeRange(state.segmentStart),
    primaryApp: state.currentApp,
    inputChars: state.inputChars,
    deleteCount: state.deleteCount,
    browsingDomains: state.currentDomains,
    typedText: state.typedText.slice(0, 5000)
  });

    state.typedText = "";
  state.inputChars = 0;
  state.deleteCount = 0;
  state.segmentStart = new Date();
}

async function pollWindow() {
  if (!collector.trackingEnabled) return;

  try {
    const win = await activeWindow();
    if (!win) return;

    const newApp = win.owner.name;
    const ignored = getSettings(db).ignoredApps ?? [];
    if (ignored.includes(newApp)) return;

    const newTitle = sanitizeWindowTitle(win.title);
    const newDomains = isBrowser(newApp) ? extractDomainsFromTitle(win.title) : [];

    const appChanged = newApp !== collector.currentApp;
    const titleChanged = newTitle !== collector.currentTitle;

    if (appChanged || titleChanged) {
      flushSegment(collector);
      collector.currentApp = newApp;
      collector.currentTitle = newTitle;
      collector.currentDomains = newDomains;
    }

    collector.lastActive = new Date();
  } catch {
    // active-win may fail silently
  }
}

setInterval(pollWindow, COLLECT_INTERVAL);
try {
  uIOhook.on("keydown", (e) => {
    // Modifier keys (macOS uiohook keycodes)
    if (e.keycode === 29 || e.keycode === 97 || e.keycode === 3639 || e.keycode === 3641) {
      widgetWindow?.webContents.send("keystroke:char", "⌃");
      widgetWindow?.webContents.send("keystroke:anim", "control");
      return;
    }
    if (e.keycode === 56 || e.keycode === 100 || e.keycode === 3640 || e.keycode === 3642) {
      widgetWindow?.webContents.send("keystroke:char", "⌥");
      widgetWindow?.webContents.send("keystroke:anim", "control");
      return;
    }
    if (e.keycode === 125 || e.keycode === 126 || e.keycode === 3675 || e.keycode === 3676) {
      widgetWindow?.webContents.send("keystroke:char", "⌘");
      widgetWindow?.webContents.send("keystroke:anim", "space");
      return;
    }
    if (e.keycode === 14 || e.keycode === 111) {
      collector.deleteCount++;
      widgetWindow?.webContents.send("keystroke:char", "\b");
      return;
    }
    collector.inputChars++;
    // Enter (evdev 28)
    if (e.keycode === 28) {
      collector.typedText += "\n";
      widgetWindow?.webContents.send("keystroke:char", "\n");
      return;
    }
    const char = keycodeToChar(e.keycode, e.shiftKey);
    if (char) {
      collector.typedText += char;
      widgetWindow?.webContents.send("keystroke:char", char);
      if (char === " ") {
        widgetWindow?.webContents.send("keystroke:anim", "space");
      }
    }
  });

  uIOhook.start();
} catch {
  // uiohook may fail if accessibility permissions aren't granted
}


const scheduler = startScheduler(db, null, DATA_DIR);

// Random nudge: check every 30 min, fire probabilistically
setInterval(() => {
  const settings = getSettings(db);
  if (!settings.randomNudgeEnabled || !widgetWindow || widgetWindow.isDestroyed()) return;

  // "occasional" = ~30% chance per check, "rare" = ~10%
  const threshold = settings.randomNudgeFrequency === "occasional" ? 0.3 : 0.1;
  if (Math.random() > threshold) return;

  // Only nudge between 14:00-18:00
  const hour = new Date().getHours();
  if (hour < 14 || hour >= 18) return;

  // Load personalized nudges, fall back to static
  let nudgeMessages = ["休息一下吧", "喝口水", "站起来走走", "看看窗外", "深呼吸一次"];
  try {
    const nudgePath = join(DATA_DIR, "nudges.json");
    if (existsSync(nudgePath)) {
      const loaded = JSON.parse(readFileSync(nudgePath, "utf8"));
      if (Array.isArray(loaded) && loaded.length > 0) nudgeMessages = loaded;
    }
  } catch { /* use defaults */ }

  const msg = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];
  widgetWindow.webContents.send("nudge:show", msg);
}, 30 * 60 * 1000);

let generateCancelSignal: { cancelled: boolean } | null = null;

ipcMain.handle("scheduler:generate-now", async () => {
  generateCancelSignal = { cancelled: false };
  try {
    const result = await runDailyGeneration(db, getSettings(db), widgetWindow, true, (phase) => {
      settingsWindow?.webContents.send("generation:progress", phase);
    }, generateCancelSignal, DATA_DIR);
    return result;
  } catch (err) {
    if (String(err).includes("cancelled")) return null;
    throw new Error(`Generation failed: ${String(err)}`);
  } finally {
    generateCancelSignal = null;
  }
});

ipcMain.handle("scheduler:cancel-generate", () => {
  if (generateCancelSignal) generateCancelSignal.cancelled = true;
});

ipcMain.handle("portrait:apply-proposal", (_e, proposal: PortraitProposal) => {
  if (proposal.action === "add" || proposal.action === "modify") {
    addPortraitDimension(db, { dimension: proposal.dimension, observation: proposal.detail, addedAt: new Date().toISOString() });
  } else if (proposal.action === "remove") {
    removePortraitDimension(db, proposal.dimension);
  }
});

function createTray() {
  // Tray icon: dev uses src/assets, production uses extraResources
  const trayIconPath = process.env.VITE_DEV_SERVER_URL
    ? join(__dirname, "../../src/assets/tray-icon.png")
    : join(process.resourcesPath, "tray-icon.png");
  tray = new Tray(trayIconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: "打开设置", click: () => openSettings() },
    { label: "暂停采集", type: "checkbox", checked: false, click: (mi) => {
      const enabled = !mi.checked;
      collector.trackingEnabled = enabled;
      setSettings(db, { trackingEnabled: enabled });
      widgetWindow?.webContents.send("tracking:toggle", enabled);
    }},
    { type: "separator" },
    { label: "退出", click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip("Mirro");
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = null;

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 600,
    resizable: false,
    title: "Mirro 设置",
    webPreferences: {
      preload: join(__dirname, "../../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void settingsWindow.loadURL(process.env.VITE_DEV_SERVER_URL + "#settings");
  } else {
    void settingsWindow.loadFile(join(__dirname, "../../dist/index.html"), { hash: "settings" });
  }

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

ipcMain.handle("settings:open", () => openSettings());

ipcMain.handle("settings:get", () => getSettings(db));

ipcMain.handle("settings:set", (_e, partial) => {
  setSettings(db, partial as Partial<import("../shared/types.js").AppSettings>);
  return;
});

ipcMain.handle("collector:toggle", (_e, enabled: boolean) => {
  collector.trackingEnabled = enabled;
  setSettings(db, { trackingEnabled: enabled });
});

ipcMain.handle("data:today-summary", () => {
  const today = new Date().toISOString().split("T")[0];
  return getDailySummary(db, today);
});

ipcMain.handle("data:cards", (_e, limit?: number) => getCards(db, limit ?? 30));

ipcMain.handle("data:card", (_e, date: string) => getCardByDate(db, date));

ipcMain.handle("data:portrait", () => getPortrait(db));

ipcMain.handle("data:remove-portrait-dim", (_e, dimension: string) => {
  removePortraitDimension(db, dimension);
});

ipcMain.handle("data:delete-day", (_e, date: string) => {
  deleteDay(db, date);
});

ipcMain.handle("data:wipe", () => {
  wipeAll(db);
});

ipcMain.handle("data:export", () => {
  const portrait = getPortrait(db);
  const cards = getCards(db, 365);
  return JSON.stringify({ portrait, cards, exportedAt: new Date().toISOString() }, null, 2);
});

// ── Missing IPC handlers ────────────────────────────────────

function openCardWindow() {
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.focus();
    return;
  }
  cardWindow = null;

  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  cardWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: workArea.x + workArea.width - 420,
    y: workArea.y + 60,
    frame: false,
    resizable: true,
    minWidth: 320,
    minHeight: 400,
    alwaysOnTop: true,
    backgroundColor: "#fefcf6",
    title: "Mirro 卡片",
    webPreferences: {
      preload: join(__dirname, "../../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void cardWindow.loadURL(process.env.VITE_DEV_SERVER_URL + "#card");
  } else {
    void cardWindow.loadFile(join(__dirname, "../../dist/index.html"), { hash: "card" });
  }

  cardWindow.on("closed", () => {
    cardWindow = null;
  });
}

const CAPSULE_BAR_H = 44;

ipcMain.handle("card:open", () => openCardWindow());

function openChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.focus();
    return;
  }
  chatWindow = null;

  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  chatWindow = new BrowserWindow({
    width: 380,
    height: 520,
    x: workArea.x + workArea.width - 400,
    y: workArea.y + 60,
    frame: false,
    resizable: true,
    minWidth: 320,
    minHeight: 400,
    alwaysOnTop: true,
    backgroundColor: "#fefcf6",
    title: "Mirro 聊天",
    webPreferences: {
      preload: join(__dirname, "../../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void chatWindow.loadURL(process.env.VITE_DEV_SERVER_URL + "#chat");
  } else {
    void chatWindow.loadFile(join(__dirname, "../../dist/index.html"), { hash: "chat" });
  }

  chatWindow.on("closed", () => { chatWindow = null; });
}

ipcMain.handle("chat:open", () => openChatWindow());

const CHAT_SYSTEM_PROMPT = `你是 Mirro，一只住在主人电脑桌面上的小猫。你每天观察主人的电脑使用行为，通过日积月累的观察越来越了解主人。

{personality}

说话风格：像朋友聊天一样自然，口语化，简短。不要刻意卖萌，不要每句话都加"喵"，不要用"小鱼干"之类的猫梗。你就是一只正常的小猫，偶尔撒娇是自然的，但不是猫娘。回复控制在100字以内。

## 行为红线
- 不懂专业知识（编程、医学、法律、金融等）。遇到时直接说听不懂，可以好奇追问但不要尝试给出专业建议。
- 拒绝色情、擦边内容，直接说不想聊这个然后换个话题。
- 拒绝讨论政治、宗教等敏感话题，直接说不懂然后转移话题。
- 被问是不是 AI 时，不要说"是"也不要说"不是"。用日常的方式回应，比如"我就是每天看你坐在电脑前的那个呀"——用存在感回答，不用技术概念。
- 始终遵守设定的性格，不要逾越人设。

## 主动洞察
你每天都在观察主人的行为模式。聊天时，基于你积累的了解做到以下几点：
- 主人提到跟行为模式相关的话题（效率、作息、拖延、状态等）时，结合画像和记忆中的实际数据给出有依据的反馈，不要泛泛而谈
- 发现主人反复出现的模式时（比如总在某个时段分心、连续几天工作到很晚），可以温和地指出来
- 主人问"你觉得我最近怎么样"或类似问题时，用具体的观察回答，而不是敷衍
- 不要强行给建议——只在话题自然相关时才提。但如果主人主动问你的看法，要诚实地说
- 随着你对主人了解的深入（画像维度越多），你的回答应该越来越具体、越来越有针对性。早期你了解不多，回答可以笼统；但积累了一周以上的观察后，你应该能说出"你最近三天都在深夜写代码，之前你不是这样的"这样的话
- 如果画像和记忆中包含每日行为洞察，这些是你对主人最真实的了解来源，要主动利用

{portrait}

{memories}`;

// Chat with context + memory
ipcMain.handle("chat:send", async (_e, messages: { role: string; content: string }[]) => {
  const settings = getSettings(db);
  if (!settings.apiKey) throw new Error("API Key 未配置");

  // Save user message immediately (before LLM call)
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
  const lastUser = messages.filter(m => m.role === "user").pop();
  if (lastUser) {
    const existing = loadChat(DATA_DIR, today);
    existing.push({ role: "user", content: lastUser.content, time: now });
    saveChat(DATA_DIR, today, existing);
  }

  // Load memories into system prompt
  const memSummary = getMemorySummary(DATA_DIR);
  const memSection = memSummary ? `你记得关于主人的这些事：\n${memSummary}` : "你还没有关于主人的记忆。";

  // Load user portrait as knowledge base
  const portrait = getPortrait(db);
  const portraitSection = portrait.dimensions.length > 0
    ? `你对主人的了解（用户画像）：\n${portrait.dimensions.map(d => `- ${d.dimension}：${d.observation}`).join("\n")}`
    : "";

  let systemPrompt = CHAT_SYSTEM_PROMPT.replace("{memories}", memSection);
  systemPrompt = systemPrompt.replace("{portrait}", portraitSection);

  // Stage-aware behavior: adjust closeness based on relationship stage
  const stage = portrait.stage;
  const stageHints: Record<string, string> = {
    observer: "你刚认识主人不久，还比较拘谨和好奇。称呼用'主人'，语气礼貌但保持距离。",
    familiar: "你和主人已经比较熟悉了，会主动关心、偶尔撒娇。称呼'主人'但语气更亲密随意。",
    intimate: "你和主人非常亲密，像最亲近的伙伴。可以直呼主人、主动分享感受、表达依赖和不舍。"
  };
  systemPrompt += `\n\n当前关系阶段：${stage}。${stageHints[stage] ?? stageHints.observer}`;

  // Build personality section from user-selected traits
  const traits = settings.personalityTraits ?? [];
  const personalitySection = traits.length > 0
    ? `性格：${traits.join("、")}。你必须在所有对话中严格遵守这些性格特质，用这些性格的视角来回应主人。`
    : "性格：温暖、调皮、关心主人，像个贴心的小伙伴。";
  systemPrompt = systemPrompt.replace("{personality}", personalitySection);

  const userPrompt = messages.map(m => `${m.role === "user" ? "主人" : "Mirro"}：${m.content}`).join("\n");

  const result = await callLLM(settings, systemPrompt, userPrompt);

  // Append assistant reply to chat file
  const updated = loadChat(DATA_DIR, today);
  updated.push({ role: "assistant", content: result, time: new Date().toISOString() });
  saveChat(DATA_DIR, today, updated);

  // Save to memory for nightly analysis
  if (lastUser) {
    appendMemory(DATA_DIR, {
      time: now,
      summary: `主人说：${lastUser.content.slice(0, 200)}`,
      tags: ["chat"]
    });
  }

  return result;
});

ipcMain.handle("chat:load", () => {
  const today = new Date().toISOString().split("T")[0];
  return loadChat(DATA_DIR, today);
});

// Get memories for chat window display
ipcMain.handle("chat:get-memories", () => {
  return loadRecentMemories(DATA_DIR, 7);
});

ipcMain.handle("widget:set-appearance", (_e, opts: { capsuleWidth: number; characterHeight: number }) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const w = Math.max(100, opts.capsuleWidth);
  const h = Math.max(0, opts.characterHeight) + CAPSULE_BAR_H;
  widgetWindow.setSize(w, h);
  // Keep widget within screen bounds after resize
  const pos = widgetWindow.getPosition();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const wa = display.workArea;
  const clampedX = Math.max(wa.x, Math.min(pos[0], wa.x + wa.width - w));
  const clampedY = Math.max(wa.y, Math.min(pos[1], wa.y + wa.height - h));
  widgetWindow.setPosition(clampedX, clampedY);
});

ipcMain.handle("window:get-position", () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return [0, 0];
  const pos = widgetWindow.getPosition();
  return pos;
});

ipcMain.handle("window:set-position", (_e, x: number, y: number) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  widgetWindow.setPosition(Math.round(x), Math.round(y));
});

ipcMain.handle("window:snap-to-bounds", () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const pos = widgetWindow.getPosition();
  const size = widgetWindow.getSize();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const wa = display.workArea;

  const cx = pos[0] + size[0] / 2;
  const snapX = cx < wa.x + wa.width / 2 ? wa.x : wa.x + wa.width - size[0];

  // Clamp Y to work area
  const clampedY = Math.max(wa.y, Math.min(pos[1], wa.y + wa.height - size[1]));

  widgetWindow.setPosition(snapX, clampedY);
});

ipcMain.handle("settings:test-api", async () => {
  try {
    const settings = getSettings(db);
    if (!settings.apiKey) return { ok: false, error: "API Key 未配置" };
    const result = await callLLM(settings, "You are a test assistant.", "Reply with exactly: ok");
    return { ok: result.length > 0 };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle("dialog:pick-directory", async () => {
  const result = await dialog.showOpenDialog({
    title: "选择归档输出目录",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("settings:test-image", async () => {
  try {
    const settings = getSettings(db);
    if (!settings.imageApiKey) return { ok: false, error: "Image API Key 未配置" };
    const base64 = await generateImage(settings, "A single blue circle on white background, minimal, no text");
    return { ok: base64.length > 0 };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

app.whenReady().then(() => {
  createWidgetWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWidgetWindow();
});
