// @vitest-environment node

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  initStore,
  getSettings,
  setSettings,
  insertBehaviorSegment,
  getDailySummary,
} from "../electron/store";
import type { AppSettings } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("store", () => {
  let db: ReturnType<typeof Database>;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mirro-test-"));
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
        browsingDomains: [],
      });

      const summary = getDailySummary(db, "2026-06-07");
      expect(summary).not.toBeNull();
      expect(summary!.totalInputChars).toBe(500);
      expect(summary!.uniqueApps).toContain("VS Code");
    });

    it("aggregates multiple segments correctly", () => {
      insertBehaviorSegment(db, {
        timestamp: "2026-06-07T09:00:00Z",
        timeRange: "09:00-09:30",
        primaryApp: "VS Code",
        inputChars: 500,
        deleteCount: 100,
        browsingDomains: [],
      });
      insertBehaviorSegment(db, {
        timestamp: "2026-06-07T10:00:00Z",
        timeRange: "10:00-10:30",
        primaryApp: "Chrome",
        inputChars: 200,
        deleteCount: 10,
        browsingDomains: ["twitter.com"],
      });

      const summary = getDailySummary(db, "2026-06-07");
      expect(summary!.totalInputChars).toBe(700);
      expect(summary!.totalDeleteRate).toBeCloseTo(0.16, 1);
      expect(summary!.uniqueApps).toEqual(["Chrome", "VS Code"]);
    });
  });
});
