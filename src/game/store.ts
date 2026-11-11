// 遊戲狀態的唯一持有者：Zustand 薄殼包住純函式規則引擎。
// 元件只能用 selector 訂閱切片，寫入只能透過 apply。見 game-architecture.md〈State Management〉。
import { create } from 'zustand';

import { gameEvents } from './events';
import type { LoadFailure } from './save';
import { syncAll } from './time';
import type { GameState } from './types';

/**
 * 規則動作。now 是 store 的目前時間（含除錯面板的時間快轉偏移量），
 * 需要時間的規則一律用它，不要在元件裡自己呼叫 Date.now()，時間才會一致。
 */
export type GameAction = (state: GameState, now: number) => GameState;

// loading：讀檔中；ready：可以玩；failed：存檔讀取或遷移失敗，顯示錯誤畫面且絕不覆寫存檔
export type LoadStatus =
  { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; reason: LoadFailure };

type GameStore = {
  // ready 之前一律是 null
  state: GameState | null;
  status: LoadStatus;
  // 流程固定：syncAll → action → 分派事件 → 清空事件；action 的第二個參數是目前時間
  apply: (action: GameAction) => void;
  // 讀檔完成後放進 store，並先結算離線期間的時間
  hydrate: (state: GameState) => void;
  // 讀檔失敗：state 維持 null，所以不會有任何寫入存檔
  failLoad: (reason: LoadFailure) => void;
  // 重新讀檔前回到 loading
  resetLoad: () => void;
  // —— 除錯面板（S1.8）：時間快轉，偏移量加在 store 的目前時間上（apply、hydrate、HUD 倒數都用它）。
  // 偏移量本身不存檔；但快轉期間結算出的時間戳會被存起來，App 重開後由時鐘倒退的規則重新起算 ——
  timeOffsetMs: number;
  advanceTime: (ms: number) => void;
  resetTime: () => void;
};

export const useGameStore = create<GameStore>()((set, get) => {
  // store 是規則層與外界的邊界，只有這裡可以取得目前時間（lint 對 store.ts 放行 Date.now）。
  // 除錯面板快轉時，偏移量會加在這裡，所有時間型機制一起前進。
  const currentTime = () => Date.now() + get().timeOffsetMs;

  return {
    state: null,
    status: { kind: 'loading' },
    timeOffsetMs: 0,

    apply: (action) => {
      const current = get().state;
      if (!current) return;
      const now = currentTime();
      const next = action(syncAll(current, now), now);
      if (next === current) return;
      const { events } = next;
      // 先更新 store（事件清空），訂閱者收到事件時讀到的就是新的 state
      set({ state: events.length > 0 ? { ...next, events: [] } : next });
      for (const event of events) gameEvents.emit(event);
    },

    hydrate: (state) => {
      const synced = syncAll(state, currentTime());
      const { events } = synced;
      set({ state: { ...synced, events: [] }, status: { kind: 'ready' } });
      // 讀檔時的結算也可能產生事件（例如舊存檔補上的教學提示），和 apply 一樣分派，
      // 否則 hintedRecipes 已經記下、阿嬤卻不會出現（E4 code review）
      for (const event of events) gameEvents.emit(event);
    },

    failLoad: (reason) => {
      set({ state: null, status: { kind: 'failed', reason } });
    },

    resetLoad: () => {
      set({ state: null, status: { kind: 'loading' } });
    },

    advanceTime: (ms) => {
      if (!Number.isFinite(ms) || ms <= 0) return;
      set({ timeOffsetMs: get().timeOffsetMs + ms });
      // 立刻結算一次，畫面馬上反映快轉後的結果
      get().apply((state) => state);
    },

    resetTime: () => {
      set({ timeOffsetMs: 0 });
      // 和 advanceTime 一樣立刻結算：快轉期間進入的冷卻會依真實時間截短，不必等到玩家下一個動作
      get().apply((state) => state);
    },
  };
});
