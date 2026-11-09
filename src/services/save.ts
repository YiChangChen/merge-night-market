// 存檔讀寫（AsyncStorage 單一 key）。解析、遷移與驗證是規則層的純函式（@/game/save）。
// 規則：讀取或遷移失敗時，絕不覆寫存檔、絕不自動開新局。只有兩種情況會開新局：
// 完全沒有存檔，或玩家在錯誤畫面確認「備份後開新局」（原檔先備份）。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createGame } from '@/game/engine';
import { type LoadFailure, parseSave, serializeSave } from '@/game/save';
import { type GameState, SAVE_VERSION } from '@/game/types';

import { log } from './log';

const SAVE_KEY = 'merge-night-market/save';

/** 遷移前的原始字串，依來源版本分開存（v1 為 save.v1.bak）；每個版本只寫一次，之後不再覆寫。 */
export function migrationBackupKey(version: number): string {
  return `merge-night-market/save.v${version}.bak`;
}

/** 讀不出來的存檔在「備份後開新局」時保存到這裡；以時間區分，不覆寫之前的備份。 */
export function corruptBackupKey(now: number): string {
  return `merge-night-market/save.corrupt.${now}.bak`;
}

export type LoadResult = { kind: 'ready'; state: GameState } | { kind: 'failed'; reason: LoadFailure };

export function newGame(): GameState {
  return createGame(Date.now(), Math.floor(Math.random() * 2 ** 31));
}

async function backupBeforeMigration(version: number, raw: string): Promise<void> {
  const key = migrationBackupKey(version);
  const existing = await AsyncStorage.getItem(key);
  if (existing === null) await AsyncStorage.setItem(key, raw);
}

async function loadGameUnsafe(): Promise<LoadResult> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(SAVE_KEY);
  } catch (error) {
    log.error('save', '無法讀取存檔', error);
    return { kind: 'failed', reason: 'storage-error' };
  }

  const result = parseSave(raw, Date.now());
  switch (result.kind) {
    case 'empty':
      log.info('save', '沒有存檔，開新局');
      return { kind: 'ready', state: newGame() };

    case 'failed':
      // 不覆寫、不自動開新局：原檔留著，由玩家在錯誤畫面決定
      log.error('save', '存檔讀取失敗', { reason: result.reason, version: result.version });
      return { kind: 'failed', reason: result.reason };

    case 'loaded':
      if (result.migratedFrom !== null && raw !== null) {
        // 第一次寫入新版本之前，先備份原始字串；備份失敗就不繼續，避免舊檔被覆寫後無法復原
        try {
          await backupBeforeMigration(result.migratedFrom, raw);
        } catch (error) {
          log.error('save', '無法備份舊版存檔，停止遷移', error);
          return { kind: 'failed', reason: 'storage-error' };
        }
        log.info('save', '存檔已遷移', {
          from: result.migratedFrom,
          to: SAVE_VERSION,
          level: result.state.level,
          coins: result.state.coins,
        });
      }
      return { kind: 'ready', state: result.state };
  }
}

export async function loadGame(): Promise<LoadResult> {
  try {
    return await loadGameUnsafe();
  } catch (error) {
    // 遷移或解析途中意外拋出例外：一樣當成讀檔失敗，不能讓畫面卡在載入中
    log.error('save', '讀檔時發生未預期的錯誤', error);
    return { kind: 'failed', reason: 'unexpected-error' };
  }
}

/**
 * 讀檔失敗畫面的「備份後開新局」：先把目前的存檔原封不動備份，成功後才回傳新局。
 * 備份失敗就不開新局，原檔保持不動。
 */
export async function startOverAfterBackup(): Promise<LoadResult> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (raw !== null) await AsyncStorage.setItem(corruptBackupKey(Date.now()), raw);
    log.warn('save', '已備份讀不出來的存檔，開新局', { backedUp: raw !== null });
    return { kind: 'ready', state: newGame() };
  } catch (error) {
    log.error('save', '無法備份讀不出來的存檔，不開新局', error);
    return { kind: 'failed', reason: 'storage-error' };
  }
}

export function saveGame(state: GameState) {
  AsyncStorage.setItem(SAVE_KEY, serializeSave(state)).catch((error) => {
    log.warn('save', '無法寫入存檔', error);
  });
}
