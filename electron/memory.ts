import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from "node:fs";

const MAX_MEMORY_KB = 30; // ~30KB total limit

export interface MemoryEntry {
  time: string;
  summary: string;
  tags: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  time: string;
}

function memoryDir(dataDir: string) {
  const dir = join(dataDir, "memories");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveMemory(dataDir: string, date: string, entries: MemoryEntry[]) {
  const dir = memoryDir(dataDir);
  const path = join(dir, `${date}.json`);
  writeFileSync(path, JSON.stringify(entries, null, 2), "utf8");
}

export function appendMemory(dataDir: string, entry: MemoryEntry) {
  const today = new Date().toISOString().split("T")[0];
  const existing = loadDay(dataDir, today);
  existing.push(entry);
  saveMemory(dataDir, today, existing);
  pruneMemories(dataDir);
}

export function loadDay(dataDir: string, date: string): MemoryEntry[] {
  const path = join(memoryDir(dataDir), `${date}.json`);
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return []; }
}

export function loadRecentMemories(dataDir: string, days = 7): MemoryEntry[] {
  const dir = memoryDir(dataDir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort().reverse().slice(0, days);
  const all: MemoryEntry[] = [];
  for (const f of files) {
    try { all.push(...JSON.parse(readFileSync(join(dir, f), "utf8"))); } catch { /* skip */ }
  }
  return all;
}

export function getMemorySummary(dataDir: string): string {
  const entries = loadRecentMemories(dataDir, 7);
  if (entries.length === 0) return "";
  return entries.map(e => `- [${e.time}] ${e.summary}`).join("\n");
}

function pruneMemories(dataDir: string) {
  const dir = memoryDir(dataDir);
  if (!existsSync(dir)) return;

  // Check total size
  let totalSize = 0;
  const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  for (const f of files) {
    try { totalSize += statSync(join(dir, f)).size; } catch { /* skip */ }
  }

  const maxBytes = MAX_MEMORY_KB * 1024;
  if (totalSize <= maxBytes) return;

  // Delete oldest files until under limit
  for (const f of files) {
    if (totalSize <= maxBytes) break;
    const path = join(dir, f);
    try {
      totalSize -= statSync(path).size;
      unlinkSync(path);
    } catch { /* skip */ }
  }
}

// ── Chat persistence ────────────────────────────────────

function chatDir(dataDir: string) {
  const dir = join(dataDir, "chats");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveChat(dataDir: string, date: string, messages: ChatMessage[]) {
  const dir = chatDir(dataDir);
  const path = join(dir, `${date}.json`);
  writeFileSync(path, JSON.stringify(messages, null, 2), "utf8");
}

export function loadChat(dataDir: string, date: string): ChatMessage[] {
  const path = join(chatDir(dataDir), `${date}.json`);
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return []; }
}

export function clearChat(dataDir: string, date: string) {
  const path = join(chatDir(dataDir), `${date}.json`);
  if (existsSync(path)) unlinkSync(path);
}
