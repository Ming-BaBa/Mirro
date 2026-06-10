import { useEffect, useState, useCallback } from "react";
import type { MirroApi } from "../../electron/preload";
import type { CharacterCard, AppSettings, Portrait, DailyBehaviorSummary } from "../../shared/types";

declare global {
  interface Window {
    mirro: MirroApi;
  }
}

function api() {
  return window.mirro;
}

export function useCards(limit = 30) {
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    api().getCards(limit).then(c => { setCards(c); setLoading(false); });
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { cards, loading, refresh };
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api().getSettings().then(setSettingsState).catch((e: Error) => setError(e.message));
    const unsub = api().onSettingsChanged((partial) => {
      setSettingsState(prev => prev ? { ...prev, ...partial as Partial<AppSettings> } : prev);
    });
    return unsub;
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    await api().setSettings(partial);
    const updated = await api().getSettings();
    setSettingsState(updated);
  }, []);

  return { settings, updateSettings, error };
}
