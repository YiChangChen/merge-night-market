// 遊戲狀態的唯一持有者：Zustand 薄殼包住純函式規則引擎。
// 元件只能用 selector 訂閱切片，寫入只能透過 apply。見 game-architecture.md〈State Management〉。
import { create } from 'zustand';

import { gameEvents } from './events';
import type { LoadFailure } from './save';
import { syncAll } from './time';
import type { GameState } from './types';

export type GameAction = (state: GameState) => GameState;

// loading：讀檔中；ready：可以玩；failed：存檔讀取或遷移失敗，顯示錯誤畫面且絕不覆寫存檔
export type LoadStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'failed'; reason: LoadFailure };

type GameStore = {
  // ready 之前一律是 null
  state: GameState | null;
  status: LoadStatus;
  // 流程固定：syncAll → action → 分派事件 → 清空事件
  apply: (action: GameAction) => void;
  // 讀檔完成後放進 store，並先結算離線期間的時間
  hydrate: (state: GameState) => void;
  // 讀檔失敗：state 維持 null，所以不會有任何寫入存檔
  failLoad: (reason: LoadFailure) => void;
  // 重新讀檔前回到 loading
  resetLoad: () => void;
};

// store 是規則層與外界的邊界，只有這裡可以取得目前時間（lint 對 store.ts 放行 Date.now）。
function currentTime(): number {
  return Date.now();
}

export const useGameStore = create<GameStore>()((set, get) => ({
  state: null,
  status: { kind: 'loading' },

  apply: (action) => {
    const current = get().state;
    if (!current) return;
    const next = action(syncAll(current, currentTime()));
    if (next === current) return;
    const { events } = next;
    // 先更新 store（事件清空），訂閱者收到事件時讀到的就是新的 state
    set({ state: events.length > 0 ? { ...next, events: [] } : next });
    for (const event of events) gameEvents.emit(event);
  },

  hydrate: (state) => {
    set({ state: { ...syncAll(state, currentTime()), events: [] }, status: { kind: 'ready' } });
  },

  failLoad: (reason) => {
    set({ state: null, status: { kind: 'failed', reason } });
  },

  resetLoad: () => {
    set({ state: null, status: { kind: 'loading' } });
  },
}));
