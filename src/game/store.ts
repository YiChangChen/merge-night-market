// 遊戲狀態的唯一持有者：Zustand 薄殼包住純函式規則引擎。
// 元件只能用 selector 訂閱切片，寫入只能透過 apply。見 game-architecture.md〈State Management〉。
import { create } from 'zustand';

import type { GameState } from './engine';
import { gameEvents } from './events';
import { syncAll } from './time';

export type GameAction = (state: GameState) => GameState;

type GameStore = {
  // null 代表還在讀檔
  state: GameState | null;
  // 流程固定：syncAll → action → 分派事件 → 清空事件
  apply: (action: GameAction) => void;
  // 讀檔完成後放進 store，並先結算離線期間的時間
  hydrate: (state: GameState) => void;
};

// store 是規則層與外界的邊界，只有這裡可以取得目前時間（lint 對 store.ts 放行 Date.now）。
function currentTime(): number {
  return Date.now();
}

function withoutEvents(state: GameState): GameState {
  if (state.events === undefined) return state;
  const { events: _events, ...rest } = state;
  return rest;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  state: null,

  apply: (action) => {
    const current = get().state;
    if (!current) return;
    const next = action(syncAll(current, currentTime()));
    if (next === current) return;
    const events = next.events ?? [];
    // 先更新 store，訂閱者收到事件時讀到的就是新的 state
    set({ state: withoutEvents(next) });
    for (const event of events) gameEvents.emit(event);
  },

  hydrate: (state) => {
    set({ state: withoutEvents(syncAll(state, currentTime())) });
  },
}));
