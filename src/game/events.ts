// 遊戲事件：規則函式把事件放進 state.events，store 在 apply 之後依序分派給訂閱者。
// 訂閱者只有 FxController、AudioService、Telemetry（見 game-architecture.md〈Event System〉）。
// 訂閱者只能讀，不得在處理事件時同步呼叫 apply；真的需要時放進 queueMicrotask。
import type { ChainId } from './content';

// type 一律是 snake_case 過去式，同時作為埋點事件名。
// 目前只列出現有型別能表達的事件；發明、卡牌、廣告等事件由之後的 story 加入。
export type GameEvent =
  | { type: 'item_merged'; chain: ChainId; level: number }
  | { type: 'order_completed'; kind: 'normal'; coins: number }
  | { type: 'queue_sold_out'; wave: number; length: number }
  | { type: 'stall_reopened' | 'stall_upgraded'; stall: ChainId; level: number };

export type GameEventListener = (event: GameEvent) => void;

export type EventBus = {
  subscribe(listener: GameEventListener): () => void;
  emit(event: GameEvent): void;
};

export function createEventBus(onError: (error: unknown, event: GameEvent) => void): EventBus {
  const listeners = new Set<GameEventListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(event) {
      // 先複製一份，處理事件時有人取消訂閱也不影響這一輪
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (error) {
          // 一個訂閱者壞掉（例如音效載入失敗）不能讓其他訂閱者收不到事件
          onError(error, event);
        }
      }
    },
  };
}

// 訂閱者的錯誤延後重新丟出，交給全域錯誤處理（之後由 Sentry 接手），不中斷這一輪分派。
export const gameEvents = createEventBus((error) => {
  queueMicrotask(() => {
    throw error;
  });
});
