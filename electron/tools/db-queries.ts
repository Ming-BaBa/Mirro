import type Database from "better-sqlite3";
import type { DailyBehaviorSummary, Portrait, CharacterCard } from "../../shared/types.js";
import { getDailySummary, getPortrait, getCards } from "../store.js";

export function createDbTools(db: ReturnType<typeof Database>) {
  return {
    queryBehavior: (date: string): DailyBehaviorSummary | null => {
      return getDailySummary(db, date);
    },

    queryText: (date: string): string => {
      const rows = db.prepare(
        "SELECT primary_app, typed_text FROM behavior_log WHERE date = ? AND typed_text != ''"
      ).all(date) as { primary_app: string; typed_text: string }[];
      return rows.map(r => `[${r.primary_app}] ${r.typed_text}`).join("\n");
    },

    queryPortrait: (): Portrait => {
      return getPortrait(db);
    },

    queryRecentCards: (limit: number = 7): CharacterCard[] => {
      return getCards(db, limit);
    },

    getTodayDate: (): string => {
      return new Date().toISOString().split("T")[0];
    }
  };
}
