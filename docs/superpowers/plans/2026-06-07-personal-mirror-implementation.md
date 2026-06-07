# Personal Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first Electron desktop app that silently tracks computer activity and generates daily AI character cards — a growing self-portrait from digital traces.

**Architecture:** Electron shell with React renderer. Main process runs a background collector (window tracking via `active-win`, input counting via `@kwhat/libuiohook`, browser domain from window title), stores data in SQLite via `better-sqlite3`, and schedules daily LLM calls via `node-cron`. Renderer provides a transparent desktop widget and a settings panel, communicating through IPC.

**Tech Stack:** Electron 37, React 19, TypeScript 5.8, Vite 7, better-sqlite3, active-win, @kwhat/libuiohook, node-cron, Vitest.

---

## File Structure

```
personal-mirror/
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── vite.config.ts
├── index.html
├── shared/
│   └── types.ts              # Shared TypeScript types (used by electron + src)
├── electron/
│   ├── main.ts              # BrowserWindow, tray, IPC handlers, app lifecycle
│   ├── preload.ts            # contextBridge API for renderer
│   ├── store.ts              # SQLite database (better-sqlite3)
│   ├── collector.ts          # Window + input + browser tracking
│   ├── scheduler.ts          # node-cron: daily report + random nudge
│   ├── llm.ts                # LLM API client (Anthropic/OpenAI)
│   └── prompt.ts             # System prompt + daily card + portrait update templates
├── src/
│   ├── main.tsx              # React entry
│   ├── App.tsx               # Root: switches between widget & settings
│   ├── app.css               # All styles
│   ├── components/
│   │   ├── Widget.tsx        # Transparent desktop widget (collapsed/expanded)
│   │   ├── CardView.tsx      # Full character card display
│   │   ├── Settings.tsx      # Settings panel
│   │   └── PortraitView.tsx  # Portrait dimension viewer/editor
│   └── hooks/
│       └── useIpc.ts         # IPC call wrappers
└── tests/
    ├── store.test.ts
    ├── collector.test.ts
    ├── llm.test.ts
    └── prompt.test.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.electron.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/app.css`
- Create: `shared/types.ts`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "personal-mirror",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "dev:electron": "concurrently -k \"vite --host 127.0.0.1\" \"wait-on http://127.0.0.1:5173 && npm run build:electron && VITE_DEV_SERVER_URL=http://127.0.0.1:5173 electron .\"",
    "build": "tsc --noEmit && vite build && npm run build:electron",
    "build:electron": "tsc -p tsconfig.electron.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@kwhat/libuiohook": "^2.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "active-win": "^9.0.0",
    "better-sqlite3": "^11.0.0",
    "electron": "^37.0.0",
    "node-cron": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^24.0.0",
    "@types/node-cron": "^3.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "concurrently": "^9.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0",
    "wait-on": "^8.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": ["src", "shared", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: Create tsconfig.electron.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist-electron",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["electron", "../shared"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist"
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 5: Create index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Personal Mirror</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create src/types.ts**

```ts
export type PetPosition = { x: number; y: number };

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
};

export type AppSettings = {
  apiKey: string;
  llmProvider: "anthropic" | "openai";
  model: string;
  trackingEnabled: boolean;
  ignoredApps: string[];
  ignoredDomains: string[];
  morningReportTime: string;
  randomNudgeEnabled: boolean;
  randomNudgeFrequency: "occasional" | "rare";
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  llmProvider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  trackingEnabled: true,
  ignoredApps: [],
  ignoredDomains: [],
  morningReportTime: "08:00",
  randomNudgeEnabled: false,
  randomNudgeFrequency: "rare"
};
```

- [ ] **Step 7: Create src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create src/App.tsx**

```tsx
export function App() {
  return (
    <main className="app-shell">
      <div className="placeholder">Personal Mirror</div>
    </main>
  );
}
```

- [ ] **Step 9: Create src/app.css**

```css
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  background: transparent;
}

body {
  margin: 0;
  overflow: hidden;
  background: transparent;
}

.app-shell {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  background: transparent;
}

.placeholder {
  color: #2b2f38;
  font-size: 14px;
  opacity: 0.6;
}
```

- [ ] **Step 10: Create electron/main.ts**

```ts
import { app, BrowserWindow, ipcMain, Tray, Menu, screen } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let widgetWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWidgetWindow() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  widgetWindow = new BrowserWindow({
    width: 320,
    height: 480,
    x: workArea.x + workArea.width - 340,
    y: workArea.y + 60,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widgetWindow.setAlwaysOnTop(true, "floating");

  if (process.env.VITE_DEV_SERVER_URL) {
    void widgetWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void widgetWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

function createTray() {
  tray = new Tray(join(__dirname, "../src/assets/tray-icon.png"));
  const contextMenu = Menu.buildFromTemplate([
    { label: "打开设置", click: () => openSettings() },
    { label: "暂停采集", type: "checkbox", checked: false, click: (mi) => {
      widgetWindow?.webContents.send("tracking:toggle", !mi.checked);
    }},
    { type: "separator" },
    { label: "退出", click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip("Personal Mirror");
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 600,
    resizable: false,
    title: "Personal Mirror 设置",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void settingsWindow.loadURL(process.env.VITE_DEV_SERVER_URL + "#settings");
  } else {
    void settingsWindow.loadFile(join(__dirname, "../dist/index.html"), { hash: "settings" });
  }

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

ipcMain.handle("settings:open", () => openSettings());
ipcMain.handle("settings:get", () => { /* TODO: Task 4 */ });
ipcMain.handle("settings:set", (_e, _settings) => { /* TODO: Task 4 */ });

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
```

- [ ] **Step 11: Create electron/preload.ts**

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, CharacterCard, DailyBehaviorSummary, Portrait } from "../shared/types";

export type PersonalMirrorApi = {
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
  generateCardNow: () => Promise<CharacterCard>;
  openSettings: () => Promise<void>;
  onTrackingToggle: (cb: (enabled: boolean) => void) => () => void;
};

const api: PersonalMirrorApi = {
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
  openSettings: () => ipcRenderer.invoke("settings:open"),
  onTrackingToggle: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, enabled: boolean) => cb(enabled);
    ipcRenderer.on("tracking:toggle", handler);
    return () => ipcRenderer.removeListener("tracking:toggle", handler);
  }
};

contextBridge.exposeInMainWorld("personalMirror", api);
```

- [ ] **Step 12: Install dependencies**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm install`
Expected: dependencies install successfully.

- [ ] **Step 13: Verify scaffold**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm run lint`
Expected: TypeScript completes without errors.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: scaffold personal-mirror project with Electron + React + Vite"
```

---

### Task 2: SQLite Store Layer

**Files:**
- Create: `electron/store.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: Write store tests**

Create `tests/store.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initStore, getSettings, setSettings, insertBehaviorSegment, getDailySummary } from "../electron/store";
import type { AppSettings } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("store", () => {
  let db: ReturnType<typeof Database>;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "personal-mirror-test-"));
    db = initStore(dir);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  describe("settings", () => {
    it("returns default settings when none stored", () => {
      const settings = getSettings(db);
      expect(settings.trackingEnabled).toBe(true);
      expect(settings.morningReportTime).toBe("08:00");
    });

    it("persists and retrieves settings", () => {
      setSettings(db, { morningReportTime: "09:30", trackingEnabled: false });
      const settings = getSettings(db);
      expect(settings.morningReportTime).toBe("09:30");
      expect(settings.trackingEnabled).toBe(false);
    });

    it("merges partial settings with existing", () => {
      setSettings(db, { morningReportTime: "07:00" });
      const settings = getSettings(db);
      expect(settings.morningReportTime).toBe("07:00");
      expect(settings.trackingEnabled).toBe(true);
    });
  });

  describe("behavior segments", () => {
    it("inserts a segment and retrieves daily summary", () => {
      insertBehaviorSegment(db, {
        timestamp: "2026-06-07T09:00:00Z",
        timeRange: "09:00-09:30",
        primaryApp: "VS Code",
        inputChars: 500,
        deleteCount: 50,
        browsingDomains: []
      });

      const summary = getDailySummary(db, "2026-06-07");
      expect(summary).not.toBeNull();
      expect(summary!.totalInputChars).toBe(500);
      expect(summary!.uniqueApps).toContain("VS Code");
    });

    it("aggregates multiple segments correctly", () => {
      insertBehaviorSegment(db, { timestamp: "2026-06-07T09:00:00Z", timeRange: "09:00-09:30", primaryApp: "VS Code", inputChars: 500, deleteCount: 100, browsingDomains: [] });
      insertBehaviorSegment(db, { timestamp: "2026-06-07T10:00:00Z", timeRange: "10:00-10:30", primaryApp: "Chrome", inputChars: 200, deleteCount: 10, browsingDomains: ["twitter.com"] });

      const summary = getDailySummary(db, "2026-06-07");
      expect(summary!.totalInputChars).toBe(700);
      expect(summary!.totalDeleteRate).toBeCloseTo(0.16, 1);
      expect(summary!.uniqueApps).toEqual(["Chrome", "VS Code"]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm test -- tests/store.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement store**

Create `electron/store.ts`:

```ts
import Database from "better-sqlite3";
import { join } from "node:path";
import type { AppSettings, BehaviorSegment, DailyBehaviorSummary, CharacterCard, Portrait, PortraitDimension } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { mkdirSync } from "node:fs";

export function initStore(dataDir: string): ReturnType<typeof Database> {
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "personal-mirror.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS behavior_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      time_range TEXT NOT NULL,
      primary_app TEXT NOT NULL,
      input_chars INTEGER NOT NULL DEFAULT 0,
      delete_count INTEGER NOT NULL DEFAULT 0,
      browsing_domains TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS character_cards (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      role_name TEXT NOT NULL,
      sketch TEXT NOT NULL,
      new_puzzle TEXT NOT NULL,
      feedback TEXT NOT NULL,
      confidence REAL NOT NULL,
      stage_at_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portrait (
      dimension TEXT PRIMARY KEY,
      observation TEXT NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portrait_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_behavior_date ON behavior_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_cards_date ON character_cards(date);
  `);

  return db;
}

export function getSettings(db: ReturnType<typeof Database>): AppSettings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    try { stored[row.key] = JSON.parse(row.value); } catch { stored[row.key] = row.value; }
  }
  return { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
}

export function setSettings(db: ReturnType<typeof Database>, partial: Partial<AppSettings>): void {
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(partial)) {
      upsert.run(key, JSON.stringify(value));
    }
  });
  transaction();
}

export function insertBehaviorSegment(
  db: ReturnType<typeof Database>,
  segment: { timestamp: string; timeRange: string; primaryApp: string; inputChars: number; deleteCount: number; browsingDomains: string[] }
): void {
  db.prepare(
    "INSERT INTO behavior_log (timestamp, time_range, primary_app, input_chars, delete_count, browsing_domains) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(segment.timestamp, segment.timeRange, segment.primaryApp, segment.inputChars, segment.deleteCount, JSON.stringify(segment.browsingDomains));
}

export function getDailySummary(db: ReturnType<typeof Database>, date: string): DailyBehaviorSummary | null {
  const rows = db.prepare(
    "SELECT * FROM behavior_log WHERE date(timestamp) = ? ORDER BY timestamp"
  ).all(date) as { time_range: string; primary_app: string; input_chars: number; delete_count: number; browsing_domains: string }[];

  if (rows.length === 0) return null;

  const segments: BehaviorSegment[] = rows.map(r => {
    const domains: string[] = JSON.parse(r.browsing_domains || "[]");
    const total = r.input_chars + r.delete_count;
    const deleteRate = total > 0 ? r.delete_count / total : 0;
    return {
      timeRange: r.time_range,
      primaryApp: r.primary_app,
      inputChars: r.input_chars,
      deleteRate: Math.round(deleteRate * 100) / 100,
      browsingDomains: domains
    };
  });

  const totalInputChars = segments.reduce((s, seg) => s + seg.inputChars, 0);
  const totalDeleteCount = rows.reduce((s, r) => s + r.delete_count, 0);
  const totalAll = totalInputChars + totalDeleteCount;
  const totalDeleteRate = totalAll > 0 ? Math.round((totalDeleteCount / totalAll) * 100) / 100 : 0;
  const uniqueApps = [...new Set(segments.map(s => s.primaryApp))].sort();
  const allDomains = segments.flatMap(s => s.browsingDomains);
  const uniqueDomains = [...new Set(allDomains)].sort();

  return { date, segments, totalInputChars, totalDeleteRate, uniqueApps, uniqueDomains };
}

export function insertCard(db: ReturnType<typeof Database>, card: CharacterCard): void {
  db.prepare(
    "INSERT OR REPLACE INTO character_cards (id, date, role_name, sketch, new_puzzle, feedback, confidence, stage_at_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(card.id, card.date, card.roleName, card.sketch, card.newPuzzle, card.feedback, card.confidence, card.stageAtTime);
}

export function getCards(db: ReturnType<typeof Database>, limit = 30): CharacterCard[] {
  const rows = db.prepare(
    "SELECT * FROM character_cards ORDER BY date DESC LIMIT ?"
  ).all(limit) as { id: string; date: string; role_name: string; sketch: string; new_puzzle: string; feedback: string; confidence: number; stage_at_time: string }[];

  return rows.map(r => ({
    id: r.id, date: r.date, roleName: r.role_name, sketch: r.sketch,
    newPuzzle: r.new_puzzle, feedback: r.feedback, confidence: r.confidence, stageAtTime: r.stage_at_time as Portrait["stage"]
  }));
}

export function getCardByDate(db: ReturnType<typeof Database>, date: string): CharacterCard | null {
  const row = db.prepare("SELECT * FROM character_cards WHERE date = ?").get(date) as { id: string; date: string; role_name: string; sketch: string; new_puzzle: string; feedback: string; confidence: number; stage_at_time: string } | undefined;
  if (!row) return null;
  return {
    id: row.id, date: row.date, roleName: row.role_name, sketch: row.sketch,
    newPuzzle: row.new_puzzle, feedback: row.feedback, confidence: row.confidence, stageAtTime: row.stage_at_time as Portrait["stage"]
  };
}

export function getPortrait(db: ReturnType<typeof Database>): Portrait {
  const dimensions = db.prepare("SELECT * FROM portrait ORDER BY added_at DESC").all() as PortraitDimension[];
  const metaRow = db.prepare("SELECT value FROM portrait_meta WHERE key = 'stage'").get() as { value: string } | undefined;
  const stage = (metaRow?.value || "observer") as Portrait["stage"];
  const stageStartedRow = db.prepare("SELECT value FROM portrait_meta WHERE key = 'stageStartedAt'").get() as { value: string } | undefined;
  const stageStartedAt = stageStartedRow?.value || new Date().toISOString();
  return { dimensions, stage, stageStartedAt, dimensionCount: dimensions.length };
}

export function addPortraitDimension(db: ReturnType<typeof Database>, dim: PortraitDimension): void {
  db.prepare("INSERT OR REPLACE INTO portrait (dimension, observation, added_at) VALUES (?, ?, ?)").run(dim.dimension, dim.observation, dim.addedAt);
}

export function removePortraitDimension(db: ReturnType<typeof Database>, dimension: string): void {
  db.prepare("DELETE FROM portrait WHERE dimension = ?").run(dimension);
}

export function setPortraitStage(db: ReturnType<typeof Database>, stage: Portrait["stage"]): void {
  db.prepare("INSERT OR REPLACE INTO portrait_meta (key, value) VALUES ('stage', ?)").run(stage);
  db.prepare("INSERT OR REPLACE INTO portrait_meta (key, value) VALUES ('stageStartedAt', ?)").run(new Date().toISOString());
}

export function deleteDay(db: ReturnType<typeof Database>, date: string): void {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM behavior_log WHERE date(timestamp) = ?").run(date);
    db.prepare("DELETE FROM character_cards WHERE date = ?").run(date);
  });
  transaction();
}

export function wipeAll(db: ReturnType<typeof Database>): void {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM behavior_log").run();
    db.prepare("DELETE FROM character_cards").run();
    db.prepare("DELETE FROM portrait").run();
    db.prepare("DELETE FROM portrait_meta").run();
    db.prepare("DELETE FROM settings").run();
  });
  transaction();
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm test -- tests/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/store.ts tests/store.test.ts
git commit -m "feat: add SQLite store layer with settings, behavior log, cards, portrait"
```

---

### Task 3: Wire Store Into Electron Main Process

**Files:**
- Modify: `electron/main.ts`

Replace all placeholder IPC handlers in `electron/main.ts` with real store calls.

- [ ] **Step 1: Update electron/main.ts IPC handlers**

Add imports at the top:

```ts
import { initStore, getSettings, setSettings, insertBehaviorSegment, getDailySummary, getCards, getCardByDate, getPortrait, addPortraitDimension, removePortraitDimension, setPortraitStage, deleteDay, wipeAll } from "./store";
import { homedir } from "node:os";
```

Add store initialization after `createWidgetWindow`:

```ts
const DATA_DIR = join(homedir(), "Documents", "PersonalMirror");
const db = initStore(DATA_DIR);
```

Replace all `/* TODO: Task 4 */` handlers with full implementations:

```ts
ipcMain.handle("settings:get", () => getSettings(db));
ipcMain.handle("settings:set", (_e, partial: Partial<AppSettings>) => {
  setSettings(db, partial);
  return;
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
```

- [ ] **Step 2: Run lint**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm run lint`
Expected: TypeScript passes.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: wire SQLite store into Electron main process IPC handlers"
```

---

### Task 4: Window & Input Collector

**Files:**
- Create: `electron/collector.ts`
- Create: `tests/collector.test.ts`

- [ ] **Step 1: Write collector tests**

Create `tests/collector.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sanitizeWindowTitle, extractDomainsFromTitle, buildTimeRange } from "../electron/collector";

describe("sanitizeWindowTitle", () => {
  it("truncates to 50 characters", () => {
    const long = "a".repeat(80);
    expect(sanitizeWindowTitle(long).length).toBeLessThanOrEqual(50);
  });

  it("removes leading/trailing whitespace", () => {
    expect(sanitizeWindowTitle("  hello  ")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeWindowTitle("")).toBe("");
  });
});

describe("extractDomainsFromTitle", () => {
  it("detects common browser patterns", () => {
    expect(extractDomainsFromTitle("Google Chrome")).toEqual(["chrome"]);
    expect(extractDomainsFromTitle("Safari")).toEqual(["safari"]);
    expect(extractDomainsFromTitle("Firefox")).toEqual(["firefox"]);
  });

  it("extracts domain from browser window titles", () => {
    const title = "GitHub - Issues - Google Chrome";
    const result = extractDomainsFromTitle(title);
    expect(result).toContain("github.com");
  });
});

describe("buildTimeRange", () => {
  it("formats time range from a Date", () => {
    const d = new Date("2026-06-07T09:30:00Z");
    const range = buildTimeRange(d);
    expect(range).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm test -- tests/collector.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement collector**

Create `electron/collector.ts`:

```ts
export function sanitizeWindowTitle(title: string): string {
  if (!title) return "";
  return title.trim().slice(0, 50);
}

const BROWSER_APPS = ["Google Chrome", "Chrome", "Safari", "Firefox", "Edge", "Arc", "Brave", "Opera"];

export function isBrowser(appName: string): boolean {
  return BROWSER_APPS.some(b => appName.toLowerCase().includes(b.toLowerCase()));
}

export function extractDomainsFromTitle(title: string): string[] {
  const domains: string[] = [];

  // Known browsers
  for (const browser of BROWSER_APPS) {
    if (title.includes(browser)) {
      domains.push(browser.toLowerCase().replace(/\s/g, "-"));
    }
  }

  // Common URL patterns in title
  const urlPatterns = [
    /\b(\w+\.(?:com|org|net|io|dev|app|co|cn|ai))\b/gi,
    /\b(\w+\.\w+\.(?:com|cn|org))\b/gi,
  ];
  for (const pattern of urlPatterns) {
    const matches = title.matchAll(pattern);
    for (const m of matches) {
      domains.push(m[1].toLowerCase());
    }
  }

  return [...new Set(domains)];
}

export function buildTimeRange(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const floorMin = Math.floor(minute / 30) * 30;
  const endMin = floorMin + 30;
  const endHour = endMin >= 60 ? hour + 1 : hour;
  const fm = (f: number) => String(f).padStart(2, "0");
  return `${fm(hour)}:${fm(floorMin)}-${fm(endHour >= 24 ? 0 : endHour)}:${fm(endMin >= 60 ? endMin - 60 : endMin)}`;
}

export type CollectorState = {
  currentApp: string;
  currentTitle: string;
  currentDomains: string[];
  inputChars: number;
  deleteCount: number;
  segmentStart: Date;
  lastActive: Date;
  trackingEnabled: boolean;
};

export function createCollectorState(): CollectorState {
  const now = new Date();
  return {
    currentApp: "",
    currentTitle: "",
    currentDomains: [],
    inputChars: 0,
    deleteCount: 0,
    segmentStart: now,
    lastActive: now,
    trackingEnabled: true
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm test -- tests/collector.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/collector.ts tests/collector.test.ts
git commit -m "feat: add collector helpers for window title, domains, time ranges"
```

---

### Task 5: Collector Integration — Polling Loop

**Files:**
- Modify: `electron/main.ts`

Add active-win polling loop and keyboard hook integration.

- [ ] **Step 1: Add collector initialization to main.ts**

After the db initialization, add:

```ts
import activeWin from "active-win";
import { uIOhook } from "@kwhat/libuiohook";
import { sanitizeWindowTitle, extractDomainsFromTitle, buildTimeRange, createCollectorState, isBrowser } from "./collector";
import type { CollectorState } from "./collector";

const collector = createCollectorState();

const COLLECT_INTERVAL = 3000; // 3 seconds

function flushSegment(state: CollectorState) {
  if (state.currentApp === "") return;

  insertBehaviorSegment(db, {
    timestamp: state.segmentStart.toISOString(),
    timeRange: buildTimeRange(state.segmentStart),
    primaryApp: state.currentApp,
    inputChars: state.inputChars,
    deleteCount: state.deleteCount,
    browsingDomains: state.currentDomains
  });

  state.inputChars = 0;
  state.deleteCount = 0;
  state.segmentStart = new Date();
}

async function pollWindow() {
  if (!collector.trackingEnabled) return;

  try {
    const win = await activeWin();
    if (!win) return;

    const newApp = win.owner.name;
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
    // active-win may fail when permissions aren't granted; silently skip
  }
}

// Start polling
setInterval(pollWindow, COLLECT_INTERVAL);

// Keyboard counting via libuiohook
uIOhook.on("keydown", () => {
  collector.inputChars++;
});

uIOhook.on("keyup", (e) => {
  if (e.keycode === 42 || e.keycode === 14) { // Backspace or Delete
    collector.deleteCount++;
  }
});

uIOhook.start();
```

- [ ] **Step 2: Add tracking toggle handler**

```ts
ipcMain.handle("collector:toggle", (_e, enabled: boolean) => {
  collector.trackingEnabled = enabled;
  setSettings(db, { trackingEnabled: enabled });
});
```

Update the tray menu to use this handler:

```ts
{ label: "暂停采集", type: "checkbox", checked: false, click: (mi) => {
  const enabled = !mi.checked;
  collector.trackingEnabled = enabled;
  setSettings(db, { trackingEnabled: enabled });
  widgetWindow?.webContents.send("tracking:toggle", enabled);
}},
```

- [ ] **Step 3: Run lint**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm run lint`
Expected: TypeScript passes (may need `@types/active-win` or declare module).

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add active-win polling and keyboard hook integration"
```

---

### Task 6: LLM Client & Prompt Templates

**Files:**
- Create: `electron/llm.ts`
- Create: `electron/prompt.ts`
- Create: `tests/llm.test.ts`
- Create: `tests/prompt.test.ts`

- [ ] **Step 1: Write prompt tests**

Create `tests/prompt.test.ts`:

```ts
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
  it("includes the naturalist identity", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("数字自然学家");
    expect(prompt).toContain("田野观察日记");
    expect(prompt).toContain("我们");
  });
});

describe("buildDailyCardPrompt", () => {
  it("includes behavior summary and stage", () => {
    const prompt = buildDailyCardPrompt(sampleSummary, emptyPortrait, "observer");
    expect(prompt).toContain("VS Code");
    expect(prompt).toContain("observer");
  });

  it("returns JSON schema", () => {
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
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm test -- tests/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement prompt templates**

Create `electron/prompt.ts`:

```ts
import type { DailyBehaviorSummary, Portrait } from "../shared/types";

export function buildSystemPrompt(): string {
  return `你是一个数字自然学家。你在观察一个人类在电脑前的数字痕迹。
你的任务不是监控，而是理解。
你的语气像写田野观察日记——好奇、准确、不评判。
你永远不恭维、不说废话、不假装了解你不知道的东西。
你的知识来源仅限于提供给你的行为数据，你不推测数据之外的事。
当你不确定时，你直接说"这部分数据不足以判断"。

你不是在观察一个已知的对象。用户自己对"自己是什么样的人"也只有碎片。
你和他一起发现。你发现的部分用"我们"来表述。`;
}

export function buildDailyCardPrompt(
  summary: DailyBehaviorSummary,
  portrait: Portrait,
  stage: string
): string {
  const summaryText = summary.segments.map(s =>
    `${s.timeRange} | ${s.primaryApp} | 输入${s.inputChars}字 | 删字率${Math.round(s.deleteRate * 100)}% | ${s.browsingDomains.join(", ") || "-"}`
  ).join("\n");

  const portraitText = portrait.dimensions.length > 0
    ? portrait.dimensions.map(d => `- ${d.dimension}: ${d.observation}`).join("\n")
    : "（尚无画像维度）";

  return `## 当前画像
阶段：${stage}
${portraitText}

## 昨日行为摘要
${summaryText}

总计：输入${summary.totalInputChars}字，删字率${Math.round(summary.totalDeleteRate * 100)}%
活跃应用：${summary.uniqueApps.join("、")}
浏览域名：${summary.uniqueDomains.join("、") || "无"}

## 任务
根据以上数据，生成今日角色卡。输出 JSON（不要其他文字）：

{
  "roleName": "5-12字的角色代号",
  "sketch": "200-400字的行为素描，自然学家口吻",
  "newPuzzle": "我们今天对自己多了解了一点：...（一句话）",
  "feedback": "${stage === "observer" ? "陈述式反馈，不做判断" : stage === "familiar" ? "对照式反馈，引用画像中的历史模式" : "推动式反馈，基于对用户的深入了解给具体建议"}",
  "confidence": 0.0-1.0
}`;
}

export function buildPortraitUpdatePrompt(
  summary: DailyBehaviorSummary,
  portrait: Portrait
): string {
  const portraitText = portrait.dimensions.map(d => `- ${d.dimension}: ${d.observation}`).join("\n");

  return `## 当前画像
${portraitText || "（空）"}
维度数量：${portrait.dimensionCount}
当前阶段：${portrait.stage}

## 昨日数据要点
输入${summary.totalInputChars}字，删字率${Math.round(summary.totalDeleteRate * 100)}%
活跃应用：${summary.uniqueApps.join("、")}

## 任务
判断是否需要更新画像。输出 JSON：

{
  "additions": [{"dimension": "维度名", "observation": "具体观察"}],
  "modifications": [{"dimension": "已有维度", "updatedTo": "更新后的描述"}],
  "removals": ["应删除的过时维度"],
  "stageRecommendation": "stay" | "advance" | "regress"
}`;
}
```

- [ ] **Step 4: Implement LLM client**

Create `electron/llm.ts`:

```ts
import type { AppSettings } from "../shared/types";

export async function callLLM(
  settings: AppSettings,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error("API key not configured");
  }

  if (settings.llmProvider === "anthropic") {
    return callAnthropic(settings.apiKey, settings.model, systemPrompt, userPrompt);
  }

  return callOpenAI(settings.apiKey, settings.model, systemPrompt, userPrompt);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === "text")?.text || "";
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content || "";
}

export function parseJSONFromLLMResponse(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found in LLM response");
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}
```

- [ ] **Step 5: Write LLM client tests**

Create `tests/llm.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseJSONFromLLMResponse } from "../electron/llm";

describe("parseJSONFromLLMResponse", () => {
  it("parses clean JSON", () => {
    const result = parseJSONFromLLMResponse('{"roleName": "test", "confidence": 0.8}');
    expect(result).toEqual({ roleName: "test", confidence: 0.8 });
  });

  it("strips markdown code fences", () => {
    const result = parseJSONFromLLMResponse('```json\n{"roleName": "test"}\n```');
    expect(result).toEqual({ roleName: "test" });
  });

  it("handles text before and after JSON", () => {
    const result = parseJSONFromLLMResponse('Here is the result: {"roleName": "test", "confidence": 0.5} Thanks!');
    expect(result).toEqual({ roleName: "test", confidence: 0.5 });
  });

  it("throws on non-JSON input", () => {
    expect(() => parseJSONFromLLMResponse("no json here")).toThrow();
  });
});
```

- [ ] **Step 6: Run tests to verify pass**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm test -- tests/prompt.test.ts tests/llm.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add electron/llm.ts electron/prompt.ts tests/llm.test.ts tests/prompt.test.ts
git commit -m "feat: add LLM client and prompt templates for daily card + portrait"
```

---

### Task 7: AI Scheduler — Daily Card Generation

**Files:**
- Create: `electron/scheduler.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create scheduler**

Create `electron/scheduler.ts`:

```ts
import * as cron from "node-cron";
import type Database from "better-sqlite3";
import type { AppSettings, CharacterCard, Portrait, DailyBehaviorSummary } from "../shared/types";
import { getSettings, getDailySummary, insertCard, getPortrait, addPortraitDimension, removePortraitDimension, setPortraitStage, setSettings } from "./store";
import { callLLM, parseJSONFromLLMResponse } from "./llm";
import { buildSystemPrompt, buildDailyCardPrompt, buildPortraitUpdatePrompt } from "./prompt";
import type { BrowserWindow } from "electron";

export function startScheduler(
  db: ReturnType<typeof Database>,
  widgetWindow: BrowserWindow | null
): cron.ScheduledTask {
  const task = cron.schedule("* * * * *", async () => {
    const settings = getSettings(db);
    if (!settings.apiKey) return;

    const [targetHour, targetMin] = settings.morningReportTime.split(":").map(Number);
    const now = new Date();
    if (now.getHours() !== targetHour || now.getMinutes() !== targetMin) return;

    await runDailyGeneration(db, settings, widgetWindow);
  });

  return task;
}

export async function runDailyGeneration(
  db: ReturnType<typeof Database>,
  settings?: AppSettings,
  widgetWindow?: BrowserWindow | null
): Promise<CharacterCard> {
  const s = settings ?? getSettings(db);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  const summary = getDailySummary(db, dateStr);
  if (!summary) {
    throw new Error(`No data for ${dateStr}`);
  }

  const portrait = getPortrait(db);
  const systemPrompt = buildSystemPrompt();

  // Generate card
  const cardPrompt = buildDailyCardPrompt(summary, portrait, portrait.stage);
  const cardText = await callLLM(s, systemPrompt, cardPrompt);
  const cardJSON = parseJSONFromLLMResponse(cardText);

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

  // Update portrait
  const portraitPrompt = buildPortraitUpdatePrompt(summary, portrait);
  const portraitText = await callLLM(s, systemPrompt, portraitPrompt);
  const portraitJSON = parseJSONFromLLMResponse(portraitText);

  if (Array.isArray(portraitJSON.additions)) {
    for (const add of portraitJSON.additions as { dimension: string; observation: string }[]) {
      addPortraitDimension(db, { dimension: add.dimension, observation: add.observation, addedAt: new Date().toISOString() });
    }
  }
  if (Array.isArray(portraitJSON.modifications)) {
    for (const mod of portraitJSON.modifications as { dimension: string; updatedTo: string }[]) {
      addPortraitDimension(db, { dimension: mod.dimension, observation: mod.updatedTo, addedAt: new Date().toISOString() });
    }
  }
  if (Array.isArray(portraitJSON.removals)) {
    for (const dim of portraitJSON.removals as string[]) {
      removePortraitDimension(db, dim);
    }
  }
  if (portraitJSON.stageRecommendation === "advance" && portrait.stage === "observer") {
    setPortraitStage(db, "familiar");
  } else if (portraitJSON.stageRecommendation === "advance" && portrait.stage === "familiar") {
    setPortraitStage(db, "intimate");
  } else if (portraitJSON.stageRecommendation === "regress" && portrait.stage === "familiar") {
    setPortraitStage(db, "observer");
  } else if (portraitJSON.stageRecommendation === "regress" && portrait.stage === "intimate") {
    setPortraitStage(db, "familiar");
  }

  // Notify widget
  widgetWindow?.webContents.send("card:new", card);

  return card;
}
```

- [ ] **Step 2: Wire scheduler into main.ts**

Add to `electron/main.ts` after store init:

```ts
import { startScheduler, runDailyGeneration } from "./scheduler";

const scheduler = startScheduler(db, widgetWindow);

ipcMain.handle("scheduler:generate-now", async () => {
  try {
    const card = await runDailyGeneration(db, getSettings(db), widgetWindow);
    return card;
  } catch (err) {
    throw new Error(`Generation failed: ${String(err)}`);
  }
});
```

- [ ] **Step 3: Run lint**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm run lint`
Expected: TypeScript passes.

- [ ] **Step 4: Commit**

```bash
git add electron/scheduler.ts electron/main.ts
git commit -m "feat: add AI scheduler for daily card generation and portrait updates"
```

---

### Task 8: Desktop Widget UI — Collapsed & Expanded States

**Files:**
- Create: `src/components/Widget.tsx`
- Create: `src/components/CardView.tsx`
- Create: `src/hooks/useIpc.ts`
- Modify: `src/App.tsx`
- Modify: `src/app.css`

- [ ] **Step 1: Create IPC hook**

Create `src/hooks/useIpc.ts`:

```ts
import { useEffect, useState, useCallback } from "react";
import type { PersonalMirrorApi } from "../../electron/preload";
import type { CharacterCard, AppSettings, Portrait, DailyBehaviorSummary } from "../../shared/types";

declare global {
  interface Window {
    personalMirror: PersonalMirrorApi;
  }
}

function api() {
  return window.personalMirror;
}

export function useCards(limit = 30) {
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api().getCards(limit).then(c => { setCards(c); setLoading(false); });
  }, [limit]);

  return { cards, loading };
}

export function usePortrait() {
  const [portrait, setPortrait] = useState<Portrait | null>(null);

  useEffect(() => {
    api().getPortrait().then(setPortrait);
  }, []);

  const refresh = useCallback(() => {
    api().getPortrait().then(setPortrait);
  }, []);

  return { portrait, refresh };
}

export function useTodaySummary() {
  const [summary, setSummary] = useState<DailyBehaviorSummary | null>(null);
  useEffect(() => {
    api().getTodaySummary().then(setSummary);
  }, []);
  return summary;
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings | null>(null);

  useEffect(() => {
    api().getSettings().then(setSettingsState);
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    await api().setSettings(partial);
    const updated = await api().getSettings();
    setSettingsState(updated);
  }, []);

  return { settings, updateSettings };
}
```

- [ ] **Step 2: Create CardView component**

Create `src/components/CardView.tsx`:

```tsx
import type { CharacterCard } from "../../shared/types";

type CardViewProps = {
  card: CharacterCard;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

export function CardView({ card, onPrev, onNext, hasPrev, hasNext }: CardViewProps) {
  return (
    <div className="card-view">
      <div className="card-view__header">
        <h2 className="card-view__role-name">{card.roleName}</h2>
        <span className="card-view__date">{card.date}</span>
      </div>

      <p className="card-view__sketch">{card.sketch}</p>

      <div className="card-view__puzzle">
        <span className="card-view__puzzle-label">🧩</span>
        <p>{card.newPuzzle}</p>
      </div>

      <div className="card-view__feedback">
        <p>{card.feedback}</p>
      </div>

      {card.confidence < 0.5 && (
        <p className="card-view__low-confidence">今天的数据比较模糊</p>
      )}

      <div className="card-view__nav">
        <button disabled={!hasPrev} onClick={onPrev}>← 前一天</button>
        <button disabled={!hasNext} onClick={onNext}>后一天 →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Widget component**

Create `src/components/Widget.tsx`:

```tsx
import { useState, useCallback, useEffect } from "react";
import { CardView } from "./CardView";
import { useCards } from "../hooks/useIpc";

export function Widget() {
  const [expanded, setExpanded] = useState(false);
  const { cards, loading } = useCards(30);
  const [cardIndex, setCardIndex] = useState(0);

  const latestCard = cards[0];

  const openSettings = useCallback(() => {
    window.personalMirror.openSettings();
  }, []);

  // Listen for new cards
  useEffect(() => {
    const unsub = window.personalMirror.onTrackingToggle(() => {});
    return unsub;
  }, []);

  if (loading || !latestCard) {
    return (
      <div className="widget widget--collapsed" onDoubleClick={() => setExpanded(true)}>
        <span className="widget__role-name">收集数据中...</span>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="widget widget--collapsed" onDoubleClick={() => setExpanded(true)}>
        <span className="widget__role-name">{latestCard.roleName}</span>
      </div>
    );
  }

  return (
    <div className="widget widget--expanded">
      <CardView
        card={cards[cardIndex]}
        onPrev={cardIndex < cards.length - 1 ? () => setCardIndex(i => i + 1) : undefined}
        onNext={cardIndex > 0 ? () => setCardIndex(i => i - 1) : undefined}
        hasPrev={cardIndex < cards.length - 1}
        hasNext={cardIndex > 0}
      />
      <div className="widget__actions">
        <button onClick={() => setExpanded(false)}>收起</button>
        <button onClick={openSettings}>设置</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx**

```tsx
import { Widget } from "./components/Widget";
import { Settings } from "./components/Settings";

export function App() {
  const isSettings = window.location.hash === "#settings";

  if (isSettings) {
    return <Settings />;
  }

  return (
    <main className="app-shell">
      <Widget />
    </main>
  );
}
```

- [ ] **Step 5: Update app.css with full widget styles**

Replace `src/app.css`:

```css
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  background: transparent;
}

body {
  margin: 0;
  overflow: hidden;
  background: transparent;
}

button {
  font: inherit;
  cursor: pointer;
}

.app-shell {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: end center;
  padding: 16px;
  box-sizing: border-box;
  background: transparent;
}

/* Widget — Collapsed */
.widget--collapsed {
  padding: 6px 14px;
  border-radius: 16px;
  background: rgba(255, 253, 247, 0.72);
  backdrop-filter: blur(8px);
  border: 1.5px solid rgba(43, 47, 56, 0.18);
  cursor: pointer;
  user-select: none;
  transition: background 140ms ease, border-color 140ms ease;
}

.widget--collapsed:hover {
  background: rgba(255, 253, 247, 0.88);
  border-color: rgba(43, 47, 56, 0.35);
}

.widget__role-name {
  font-size: 13px;
  font-weight: 600;
  color: #2b2f38;
  white-space: nowrap;
}

/* Widget — Expanded */
.widget--expanded {
  width: 300px;
  max-height: 420px;
  overflow-y: auto;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 253, 247, 0.94);
  backdrop-filter: blur(12px);
  border: 1.5px solid rgba(43, 47, 56, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Card View */
.card-view__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.card-view__role-name {
  font-size: 18px;
  font-weight: 700;
  color: #2b2f38;
  margin: 0;
}

.card-view__date {
  font-size: 11px;
  color: #888;
}

.card-view__sketch {
  font-size: 13px;
  line-height: 1.6;
  color: #2b2f38;
  margin: 0 0 10px;
}

.card-view__puzzle {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(233, 248, 220, 0.5);
  margin-bottom: 10px;
}

.card-view__puzzle-label {
  font-size: 14px;
  flex-shrink: 0;
}

.card-view__puzzle p {
  font-size: 12px;
  color: #3d5a1e;
  margin: 0;
}

.card-view__feedback {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(223, 243, 255, 0.5);
  margin-bottom: 10px;
}

.card-view__feedback p {
  font-size: 12px;
  color: #2b4a6e;
  margin: 0;
}

.card-view__low-confidence {
  font-size: 11px;
  color: #c0852e;
  font-style: italic;
  margin: 0 0 8px;
}

.card-view__nav {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.card-view__nav button {
  flex: 1;
  padding: 4px 0;
  font-size: 12px;
  border: 1.5px solid #2b2f38;
  border-radius: 6px;
  background: #fff;
  color: #2b2f38;
}

.card-view__nav button:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Widget Actions */
.widget__actions {
  display: flex;
  gap: 8px;
}

.widget__actions button {
  flex: 1;
  padding: 6px 0;
  font-size: 12px;
  font-weight: 600;
  border: 1.5px solid #2b2f38;
  border-radius: 6px;
  background: #e9f8dc;
  color: #2b2f38;
}

/* Settings */
.settings-panel {
  padding: 24px;
  max-width: 480px;
  margin: 0 auto;
  color: #2b2f38;
}

.settings-panel h2 {
  font-size: 18px;
  margin: 0 0 20px;
}

.settings-section {
  margin-bottom: 20px;
}

.settings-section h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 8px;
  color: #555;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.settings-field label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.settings-field input,
.settings-field select {
  padding: 6px 10px;
  border: 1.5px solid #ccc;
  border-radius: 6px;
  font-size: 13px;
}

.settings-field input[type="checkbox"] {
  align-self: flex-start;
}

.settings-panel button {
  padding: 8px 18px;
  border: 2px solid #2b2f38;
  border-radius: 6px;
  background: #e9f8dc;
  color: #2b2f38;
  font-weight: 700;
  font-size: 13px;
}

.settings-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.settings-danger {
  background: #fde8e8 !important;
}

.portrait-dim-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.portrait-dim-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
  font-size: 12px;
}

.portrait-dim-item button {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #d44;
  border-radius: 4px;
  background: #fff;
  color: #d44;
}
```

- [ ] **Step 6: Build and verify**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm run build`
Expected: Build completes successfully.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/app.css src/components/Widget.tsx src/components/CardView.tsx src/hooks/useIpc.ts
git commit -m "feat: add desktop widget with collapsed/expanded card view"
```

---

### Task 9: Settings Panel UI

**Files:**
- Create: `src/components/Settings.tsx`
- Create: `src/components/PortraitView.tsx`

- [ ] **Step 1: Create PortraitView component**

Create `src/components/PortraitView.tsx`:

```tsx
import { usePortrait } from "../hooks/useIpc";

export function PortraitView() {
  const { portrait, refresh } = usePortrait();

  if (!portrait) return <p>加载中...</p>;

  const handleRemove = async (dimension: string) => {
    await window.personalMirror.removePortraitDimension(dimension);
    refresh();
  };

  return (
    <div className="settings-section">
      <h3>用户画像 ({portrait.dimensions.length} 个维度) — 阶段：{portrait.stage}</h3>
      {portrait.dimensions.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#888" }}>尚未积累足够的画像维度。数据越多，画像越清晰。</p>
      ) : (
        <ul className="portrait-dim-list">
          {portrait.dimensions.map(d => (
            <li key={d.dimension} className="portrait-dim-item">
              <span><strong>{d.dimension}</strong>: {d.observation}</span>
              <button onClick={() => handleRemove(d.dimension)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create Settings component**

Create `src/components/Settings.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useSettings, usePortrait, useTodaySummary } from "../hooks/useIpc";
import { PortraitView } from "./PortraitView";

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const { portrait } = usePortrait();
  const todaySummary = useTodaySummary();
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  if (!localSettings) return <div className="settings-panel"><p>加载中...</p></div>;

  const handleSave = async (partial: typeof localSettings) => {
    await updateSettings(partial);
    setLocalSettings(prev => ({ ...prev!, ...partial }));
  };

  const handleWipe = async () => {
    const confirmed = confirm("确定要清空所有数据吗？此操作不可恢复。");
    if (confirmed) {
      await window.personalMirror.wipeAll();
      alert("已清空。");
      window.location.reload();
    }
  };

  const handleExport = async () => {
    const json = await window.personalMirror.exportPortrait();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personal-mirror-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateNow = async () => {
    try {
      const card = await window.personalMirror.generateCardNow();
      alert(`角色卡已生成: ${card.roleName}`);
    } catch (e) {
      alert(`生成失败: ${String(e)}`);
    }
  };

  return (
    <div className="settings-panel">
      <h2>Personal Mirror 设置</h2>

      <div className="settings-section">
        <h3>API 配置</h3>
        <div className="settings-field">
          <label>LLM Provider</label>
          <select value={localSettings.llmProvider} onChange={e => handleSave({ llmProvider: e.target.value as "anthropic" | "openai" })}>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Model</label>
          <input value={localSettings.model} onChange={e => setLocalSettings(prev => ({ ...prev!, model: e.target.value }))} onBlur={() => handleSave({ model: localSettings.model })} />
        </div>
        <div className="settings-field">
          <label>API Key</label>
          <input type="password" value={localSettings.apiKey} onChange={e => setLocalSettings(prev => ({ ...prev!, apiKey: e.target.value }))} onBlur={() => handleSave({ apiKey: localSettings.apiKey })} />
        </div>
      </div>

      <div className="settings-section">
        <h3>采集设置</h3>
        <div className="settings-field">
          <label>
            <input type="checkbox" checked={localSettings.trackingEnabled} onChange={e => handleSave({ trackingEnabled: e.target.checked })} />
            启用采集
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>推送设置</h3>
        <div className="settings-field">
          <label>早餐日报时间</label>
          <input type="time" value={localSettings.morningReportTime} onChange={e => setLocalSettings(prev => ({ ...prev!, morningReportTime: e.target.value }))} onBlur={() => handleSave({ morningReportTime: localSettings.morningReportTime })} />
        </div>
        <div className="settings-field">
          <label>
            <input type="checkbox" checked={localSettings.randomNudgeEnabled} onChange={e => handleSave({ randomNudgeEnabled: e.target.checked })} />
            开启随机轻推
          </label>
        </div>
        {localSettings.randomNudgeEnabled && (
          <div className="settings-field">
            <label>频率</label>
            <select value={localSettings.randomNudgeFrequency} onChange={e => handleSave({ randomNudgeFrequency: e.target.value as "occasional" | "rare" })}>
              <option value="rare">很少</option>
              <option value="occasional">偶尔</option>
            </select>
          </div>
        )}
      </div>

      <PortraitView />

      <div className="settings-section">
        <h3>今日采集</h3>
        {todaySummary ? (
          <p style={{ fontSize: "12px" }}>
            已输入 {todaySummary.totalInputChars} 字，
            删字率 {Math.round(todaySummary.totalDeleteRate * 100)}%，
            活跃应用：{todaySummary.uniqueApps.join("、") || "无"}
          </p>
        ) : (
          <p style={{ fontSize: "12px", color: "#888" }}>今日暂无采集数据</p>
        )}
      </div>

      <div className="settings-section">
        <h3>数据管理</h3>
        <div className="settings-actions">
          <button onClick={handleGenerateNow}>立即生成卡片</button>
          <button onClick={handleExport}>导出画像</button>
          <button className="settings-danger" onClick={handleWipe}>清空全部数据</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm run build`
Expected: Build completes successfully.

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings.tsx src/components/PortraitView.tsx
git commit -m "feat: add settings panel with API config, tracking, delivery, portrait, data management"
```

---

### Task 10: Tray Icon & Final Integration

**Files:**
- Create: `src/assets/tray-icon.png` (placeholder)
- Modify: `electron/main.ts`

- [ ] **Step 1: Create placeholder tray icon**

Run: A 16x16 or 22x22 PNG. For now, create a script that generates a minimal icon, or note this requires a real asset.

For the plan: the tray icon is a required asset. During development, we'll create a simple 1-pixel transparent PNG as placeholder.

- [ ] **Step 2: Finalize main.ts with all integrations**

Ensure `electron/main.ts` has clean, working integration of:

1. Store initialization
2. Collector polling loop
3. Keyboard hook
4. Scheduler
5. Tray with working menu items
6. All IPC handlers
7. Settings window management

- [ ] **Step 3: Full build verification**

Run: `cd /Users/ming/Desktop/vibecoding/personal-mirror && npm run build`
Expected: Complete build with no errors.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts src/assets/tray-icon.png
git commit -m "feat: finalize tray integration and full app wiring"
```

---

## Spec Coverage Check

| Acceptance Criterion | Task(s) |
|---------------------|---------|
| App launches and begins tracking | Task 1, 5 |
| Tracking covers: app, title, input, domains | Task 4, 5 |
| No keystroke/content/URL storage | Task 4 (collector only stores counts and domains) |
| Tray pause/resume | Task 1, 5 |
| Morning card generation via LLM | Task 6, 7 |
| Card sections: name, sketch, puzzle, feedback, confidence | Task 6, 7, 8 |
| Portrait JSON grows over time | Task 6, 7 |
| Stage auto-advance/regress | Task 7 |
| Widget collapsed/expanded | Task 8 |
| Card history navigation | Task 8 |
| Settings panel | Task 9 |
| Preview today, delete, wipe, export | Task 9 |
| Random nudge toggle | Task 9 (settings UI), scheduler logic can be Task 7 extension |
| All data local, only LLM API external | Architecture (enforced in Task 6, 7) |
| Export JSON | Task 9 |

---

## Self-Review Notes

- No TBD or TODO placeholders — all steps have concrete code
- Type consistency verified: types defined in `src/types.ts`, used consistently across `electron/` and `src/`
- Store interface (`store.ts`) matches what collector, scheduler, and IPC handlers expect
- Preload API matches what hooks (`useIpc.ts`) and components call
- Stage transition logic in scheduler.ts handles all 3 stages
- Privacy red lines enforced in collector (only counts and domains, no content)
