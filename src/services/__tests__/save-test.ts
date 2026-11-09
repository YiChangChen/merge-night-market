// 存檔 I/O 的資料安全測試（NFR5）。專案規則原則上不替服務層寫單元測試，
// 但「先備份再寫入」與「失敗時絕不覆寫」是存檔遷移的核心保證，所以例外用 AsyncStorage 的官方 mock 驗證。
import AsyncStorage from '@react-native-async-storage/async-storage';

import lv3 from '@/game/save/__tests__/fixtures/save-v1-lv3.json';
import { useGameStore } from '@/game/store';

import { startGameSession } from '../game-session';
import { loadGame, saveGame } from '../save';

const SAVE_KEY = 'merge-night-market/save';
const BACKUP_KEY = 'merge-night-market/save.v1.bak';
const V1_RAW = JSON.stringify(lv3);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
  useGameStore.setState({ state: null, status: { kind: 'loading' } });
});

describe('loadGame', () => {
  it('沒有存檔時開新局', async () => {
    const result = await loadGame();

    expect(result.kind).toBe('ready');
    expect(await AsyncStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it('v1 存檔：遷移成功，第一次寫入 v2 之前已經把原始字串備份到 save.v1.bak', async () => {
    await AsyncStorage.setItem(SAVE_KEY, V1_RAW);

    const result = await loadGame();

    expect(result.kind).toBe('ready');
    expect(await AsyncStorage.getItem(BACKUP_KEY)).toBe(V1_RAW);
    // 讀檔本身不寫主存檔
    expect(await AsyncStorage.getItem(SAVE_KEY)).toBe(V1_RAW);

    if (result.kind !== 'ready') return;
    saveGame(result.state);
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem(SAVE_KEY)) as string);
    expect(saved.version).toBe(2);
    expect(saved.coins).toBe(lv3.coins);
    expect(saved).not.toHaveProperty('events');
    expect(await AsyncStorage.getItem(BACKUP_KEY)).toBe(V1_RAW);
  });

  it('已經有備份時不覆寫備份（保留最早的 v1 原檔）', async () => {
    await AsyncStorage.setItem(BACKUP_KEY, 'earliest-v1');
    await AsyncStorage.setItem(SAVE_KEY, V1_RAW);

    await loadGame();

    expect(await AsyncStorage.getItem(BACKUP_KEY)).toBe('earliest-v1');
  });

  it('存檔損毀：回傳 failed，不開新局，也不動任何資料', async () => {
    await AsyncStorage.setItem(SAVE_KEY, '{"version": 1, "board": [');

    const result = await loadGame();

    expect(result).toEqual({ kind: 'failed', reason: 'corrupt-json' });
    expect(await AsyncStorage.getItem(SAVE_KEY)).toBe('{"version": 1, "board": [');
    expect(await AsyncStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it('備份寫入失敗：停止遷移並回傳 failed，避免 v1 被覆寫後無法復原', async () => {
    await AsyncStorage.setItem(SAVE_KEY, V1_RAW);
    // 官方 mock 的 setItem 本身就是 jest.fn；只覆寫下一次呼叫，不要 spyOn + mockRestore（會清掉 mock 的實作）
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await loadGame();

    expect(result).toEqual({ kind: 'failed', reason: 'storage-error' });
    expect(await AsyncStorage.getItem(SAVE_KEY)).toBe(V1_RAW);
    expect(await AsyncStorage.getItem(BACKUP_KEY)).toBeNull();
    consoleError.mockRestore();
  });
});

describe('startGameSession', () => {
  it('讀檔失敗時顯示 failed，而且之後完全不寫入存檔', async () => {
    const corrupt = JSON.stringify({ ...lv3, board: [] });
    await AsyncStorage.setItem(SAVE_KEY, corrupt);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const stop = startGameSession();
    await flush();
    await flush();

    expect(useGameStore.getState().status).toEqual({ kind: 'failed', reason: 'migration-failed' });
    expect(useGameStore.getState().state).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(await AsyncStorage.getItem(SAVE_KEY)).toBe(corrupt);

    stop();
    consoleError.mockRestore();
  });
});
