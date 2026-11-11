// 遊戲事件：規則函式把事件放進 state.events，store 在 apply 之後依序分派給訂閱者。
// 訂閱者只有 FxController、AudioService、Telemetry（見 game-architecture.md〈Event System〉）。
// 訂閱者只能讀，不得在處理事件時同步呼叫 apply；真的需要時放進 queueMicrotask。
import type { ChainId } from './content';
import type { OrderKind, RecipeId } from './types';

// type 一律是 snake_case 過去式，同時作為埋點事件名。
// 目前只列出現有型別能表達的事件；發明、卡牌、廣告等事件由之後的 story 加入。
export type GameEvent =
  | { type: 'item_merged'; chain: ChainId; level: number }
  | { type: 'order_completed'; kind: OrderKind; coins: number }
  | { type: 'queue_sold_out'; wave: number; length: number }
  // 發明（S3.2）：first 代表第一次做出這道菜；rejected 帶受影響、尚未發現的配方（給阿嬤保底，NP-3）
  | { type: 'dish_invented'; recipe: RecipeId; first: boolean }
  | { type: 'invent_rejected'; recipes: RecipeId[] }
  // 阿嬤提示（S4.4）：保底第 5 次失敗，或 tea、fried 都到 Lv2 時的教學提示
  | { type: 'hint_shown'; recipe: RecipeId }
  | { type: 'stall_reopened' | 'stall_upgraded'; stall: ChainId; level: number };

export type GameEventListener = (event: GameEvent) => void;

export type EventErrorHandler = (error: unknown, event: GameEvent) => void;

export type EventBus = {
  subscribe(listener: GameEventListener): () => void;
  emit(event: GameEvent): void;
  /** 由服務層在啟動時接上（例如 log.error）；規則層不能 import log。 */
  setErrorHandler(handler: EventErrorHandler): void;
};

// 預設不做任何事：訂閱者的錯誤絕不能重新丟出，否則在 RN 正式版會變成全域致命錯誤讓 App 閃退
const ignoreError: EventErrorHandler = () => {};

export function createEventBus(onError: EventErrorHandler = ignoreError): EventBus {
  const listeners = new Set<GameEventListener>();
  let handleError = onError;
  return {
    setErrorHandler(handler) {
      handleError = handler;
    },
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
          // 一個訂閱者壞掉（例如音效載入失敗）不能讓其他訂閱者收不到事件，也不能讓 App 閃退
          try {
            handleError(error, event);
          } catch {
            // 錯誤處理器本身出錯也一律吞掉
          }
        }
      }
    },
  };
}

// 錯誤處理器在 services/game-session.ts 接到 log.error（之後 log.error 會送 Sentry，S7.4）。
export const gameEvents = createEventBus();
