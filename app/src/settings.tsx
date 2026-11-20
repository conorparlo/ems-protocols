import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Level } from '@/content/schema';

export type ThemePref = 'system' | 'dark' | 'light';
export type TextScale = 1 | 1.15 | 1.3;
/** How steps above the provider's level are shown: removed, or greyed out with a level badge. */
export type AboveScope = 'hide' | 'dim';

export type Settings = {
  level: Level;
  theme: ThemePref;
  textScale: TextScale;
  aboveScope: AboveScope;
  recents: string[];
  favorites: string[];
};

const DEFAULTS: Settings = {
  level: 'EMT',
  theme: 'dark',
  textScale: 1,
  aboveScope: 'hide',
  recents: [],
  favorites: [],
};

const KEY = 'settings.v1';

type Ctx = Settings & {
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
  addRecent: (id: string) => void;
  toggleFavorite: (id: string) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addRecent = useCallback(
    (id: string) =>
      setSettings((prev) => {
        const next = { ...prev, recents: [id, ...prev.recents.filter((r) => r !== id)].slice(0, 8) };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      }),
    [],
  );

  const toggleFavorite = useCallback(
    (id: string) =>
      setSettings((prev) => {
        const favorites = prev.favorites.includes(id)
          ? prev.favorites.filter((f) => f !== id)
          : [...prev.favorites, id];
        const next = { ...prev, favorites };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      }),
    [],
  );

  const value = useMemo(
    () => ({ ...settings, loaded, update, addRecent, toggleFavorite }),
    [settings, loaded, update, addRecent, toggleFavorite],
  );
  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings() {
  const ctx = use(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
