// 存檔讀寫（AsyncStorage 單一 key）。解析、遷移與驗證是規則層的純函式（@/game/save）。
// 規則：讀取或遷移失敗時，絕不覆寫存檔、絕不開新局；只有完全沒有存檔時才開新局。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createGame } from '@/game/engine';
import { parseSave, type SaveFailure, serializeSave } from '@/game/save';
import { type GameState, SAVE_VERSION } from '@/game/types';

import { log } from './log';

const SAVE_KEY = 'merge-night-market/save';
// 第一次遷移前的 v1 原始字串；只寫一次，之後不再覆寫
const V1_BACKUP_KEY = 'merge-night-market/save.v1.bak';

export type LoadResult =
  | { kind: 'ready'; state: GameState }
  | { kind: 'failed'; reason: SaveFailure | 'storage-error' };

export function newGame(): GameState {
  return createGame(Date.now(), Math.floor(Math.random() * 2 ** 31));
}

async function backupV1(raw: string): Promise<void> {
  const existing = await AsyncStorage.getItem(V1_BACKUP_KEY);
  if (existing === null) await AsyncStorage.setItem(V1_BACKUP_KEY, raw);
}

export async function loadGame(): Promise<LoadResult> {
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
      // 不覆寫、不開新局：原檔留著，等之後的版本或手動處理
      log.error('save', '存檔讀取失敗', { reason: result.reason, version: result.version });
      return { kind: 'failed', reason: result.reason };

    case 'loaded':
      if (result.migratedFrom !== null && raw !== null) {
        // 第一次寫入新版本之前，先備份原始字串；備份失敗就不繼續，避免舊檔被覆寫後無法復原
        try {
          await backupV1(raw);
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

export function saveGame(state: GameState) {
  AsyncStorage.setItem(SAVE_KEY, serializeSave(state)).catch((error) => {
    log.warn('save', '無法寫入存檔', error);
  });
}
