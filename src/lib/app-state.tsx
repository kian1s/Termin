import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Settings } from '@/lib/types';

const KEYS = { settings: 'settings', seen: 'seenWordIds' };

export const DEFAULT_REMINDER = { enabled: false, hour: 19, minute: 0 };

type AppState = {
  loaded: boolean;
  settings: Settings | null; // null until onboarding is finished
  saveSettings: (s: Settings) => void;
  seenIds: Set<string>;
  markSeen: (id: string) => void;
};

const Ctx = createContext<AppState | null>(null);

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const seenRef = useRef(seenIds);

  useEffect(() => {
    (async () => {
      const [s, seen] = await Promise.all([
        readJson<Settings>(KEYS.settings),
        readJson<string[]>(KEYS.seen),
      ]);
      setSettings(s ? { ...s, reminder: s.reminder ?? DEFAULT_REMINDER } : null);
      seenRef.current = new Set(seen ?? []);
      setSeenIds(seenRef.current);
      setLoaded(true);
    })();
  }, []);

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    AsyncStorage.setItem(KEYS.settings, JSON.stringify(s));
  }, []);

  const markSeen = useCallback((id: string) => {
    if (seenRef.current.has(id)) return;
    seenRef.current = new Set(seenRef.current).add(id);
    setSeenIds(seenRef.current);
    AsyncStorage.setItem(KEYS.seen, JSON.stringify([...seenRef.current]));
  }, []);

  return (
    <Ctx.Provider value={{ loaded, settings, saveSettings, seenIds, markSeen }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
