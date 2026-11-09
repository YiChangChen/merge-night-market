// 存檔讀寫（AsyncStorage 單一 key）。v1 行為原樣搬過來；S1.5 會加上 v2 遷移與備份。
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createGame, type GameState, isValidSave } from '@/game/engine';

import { log } from './log';

const SAVE_KEY = 'merge-night-market/save';

export function newGame(): GameState {
  return createGame(Date.now(), Math.floor(Math.random() * 2 ** 31));
}

export async function loadGame(): Promise<GameState> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    const save: unknown = raw ? JSON.parse(raw) : null;
    if (isValidSave(save)) return save;
  } catch (error) {
    log.warn('save', '無法讀取存檔，改開新遊戲', error);
  }
  return newGame();
}

export function saveGame(state: GameState) {
  // events 是暫態，不寫入存檔
  const { events: _events, ...data } = state;
  AsyncStorage.setItem(SAVE_KEY, JSON.stringify(data)).catch((error) => {
    log.warn('save', '無法寫入存檔', error);
  });
}
