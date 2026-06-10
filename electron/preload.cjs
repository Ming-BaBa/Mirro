const { contextBridge, ipcRenderer } = require("electron");

const api = {
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
    const handler = (_e, partial) => cb(partial);
    ipcRenderer.on("settings:changed", handler);
    return () => ipcRenderer.removeListener("settings:changed", handler);
  },
  onTrackingToggle: (cb) => {
    const handler = (_e, enabled) => cb(enabled);
    ipcRenderer.on("tracking:toggle", handler);
    return () => ipcRenderer.removeListener("tracking:toggle", handler);
  },
  onCardNew: (cb) => {
    const handler = (_e, card) => cb(card);
    ipcRenderer.on("card:new", handler);
    return () => ipcRenderer.removeListener("card:new", handler);
  },
  onKeystroke: (cb) => {
    const handler = (_e, char) => cb(char);
    ipcRenderer.on("keystroke:char", handler);
    return () => ipcRenderer.removeListener("keystroke:char", handler);
  },
  onKeystrokeAnim: (cb) => {
    const handler = (_e, anim) => cb(anim);
    ipcRenderer.on("keystroke:anim", handler);
    return () => ipcRenderer.removeListener("keystroke:anim", handler);
  },
  onNudge: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on("nudge:show", handler);
    return () => ipcRenderer.removeListener("nudge:show", handler);
  },
  onGenerationProgress: (cb) => {
    const handler = (_e, phase) => cb(phase);
    ipcRenderer.on("generation:progress", handler);
    return () => ipcRenderer.removeListener("generation:progress", handler);
  },
  applyPortraitProposal: (proposal) => ipcRenderer.invoke("portrait:apply-proposal", proposal),
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory")
};

contextBridge.exposeInMainWorld("mirro", api);
