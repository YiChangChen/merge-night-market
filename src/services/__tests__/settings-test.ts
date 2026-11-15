// S7.2：音樂、音效設定（merge-night-market/settings，和遊戲存檔分開）。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { log } from '../log';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  SETTINGS_KEY,
  setMusicEnabled,
  setSfxEnabled,
  useSettings,
} from '../settings';

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
});

describe('parseSettings', () => {
  it('沒有設定：兩個都開', () => {
    expect(parseSettings(null)).toEqual({ music: true, sfx: true });
  });

  it('壞掉的 JSON、缺欄位、型別不對：該欄位用預設值', () => {
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"music":false}')).toEqual({ music: false, sfx: true });
    expect(parseSettings('{"music":"no","sfx":0}')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('讀取與儲存', () => {
  it('切換後寫入 merge-night-market/settings；重新啟動（重新讀取）後設定不變', async () => {
    await loadSettings();
    setMusicEnabled(false);
    setSfxEnabled(false);
    await Promise.resolve();
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? '{}')).toEqual({
      music: false,
      sfx: false,
    });

    // 模擬重新啟動
    useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
    await loadSettings();
    expect(useSettings.getState()).toMatchObject({ music: false, sfx: false, loaded: true });
  });

  it('不寫進遊戲存檔的 key', async () => {
    setMusicEnabled(false);
    await Promise.resolve();
    expect(await AsyncStorage.getItem('merge-night-market/save')).toBeNull();
  });

  it('讀取失敗：只記 log.warn，用預設值，仍然標成已讀取', async () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await loadSettings();
    expect(useSettings.getState()).toMatchObject({ ...DEFAULT_SETTINGS, loaded: true });
    expect(warn).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    warn.mockRestore();
  });

  it('寫入失敗：畫面上的狀態照樣改，只記 log.warn', async () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    setSfxEnabled(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useSettings.getState().sfx).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    warn.mockRestore();
  });
});
