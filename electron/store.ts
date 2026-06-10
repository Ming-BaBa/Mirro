import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import type {
  AppSettings,
  BehaviorSegment,
  DailyBehaviorSummary,
  CharacterCard,
  Portrait,
  PortraitDimension,
  Stage,
} from "../shared/types.js";
import { DEFAULT_SETTINGS } from "../shared/types.js";

export interface BehaviorSegmentInput {
  timestamp: string;
  timeRange: string;
  primaryApp: string;
  inputChars: number;
  deleteCount: number;
  browsingDomains: string[];
  typedText?: string;
}

function openDb(dataDir: string): Database.Database {
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "mirro.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS behavior_log (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp        TEXT NOT NULL,
      date             TEXT NOT NULL,
      time_range       TEXT NOT NULL,
      primary_app      TEXT NOT NULL,
      input_chars      INTEGER NOT NULL DEFAULT 0,
      delete_count     INTEGER NOT NULL DEFAULT 0,
      browsing_domains TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS character_cards (
      id            TEXT PRIMARY KEY,
      date          TEXT NOT NULL UNIQUE,
      role_name     TEXT NOT NULL,
      sketch        TEXT NOT NULL,
      new_puzzle    TEXT NOT NULL,
      feedback      TEXT NOT NULL,
      confidence    REAL NOT NULL DEFAULT 0,
      stage_at_time TEXT NOT NULL,
      image_base64  TEXT
    );

    CREATE TABLE IF NOT EXISTS portrait (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      stage           TEXT NOT NULL DEFAULT 'observer',
      stage_started_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portrait_meta (
      dimension   TEXT PRIMARY KEY,
      observation TEXT NOT NULL,
      added_at    TEXT NOT NULL
    );
  `);

  // Ensure portrait singleton row exists
  const row = db.prepare("SELECT id FROM portrait WHERE id = 1").get();
  if (!row) {
    db.prepare(
      "INSERT INTO portrait (id, stage, stage_started_at) VALUES (1, ?, ?)"
    ).run("observer", new Date().toISOString());
  }

  // Migration: add image_base64 column if missing
  try {
    db.exec("ALTER TABLE character_cards ADD COLUMN image_base64 TEXT");
  } catch {
    // column already exists
  }

  // Migration: add typed_text column if missing
  try {
    db.exec("ALTER TABLE behavior_log ADD COLUMN typed_text TEXT DEFAULT ''");
  } catch {
    // column already exists
  }
}

// ── Public API ──────────────────────────────────────────────

export function initStore(dataDir: string): Database.Database {
  const db = openDb(dataDir);
  migrate(db);
  return db;
}

// ── Settings ────────────────────────────────────────────────

export function getSettings(db: Database.Database): AppSettings {
  const merged = { ...DEFAULT_SETTINGS };
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  for (const row of rows) {
    try {
      (merged as Record<string, unknown>)[row.key] = JSON.parse(row.value);
    } catch {
      (merged as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return merged;
}

export function setSettings(
  db: Database.Database,
  partial: Partial<AppSettings>,
): void {
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const tx = db.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) {
      upsert.run(key, JSON.stringify(value));
    }
  });
  tx(Object.entries(partial) as [string, string][]);
}

// ── Behavior Segments ──────────────────────────────────────

export function insertBehaviorSegment(
  db: Database.Database,
  segment: BehaviorSegmentInput,
): void {
  const date = segment.timestamp.slice(0, 10); // "YYYY-MM-DD"
  db.prepare(
    `INSERT INTO behavior_log (timestamp, date, time_range, primary_app, input_chars, delete_count, browsing_domains, typed_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    segment.timestamp,
    date,
    segment.timeRange,
    segment.primaryApp,
    segment.inputChars,
    segment.deleteCount,
    JSON.stringify(segment.browsingDomains),
     segment.typedText ?? "",
  );
}

export function getDailySummary(
  db: Database.Database,
  date: string,
): DailyBehaviorSummary | null {
  const rows = db
    .prepare(
      "SELECT time_range, primary_app, input_chars, delete_count, browsing_domains, typed_text FROM behavior_log WHERE date = ?",
    )
    .all(date) as {
    time_range: string;
    primary_app: string;
    input_chars: number;
    delete_count: number;
    browsing_domains: string;
    typed_text: string;
  }[];

  if (rows.length === 0) return null;

  const segments: BehaviorSegment[] = rows.map((r) => {
    const total = r.input_chars + r.delete_count;
    return {
      timeRange: r.time_range,
      primaryApp: r.primary_app,
      inputChars: r.input_chars,
      deleteRate: total > 0 ? r.delete_count / total : 0,
      browsingDomains: JSON.parse(r.browsing_domains) as string[],
      typedText: r.typed_text || "",
    };
  });

  const totalInputChars = segments.reduce((s, seg) => s + seg.inputChars, 0);
  let totalDeleteCount = 0;
  for (const r of rows) {
    totalDeleteCount += r.delete_count;
  }

  const appSet = new Set<string>();
  const domainSet = new Set<string>();
  for (const seg of segments) {
    appSet.add(seg.primaryApp);
    for (const d of seg.browsingDomains) {
      domainSet.add(d);
    }
  }

  const totalAll = totalInputChars + totalDeleteCount;
  return {
    date,
    segments,
    totalInputChars,
    totalDeleteRate: totalAll > 0 ? totalDeleteCount / totalAll : 0,
    uniqueApps: [...appSet].sort(),
    uniqueDomains: [...domainSet].sort(),
  };
}

// ── Character Cards ─────────────────────────────────────────

export function insertCard(
  db: Database.Database,
  card: CharacterCard,
): void {
  db.prepare(
    `INSERT OR REPLACE INTO character_cards (id, date, role_name, sketch, new_puzzle, feedback, confidence, stage_at_time, image_base64)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    card.id,
    card.date,
    card.roleName,
    card.sketch,
    card.newPuzzle,
    card.feedback,
    card.confidence,
    card.stageAtTime,
    card.imageBase64 ?? null,
  );
}

export function getCards(
  db: Database.Database,
  limit?: number,
): CharacterCard[] {
  const sql = limit
    ? "SELECT * FROM character_cards ORDER BY date DESC LIMIT ?"
    : "SELECT * FROM character_cards ORDER BY date DESC";
  const rows = limit
    ? (db.prepare(sql).all(limit) as Record<string, unknown>[])
    : (db.prepare(sql).all() as Record<string, unknown>[]);
  return rows.map(rowToCard);
}

export function getCardByDate(
  db: Database.Database,
  date: string,
): CharacterCard | null {
  const row = db
    .prepare("SELECT * FROM character_cards WHERE date = ?")
    .get(date) as Record<string, unknown> | undefined;
  return row ? rowToCard(row) : null;
}

function rowToCard(row: Record<string, unknown>): CharacterCard {
  return {
    id: row.id as string,
    date: row.date as string,
    roleName: row.role_name as string,
    sketch: row.sketch as string,
    newPuzzle: row.new_puzzle as string,
    feedback: row.feedback as string,
    confidence: row.confidence as number,
    stageAtTime: row.stage_at_time as Stage,
    imageBase64: row.image_base64 as string | undefined,
  };
}

// ── Portrait ────────────────────────────────────────────────

export function getPortrait(db: Database.Database): Portrait {
  const portraitRow = db
    .prepare("SELECT stage, stage_started_at FROM portrait WHERE id = 1")
    .get() as { stage: Stage; stage_started_at: string };

  const dimRows = db
    .prepare("SELECT dimension, observation, added_at FROM portrait_meta")
    .all() as { dimension: string; observation: string; added_at: string }[];

  const dimensions: PortraitDimension[] = dimRows.map((r) => ({
    dimension: r.dimension,
    observation: r.observation,
    addedAt: r.added_at,
  }));

  return {
    dimensions,
    stage: portraitRow.stage,
    stageStartedAt: portraitRow.stage_started_at,
    dimensionCount: dimensions.length,
  };
}

export function addPortraitDimension(
  db: Database.Database,
  dim: PortraitDimension,
): void {
  db.prepare(
    "INSERT OR REPLACE INTO portrait_meta (dimension, observation, added_at) VALUES (?, ?, ?)",
  ).run(dim.dimension, dim.observation, dim.addedAt);
}

export function removePortraitDimension(
  db: Database.Database,
  dimension: string,
): void {
  db.prepare("DELETE FROM portrait_meta WHERE dimension = ?").run(dimension);
}

export function setPortraitStage(
  db: Database.Database,
  stage: Stage,
): void {
  db.prepare(
    "UPDATE portrait SET stage = ?, stage_started_at = ? WHERE id = 1",
  ).run(stage, new Date().toISOString());
}

// ── Mutations (transactions) ────────────────────────────────

export function deleteDay(db: Database.Database, date: string): void {
  const delLog = db.prepare("DELETE FROM behavior_log WHERE date = ?");
  const delCard = db.prepare("DELETE FROM character_cards WHERE date = ?");
  db.transaction(() => {
    delLog.run(date);
    delCard.run(date);
  })();
}

export function deleteBehaviorLog(db: Database.Database, date: string): void {
  db.prepare("DELETE FROM behavior_log WHERE date = ?").run(date);
}

export function wipeAll(db: Database.Database): void {
  db.transaction(() => {
    db.exec(`
      DELETE FROM settings;
      DELETE FROM behavior_log;
      DELETE FROM character_cards;
      DELETE FROM portrait_meta;
    `);
    db.prepare(
      "UPDATE portrait SET stage = 'observer', stage_started_at = ? WHERE id = 1",
    ).run(new Date().toISOString());
  })();
}
