import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { BALANCE } from './content';
import { createGame, type GameState, isValidSave, syncEnergy } from './engine';

const SAVE_KEY = 'merge-night-market/save';
const SAVE_DEBOUNCE_MS = 500;

function newGame(): GameState {
  return createGame(Date.now(), Math.floor(Math.random() * 2 ** 31));
}

async function loadGame(): Promise<GameState> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    const save: unknown = raw ? JSON.parse(raw) : null;
    if (isValidSave(save)) return save;
  } catch (error) {
    console.warn('無法讀取存檔，改開新遊戲', error);
  }
  return newGame();
}

function saveGame(state: GameState) {
  AsyncStorage.setItem(SAVE_KEY, JSON.stringify(state)).catch((error) => {
    console.warn('無法寫入存檔', error);
  });
}

// 持有遊戲狀態：負責讀檔、存檔與體力計時。回傳 null 代表還在讀檔。
export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const latest = useRef<GameState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGame().then((loaded) => {
      if (!cancelled) setState(syncEnergy(loaded, Date.now()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    latest.current = state;
    if (!state) return;
    const timer = setTimeout(() => saveGame(state), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => {
      // 體力滿時不必結算，避免每秒產生新 state 並觸發存檔
      setState((current) =>
        current && current.energy < BALANCE.maxEnergy ? syncEnergy(current, Date.now()) : current
      );
    }, 1000);
    // App 退到背景時可能來不及等 debounce，立刻存一次
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        setState((current) => current && syncEnergy(current, Date.now()));
      } else if (latest.current) {
        saveGame(latest.current);
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  // 所有操作都先結算體力，再套用規則
  const apply = useCallback((action: (current: GameState) => GameState) => {
    setState((current) => current && action(syncEnergy(current, Date.now())));
  }, []);

  return { state, apply };
}
