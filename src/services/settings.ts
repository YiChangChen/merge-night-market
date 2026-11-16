// 玩家設定（S7.2）：音樂、音效開關；分析資料開關（E7 retro，上架前的隱私要求）。存在 merge-night-market/settings，和遊戲存檔分開（架構〈Data Persistence〉）。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { log } from './log';

export const SETTINGS_KEY = 'merge-night-market/settings';

export type Settings = {
  music: boolean;
  sfx: boolean;
  /** 匿名的遊玩數據（PostHog）；關掉後不再送出任何事件 */
  analytics: boolean;
};

export const DEFAULT_SETTINGS: Settings = { music: true, sfx: true, analytics: true };

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
      analytics:
        typeof object.analytics === 'boolean' ? object.analytics : DEFAULT_SETTINGS.analytics,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// 讀完之前玩家改過的欄位：讀完時以玩家的選擇為準，再一起寫入（不會被讀到的舊值蓋掉，也不會用預設值蓋掉另一個欄位）
let changedBeforeLoad: Partial<Settings> = {};

/** 啟動時讀一次；失敗只記 log.warn，用預設值 */
export async function loadSettings(): Promise<void> {
  let stored: Settings | null = null;
  try {
    stored = parseSettings(await AsyncStorage.getItem(SETTINGS_KEY));
  } catch (error) {
    log.warn('boot', '讀取設定失敗，使用預設值', { error: String(error) });
  }
  const changed = changedBeforeLoad;
  changedBeforeLoad = {};
  useSettings.setState({ ...stored, ...changed, loaded: true });
  if (Object.keys(changed).length > 0) save();
}

function save(): void {
  const { music, sfx, analytics } = useSettings.getState();
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ music, sfx, analytics })).catch(
    (error: unknown) => {
      log.warn('boot', '儲存設定失敗', { error: String(error) });
    }
  );
}

/** 改設定：畫面立刻生效，再寫入儲存（寫入失敗只記 log.warn） */
export function setMusicEnabled(music: boolean): void {
  update({ music });
}

export function setSfxEnabled(sfx: boolean): void {
  update({ sfx });
}

export function setAnalyticsEnabled(analytics: boolean): void {
  update({ analytics });
}

function update(change: Partial<Settings>): void {
  useSettings.setState(change);
  // 還沒讀完：先記著，讀完時再寫入
  if (!useSettings.getState().loaded) {
    changedBeforeLoad = { ...changedBeforeLoad, ...change };
    return;
  }
  save();
}
