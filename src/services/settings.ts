// 玩家設定（S7.2）：音樂、音效開關。存在 merge-night-market/settings，和遊戲存檔分開（架構〈Data Persistence〉）。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { log } from './log';

export const SETTINGS_KEY = 'merge-night-market/settings';

export type Settings = { music: boolean; sfx: boolean };

export const DEFAULT_SETTINGS: Settings = { music: true, sfx: true };

type SettingsStore = Settings & {
  /** 已經從儲存讀過（讀取失敗也算） */
  loaded: boolean;
};

export const useSettings = create<SettingsStore>()(() => ({ ...DEFAULT_SETTINGS, loaded: false }));

/** 壞掉的 JSON、缺欄位或型別不對時，該欄位用預設值 */
export function parseSettings(raw: string | null): Settings {
  if (raw === null) return { ...DEFAULT_SETTINGS };
  try {
    const value: unknown = JSON.parse(raw);
    const object =
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    return {
      music: typeof object.music === 'boolean' ? object.music : DEFAULT_SETTINGS.music,
      sfx: typeof object.sfx === 'boolean' ? object.sfx : DEFAULT_SETTINGS.sfx,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 啟動時讀一次；失敗只記 log.warn，用預設值 */
export async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    useSettings.setState({ ...parseSettings(raw), loaded: true });
  } catch (error) {
    log.warn('boot', '讀取設定失敗，使用預設值', { error: String(error) });
    useSettings.setState({ loaded: true });
  }
}

function save(): void {
  const { music, sfx } = useSettings.getState();
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ music, sfx })).catch((error: unknown) => {
    log.warn('boot', '儲存設定失敗', { error: String(error) });
  });
}

/** 改設定：畫面立刻生效，再寫入儲存（寫入失敗只記 log.warn） */
export function setMusicEnabled(music: boolean): void {
  useSettings.setState({ music });
  save();
}

export function setSfxEnabled(sfx: boolean): void {
  useSettings.setState({ sfx });
  save();
}
